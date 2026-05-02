"""
Garzoni AI Tutor service — OpenAI SDK, function-calling tools, persistent memory.
"""

from __future__ import annotations

import datetime
import hashlib
import json
import logging
from typing import Any, Dict, Generator, List, Optional, Tuple

from django.conf import settings
from django.core.cache import cache
from django.db import transaction
from rest_framework import status

from authentication.entitlements import get_user_plan
from authentication.models import UserProfile
from education.models import Path, UserProgress, Mastery
from support.prompts.tutor import TUTOR_SYSTEM, TUTOR_SYSTEM_WITH_CONTEXT, PROMPT_VERSION
from support.services.tools import TOOL_DEFINITIONS, dispatch_tool

logger = logging.getLogger(__name__)

_MAX_TOOL_ROUNDS = 4
_SUMMARY_TOKEN_THRESHOLD = 3_000
_MAX_HISTORY_MESSAGES = 40


def _get_openai_client():
    from openai import OpenAI

    return OpenAI(api_key=settings.OPENAI_API_KEY)


def _model_for_user(user) -> str:
    plan = get_user_plan(user)
    if plan == "pro":
        return "gpt-4o"
    return "gpt-4o-mini"


class OpenAIService:
    def __init__(self, request, request_with_backoff=None, check_and_consume_entitlement=None):
        self.request = request
        self.user = request.user
        self.check_and_consume_entitlement = check_and_consume_entitlement
        self.path_links: Optional[Dict] = None

    # ------------------------------------------------------------------
    # Token budget helpers
    # ------------------------------------------------------------------

    def _token_budget_key(self) -> str:
        today = datetime.datetime.utcnow().strftime("%Y-%m-%d")
        return f"openai:token_budget:{self.user.id}:{today}"

    def _get_daily_budget(self) -> int:
        plan = get_user_plan(self.user)
        if plan in {"plus", "pro"}:
            return getattr(settings, "OPENAI_DAILY_TOKEN_BUDGET_PREMIUM", 500_000)
        return getattr(settings, "OPENAI_DAILY_TOKEN_BUDGET_FREE", 50_000)

    def _check_token_budget(self) -> bool:
        key = self._token_budget_key()
        used = cache.get(key, 0)
        return used < self._get_daily_budget()

    def _consume_tokens(self, tokens_used: int) -> None:
        key = self._token_budget_key()
        try:
            cache.add(key, 0, timeout=90_000)
            cache.incr(key, tokens_used)
        except Exception:
            logger.warning("token_budget_incr_failed user=%s", self.user.id)

    # ------------------------------------------------------------------
    # Conversation persistence
    # ------------------------------------------------------------------

    def _get_or_create_conversation(self, source: str):
        from support.models import Conversation

        conv = (
            Conversation.objects.filter(user=self.user, source=source)
            .order_by("-updated_at")
            .first()
        )
        if not conv:
            conv = Conversation.objects.create(user=self.user, source=source)
        return conv

    def _load_history(self, conversation) -> List[Dict]:
        """Load persisted messages as OpenAI-format dicts."""
        rows = list(conversation.messages.order_by("created_at"))
        messages = []
        for m in rows:
            msg: Dict[str, Any] = {"role": m.role, "content": m.content}
            if m.tool_call_id:
                msg["tool_call_id"] = m.tool_call_id
            if m.tool_name:
                msg["name"] = m.tool_name
            messages.append(msg)
        return messages

    def _save_message(
        self, conversation, role: str, content: str, tool_call_id: str = "", tool_name: str = ""
    ) -> None:
        from support.models import Message

        Message.objects.create(
            conversation=conversation,
            role=role,
            content=content,
            tool_call_id=tool_call_id,
            tool_name=tool_name,
        )

    def _maybe_summarise(self, conversation, client) -> None:
        """If conversation exceeds token threshold, generate a rolling summary."""
        if conversation.total_tokens < _SUMMARY_TOKEN_THRESHOLD:
            return
        try:
            history = self._load_history(conversation)
            if len(history) < 10:
                return
            text = "\n".join(f"{m['role'].upper()}: {m['content'][:300]}" for m in history[-20:])
            resp = client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {
                        "role": "system",
                        "content": (
                            "Summarise this tutoring conversation in 3-5 sentences. "
                            "Focus on what the student learned and what they struggled with."
                        ),
                    },
                    {"role": "user", "content": text},
                ],
                max_tokens=200,
                temperature=0.3,
            )
            summary = (resp.choices[0].message.content or "").strip()
            if summary:
                conversation.summary = summary
                conversation.save(update_fields=["summary"])
            conversation.trim_history(max_messages=_MAX_HISTORY_MESSAGES)
        except Exception as exc:
            logger.warning("summarise_conversation_failed: %s", exc)

    # ------------------------------------------------------------------
    # Education context
    # ------------------------------------------------------------------

    def _build_education_context(self) -> str:
        user = self.user
        parts = []
        try:
            top_skills = list(
                Mastery.objects.filter(user=user)
                .order_by("-proficiency")
                .values("skill", "proficiency")[:3]
            )
            if top_skills:
                skill_strs = [f"{s['skill']} ({s['proficiency']}/100)" for s in top_skills]
                parts.append(f"Top skills: {', '.join(skill_strs)}.")

            last_progress = (
                UserProgress.objects.filter(user=user)
                .select_related("course", "course__path")
                .order_by("-last_course_activity_date")
                .first()
            )
            if last_progress and last_progress.course:
                course_title = last_progress.course.title or "a course"
                path_name = (
                    (last_progress.course.path.title or "") if last_progress.course.path else ""
                )
                parts.append(
                    f"Currently studying: {course_title}"
                    + (f" ({path_name} path)" if path_name else "")
                    + "."
                )
                completed = UserProgress.objects.filter(user=user, is_course_complete=True).count()
                if completed:
                    parts.append(f"Completed {completed} course(s).")

            try:
                from onboarding.models import QuestionnaireProgress

                q = QuestionnaireProgress.objects.filter(user=user).first()
                if q and q.answers:
                    goal = q.answers.get("primary_goal")
                    challenge = q.answers.get("biggest_challenge")
                    if goal:
                        parts.append(f"Financial goal: {goal}.")
                    if challenge:
                        parts.append(f"Biggest challenge: {challenge}.")
            except Exception:
                pass

        except Exception as exc:
            logger.debug("education_context_error: %s", exc)

        if conversation_summary := getattr(self, "_conversation_summary", ""):
            parts.append(f"Prior conversation summary: {conversation_summary}")

        return " ".join(parts)

    # ------------------------------------------------------------------
    # Path link helpers (kept for quick-reply fallbacks)
    # ------------------------------------------------------------------

    def get_available_paths(self):
        try:
            paths = Path.objects.all().values("title", "id")
            self.path_links = {p["title"].lower(): f"/all-topics#{p['id']}" for p in paths}
            return [p["title"] for p in paths]
        except Exception:
            defaults = ["Basic Finance", "Investing", "Real Estate", "Cryptocurrency"]
            self.path_links = {
                p.lower(): f"/all-topics#{p.lower().replace(' ', '-')}" for p in defaults
            }
            return defaults

    def is_greeting(self, text: str) -> bool:
        greetings = {
            "hello",
            "hi",
            "hey",
            "greetings",
            "good morning",
            "good afternoon",
            "good evening",
        }
        return text.lower().strip() in greetings

    def is_reset_query(self, text: str) -> bool:
        return any(
            t in text.lower()
            for t in ["start over", "clear chat", "reset", "new chat", "clear history"]
        )

    # ------------------------------------------------------------------
    # Main handler
    # ------------------------------------------------------------------

    def handle(self):
        prompt = self.request.data.get("inputs", "").strip()
        parameters = self.request.data.get("parameters", {})
        source = str(self.request.data.get("source") or "chat")[:64]
        exercise_context = self.request.data.get("exercise_context")
        request_id = getattr(self.request, "request_id", None)

        if len(prompt) > getattr(settings, "OPENAI_MAX_PROMPT_CHARS", 4000):
            return {"error": "Prompt is too long."}, status.HTTP_413_REQUEST_ENTITY_TOO_LARGE

        if not prompt:
            return {"error": "Prompt is required."}, 400

        # Idempotency
        idempotency_key = (
            self.request.headers.get("Idempotency-Key")
            or self.request.headers.get("X-Idempotency-Key")
            or self.request.data.get("idempotency_key")
        )
        idem_cache_key = idem_lock_key = None
        if idempotency_key:
            idempotency_key = str(idempotency_key).strip()[:128]
            idem_cache_key = f"openai:idem:{self.user.id}:{idempotency_key}"
            if cached := cache.get(idem_cache_key):
                return cached, 200
            idem_lock_key = f"{idem_cache_key}:lock"
            if not cache.add(
                idem_lock_key, 1, timeout=getattr(settings, "OPENAI_IDEMPOTENCY_TTL_SECONDS", 300)
            ):
                if cached := cache.get(idem_cache_key):
                    return cached, 200
                return {"error": "Request already in progress.", "request_id": request_id}, 409

        try:
            # Entitlement check
            allowed, entitlement_meta = self.check_and_consume_entitlement(self.user, "ai_tutor")
            if not allowed:
                status_code = (
                    status.HTTP_402_PAYMENT_REQUIRED
                    if entitlement_meta.get("reason") == "upgrade"
                    else status.HTTP_429_TOO_MANY_REQUESTS
                )
                return (
                    {
                        "error": entitlement_meta.get("error", "AI tutor unavailable."),
                        **entitlement_meta,
                    },
                    status_code,
                )

            # Quick-reply shortcuts (no LLM call)
            if self.path_links is None:
                self.get_available_paths()

            if self.is_greeting(prompt):
                return {
                    "response": "Hi! I'm your Garzoni finance tutor. What would you like to learn today?"
                }, 200

            if self.is_reset_query(prompt):
                # Archive the old conversation
                from support.models import Conversation

                Conversation.objects.filter(user=self.user, source=source).update(
                    source=f"{source}_archived"
                )
                return {
                    "response": "Conversation reset. What financial topic shall we tackle?"
                }, 200

            if not self._check_token_budget():
                return {"error": "Daily AI usage limit reached. Resets at midnight UTC."}, 429

            # Load / create persistent conversation
            conversation = self._get_or_create_conversation(source)
            self._conversation_summary = conversation.summary

            client = _get_openai_client()
            model = _model_for_user(self.user)

            # Build system prompt
            education_context = self._build_education_context()
            if education_context:
                system_content = TUTOR_SYSTEM_WITH_CONTEXT.format(
                    education_context=education_context
                )
            else:
                system_content = TUTOR_SYSTEM

            if exercise_context and isinstance(exercise_context, dict):
                ex_q = str(exercise_context.get("question") or "").strip()
                ex_ua = str(exercise_context.get("user_answer") or "").strip()
                if ex_q:
                    system_content += f"\n\nCurrent exercise: {ex_q}"
                    if ex_ua:
                        system_content += f"\nStudent's answer: {ex_ua}"
                    system_content += "\nGive a helpful hint — do NOT reveal the answer."

            # Persist user message
            self._save_message(conversation, "user", prompt)

            # Assemble messages for API call
            history = self._load_history(conversation)
            messages = [{"role": "system", "content": system_content}] + history

            # Agentic tool-use loop
            result_text = None
            tokens_total = 0
            for _round in range(_MAX_TOOL_ROUNDS):
                resp = client.chat.completions.create(
                    model=model,
                    messages=messages,
                    tools=TOOL_DEFINITIONS,
                    tool_choice="auto",
                    max_tokens=getattr(settings, "OPENAI_MAX_TOKENS", 512),
                    temperature=float(parameters.get("temperature", 0.5)),
                )
                usage = getattr(resp, "usage", None)
                if usage:
                    tokens_total += getattr(usage, "total_tokens", 0)

                choice = resp.choices[0]
                finish = choice.finish_reason

                if finish == "tool_calls":
                    # Execute each tool call
                    tool_calls = choice.message.tool_calls or []
                    # Append assistant message with tool_calls to conversation
                    assistant_msg: Dict[str, Any] = {
                        "role": "assistant",
                        "content": choice.message.content or "",
                        "tool_calls": [
                            {
                                "id": tc.id,
                                "type": "function",
                                "function": {
                                    "name": tc.function.name,
                                    "arguments": tc.function.arguments,
                                },
                            }
                            for tc in tool_calls
                        ],
                    }
                    messages.append(assistant_msg)
                    # Persist raw assistant content (without tool_calls detail for readability)
                    self._save_message(
                        conversation,
                        "assistant",
                        choice.message.content
                        or f"[tool calls: {', '.join(tc.function.name for tc in tool_calls)}]",
                    )

                    for tc in tool_calls:
                        try:
                            args = json.loads(tc.function.arguments or "{}")
                        except json.JSONDecodeError:
                            args = {}
                        tool_result = dispatch_tool(tc.function.name, args, self.user)
                        result_str = json.dumps(tool_result)
                        tool_msg = {
                            "role": "tool",
                            "tool_call_id": tc.id,
                            "name": tc.function.name,
                            "content": result_str,
                        }
                        messages.append(tool_msg)
                        self._save_message(
                            conversation,
                            "tool",
                            result_str,
                            tool_call_id=tc.id,
                            tool_name=tc.function.name,
                        )
                    continue

                # Final answer
                result_text = (choice.message.content or "").strip()
                break

            if not result_text:
                result_text = "I had trouble generating a response. Please try again."

            # Persist assistant reply
            self._save_message(conversation, "assistant", result_text)

            # Update token counter on conversation
            if tokens_total:
                conversation.total_tokens = (conversation.total_tokens or 0) + tokens_total
                conversation.save(update_fields=["total_tokens"])
                self._consume_tokens(tokens_total)
                self._maybe_summarise(conversation, client)

            logger.info(
                "ai_tutor_request user=%s source=%s tokens=%s model=%s",
                self.user.id,
                source,
                tokens_total,
                model,
            )

            result = {"response": result_text, "conversation_id": conversation.id}
            if idem_cache_key:
                cache.set(
                    idem_cache_key,
                    result,
                    timeout=getattr(settings, "OPENAI_IDEMPOTENCY_TTL_SECONDS", 300),
                )
            return result, 200

        except Exception:
            logger.error("openai_unexpected_error request_id=%s", request_id, exc_info=True)
            return {"error": "Unexpected server error.", "request_id": request_id}, 500
        finally:
            if idem_lock_key:
                cache.delete(idem_lock_key)


# ---------------------------------------------------------------------------
# Conversation history endpoint helper
# ---------------------------------------------------------------------------


def get_conversation_history(user, source: str = "chat", limit: int = 50) -> List[Dict]:
    """Return recent messages for a user's conversation (for scrollback UI)."""
    from support.models import Conversation

    conv = Conversation.objects.filter(user=user, source=source).order_by("-updated_at").first()
    if not conv:
        return []
    rows = conv.messages.order_by("-created_at")[:limit]
    return [
        {
            "role": m.role,
            "content": m.content,
            "created_at": m.created_at.isoformat(),
        }
        for m in reversed(list(rows))
        if m.role in ("user", "assistant")
    ]

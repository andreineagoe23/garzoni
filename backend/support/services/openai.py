import hashlib
import json
import logging
import re

import requests
from django.conf import settings
from django.core.cache import cache
from rest_framework import status

from authentication.models import UserProfile
from education.models import Path, UserProgress

logger = logging.getLogger(__name__)


class OpenAIService:
    def __init__(self, request, request_with_backoff, check_and_consume_entitlement):
        self.request = request
        self.user = request.user
        self.request_with_backoff = request_with_backoff
        self.check_and_consume_entitlement = check_and_consume_entitlement
        self.path_links = None

    def is_greeting(self, text):
        greetings = [
            "hello",
            "hi",
            "hey",
            "greetings",
            "good morning",
            "good afternoon",
            "good evening",
        ]
        return text.lower().strip() in greetings

    def is_path_query(self, text):
        path_terms = ["path", "course", "learn", "study", "curriculum", "track"]
        return any(term in text.lower() for term in path_terms)

    def is_recommendation_query(self, text):
        recommend_terms = [
            "recommend",
            "suggest",
            "what should",
            "which",
            "best",
            "next course",
        ]
        return any(term in text.lower() for term in recommend_terms)

    def is_reset_query(self, text):
        reset_terms = ["start over", "clear chat", "reset", "new chat", "clear history"]
        return any(term in text.lower() for term in reset_terms)

    def get_available_paths(self):
        try:
            paths = Path.objects.all().values("title", "id")
            self.path_links = {p["title"].lower(): f"/all-topics#{p['id']}" for p in paths}
            return [p["title"] for p in paths]
        except Exception as exc:
            logger.error("Error retrieving learning paths: %s", exc)
            default_paths = ["Basic Finance", "Investing", "Real Estate", "Cryptocurrency"]
            self.path_links = {
                p.lower(): f"/all-topics#{p.lower().replace(' ', '-')}" for p in default_paths
            }
            return default_paths

    def format_paths_for_message(self):
        paths = self.get_available_paths()
        if not paths:
            return "various financial topics"
        return ", ".join(paths)

    def recommend_path(self, user):
        try:
            profile = UserProfile.objects.get(user=user)

            if hasattr(profile, "experience_level"):
                if profile.experience_level == "beginner":
                    return (
                        "Based on your profile, I recommend starting with our Basic Finance "
                        "path to build a solid foundation."
                    )
                if profile.experience_level == "intermediate":
                    return (
                        "With your intermediate knowledge, our Investing path would be a great "
                        "next step to grow your wealth."
                    )
                return (
                    "Given your advanced experience, exploring our Real Estate or Cryptocurrency "
                    "paths could provide valuable insights."
                )

            return (
                "I recommend starting with our Basic Finance path to build a strong foundation. "
                f"We also offer paths in {self.format_paths_for_message()}."
            )
        except Exception as exc:
            logger.error("Error generating recommendation: %s", exc)
            return (
                "I recommend exploring our learning paths: "
                f"{self.format_paths_for_message()}. Basic Finance is a great place to start!"
            )

    def get_path_from_query(self, text):
        if self.path_links is None:
            self.get_available_paths()

        text_lower = text.lower()
        for path_name in self.path_links.keys():
            if path_name in text_lower:
                return path_name
        return None

    def is_finance_related(self, text):
        finance_terms = [
            "money",
            "finance",
            "budget",
            "invest",
            "stock",
            "market",
            "fund",
            "saving",
            "retirement",
            "income",
            "expense",
            "debt",
            "credit",
            "loan",
            "mortgage",
            "interest",
            "dividend",
            "portfolio",
            "tax",
            "inflation",
            "economy",
            "financial",
            "bank",
            "crypto",
            "bitcoin",
            "ethereum",
        ]
        return any(term in text for term in finance_terms)

    def add_financial_context(self, prompt):
        financial_context = (
            "You are a helpful and knowledgeable financial assistant. "
            "Provide accurate, concise information about personal finance, investing, "
            "budgeting, and financial education. Focus on educational content "
            "rather than specific investment advice. Your responses should be "
            "clear, direct, and factual without unnecessary introductions or "
            "self-references.\n\n"
        )

        if "User:" in prompt and "AI:" in prompt:
            parts = prompt.split("User:", 1)
            return financial_context + "User:" + parts[1]
        return financial_context + prompt

    def get_user_context(self, user):
        try:
            context_parts = []

            try:
                profile = UserProfile.objects.get(user=user)
                if hasattr(profile, "points"):
                    context_parts.append(f"The user has {profile.points} points in their account.")

                user_progress = UserProgress.objects.filter(user=user)
                if user_progress.exists():
                    paths = set()
                    for progress in user_progress:
                        if progress.course and progress.course.path:
                            paths.add(progress.course.path.title)
                    if paths:
                        context_parts.append(
                            f"The user is currently following these learning paths: {', '.join(paths)}."
                        )

                completed_lessons = user_progress.filter(is_course_complete=True).count()
                if completed_lessons > 0:
                    context_parts.append(f"The user has completed {completed_lessons} courses.")

                if hasattr(profile, "experience_level") and profile.experience_level:
                    context_parts.append(
                        f"The user's financial experience level is: {profile.experience_level}."
                    )
            except (UserProfile.DoesNotExist, Exception):
                pass

            if context_parts:
                return "User context: " + " ".join(context_parts)
            return None
        except Exception as exc:
            logger.error("Error getting user context: %s", exc)
            return None

    def clean_response(self, response_text):
        if response_text is None:
            return ""
        response_text = str(response_text)
        if "User:" in response_text:
            response_text = response_text.split("User:", 1)[0].strip()
        if "Human:" in response_text:
            response_text = response_text.split("Human:", 1)[0].strip()
        return response_text.strip()

    def handle(self):
        prompt = self.request.data.get("inputs", "").strip()
        parameters = self.request.data.get("parameters", {})
        chat_history = self.request.data.get("chatHistory", [])
        request_id = getattr(self.request, "request_id", None)

        if len(prompt) > settings.OPENAI_MAX_PROMPT_CHARS:
            return {
                "error": "Prompt is too long.",
                "max_chars": settings.OPENAI_MAX_PROMPT_CHARS,
                "request_id": request_id,
            }, status.HTTP_413_REQUEST_ENTITY_TOO_LARGE

        if chat_history and not isinstance(chat_history, list):
            return {"error": "Invalid chatHistory.", "request_id": request_id}, 400
        if isinstance(chat_history, list) and len(chat_history) > settings.OPENAI_MAX_MESSAGES:
            chat_history = chat_history[-settings.OPENAI_MAX_MESSAGES :]

        if not prompt:
            return {"error": "Prompt is required."}, 400

        idempotency_key = (
            self.request.headers.get("Idempotency-Key")
            or self.request.headers.get("X-Idempotency-Key")
            or self.request.data.get("idempotency_key")
        )
        if idempotency_key is not None:
            idempotency_key = str(idempotency_key).strip()
            if not idempotency_key or len(idempotency_key) > 128:
                return {"error": "Invalid Idempotency-Key.", "request_id": request_id}, 400

        idem_cache_key = None
        idem_lock_key = None
        if idempotency_key:
            idem_cache_key = f"openai:idem:{self.user.id}:{idempotency_key}"
            cached_idem = cache.get(idem_cache_key)
            if cached_idem:
                return cached_idem, 200

            idem_lock_key = f"{idem_cache_key}:lock"
            if not cache.add(idem_lock_key, 1, timeout=settings.OPENAI_IDEMPOTENCY_TTL_SECONDS):
                cached_idem = cache.get(idem_cache_key)
                if cached_idem:
                    return cached_idem, 200
                return {"error": "Request already in progress.", "request_id": request_id}, 409

        cache_ttl = int(getattr(settings, "OPENAI_CACHE_TTL_SECONDS", 0) or 0)
        if settings.DEBUG and cache_ttl <= 0:
            cache_ttl = 300
        cache_key = None

        try:
            allowed, entitlement_meta = self.check_and_consume_entitlement(self.user, "ai_tutor")
            if not allowed:
                status_code = (
                    status.HTTP_402_PAYMENT_REQUIRED
                    if entitlement_meta.get("reason") == "upgrade"
                    else status.HTTP_429_TOO_MANY_REQUESTS
                )
                return (
                    {
                        "error": entitlement_meta.get(
                            "error", "AI tutor is not available for your plan."
                        ),
                        **entitlement_meta,
                    },
                    status_code,
                )

            if self.path_links is None:
                self.get_available_paths()

            if self.is_greeting(prompt):
                return {
                    "response": "Hi! I'm your financial assistant. What would you like to learn about today?"
                }, 200

            if self.is_reset_query(prompt):
                return {
                    "response": (
                        "I've reset our conversation. What financial topic would you like to discuss now?"
                    )
                }, 200

            specific_path = self.get_path_from_query(prompt)
            if specific_path:
                return {
                    "response": (
                        f"Our {specific_path.title()} path covers essential topics to help you master "
                        "this area of finance. Would you like to explore this learning path?"
                    ),
                    "link": {
                        "text": f"View {specific_path.title()} Path",
                        "path": self.path_links[specific_path],
                        "icon": "📚",
                    },
                }, 200

            if self.is_path_query(prompt):
                paths = self.format_paths_for_message()
                return {
                    "response": (
                        "I can help you explore our learning paths. "
                        f"We currently offer: {paths}. Which one interests you?"
                    ),
                    "links": [
                        {
                            "text": f"View {path.title()} Path",
                            "path": self.path_links.get(
                                path.lower(), f"/all-topics#{path.lower().replace(' ', '-')}"
                            ),
                            "icon": "📚",
                        }
                        for path in self.get_available_paths()
                    ],
                }, 200

            if self.is_recommendation_query(prompt):
                recommendation = self.recommend_path(self.user)
                return {
                    "response": recommendation,
                    "links": [
                        {
                            "text": f"View {path.title()} Path",
                            "path": self.path_links.get(
                                path.lower(), f"/all-topics#{path.lower().replace(' ', '-')}"
                            ),
                            "icon": "📚",
                        }
                        for path in self.get_available_paths()[:2]
                    ],
                }, 200

            if self.is_finance_related(prompt.lower()):
                prompt = self.add_financial_context(prompt)

            user_context = self.get_user_context(self.user)
            if user_context:
                prompt = f"{user_context}\n\n{prompt}"

            api_key = settings.OPENAI_API_KEY
            headers = {
                "Authorization": f"Bearer {api_key}" if api_key else "",
                "Content-Type": "application/json",
            }
            if not headers.get("Authorization") or headers["Authorization"].endswith(" "):
                logger.error("OPENAI_API_KEY is not configured.")
                return {"error": "AI service unavailable."}, 503

            messages = []
            available_paths = self.format_paths_for_message()
            messages.append(
                {
                    "role": "system",
                    "content": (
                        "You are a friendly, helpful financial assistant. Always reply with a clear, direct answer. "
                        "Keep responses to 2-4 short sentences. "
                        f"When relevant, you can mention we offer these learning paths: {available_paths}. "
                        "Answer general finance questions with accurate, educational info."
                    ),
                }
            )

            if chat_history and isinstance(chat_history, list):
                sanitized = []
                for item in chat_history:
                    if not isinstance(item, dict):
                        continue
                    role = item.get("role")
                    content = item.get("content")
                    if role not in {"user", "assistant", "system"} or not isinstance(content, str):
                        continue
                    content = content.strip()
                    if not content:
                        continue
                    if len(content) > settings.OPENAI_MAX_MESSAGE_CHARS:
                        content = content[: settings.OPENAI_MAX_MESSAGE_CHARS]
                    sanitized.append({"role": role, "content": content})
                    if len(sanitized) >= settings.OPENAI_MAX_MESSAGES:
                        break
                messages.extend(sanitized)
            else:
                messages.append({"role": "user", "content": prompt})

            default_model = (
                settings.OPENAI_ALLOWED_MODELS_CSV[0]
                if settings.OPENAI_ALLOWED_MODELS_CSV
                else "gpt-5-mini"
            )
            requested_model = str(parameters.get("model") or default_model)
            if requested_model not in settings.OPENAI_ALLOWED_MODELS_CSV:
                return {"error": "Model not allowed.", "request_id": request_id}, 400

            try:
                max_tokens = int(parameters.get("max_new_tokens", 256))
            except Exception:
                max_tokens = 256
            max_tokens = max(1, min(max_tokens, settings.OPENAI_MAX_TOKENS))

            temperature = parameters.get("temperature", 0.7)
            try:
                temperature = float(temperature)
            except Exception:
                temperature = 0.7
            temperature = max(0.0, min(temperature, 1.5))

            api_params = {
                "model": requested_model,
                "messages": messages,
                "temperature": temperature,
                "max_tokens": max_tokens,
            }

            if cache_ttl > 0:
                payload_hash = hashlib.sha256(
                    json.dumps(api_params, sort_keys=True, default=str).encode("utf-8")
                ).hexdigest()
                cache_key = f"openai:v1:{self.user.id}:{payload_hash}"
                cached = cache.get(cache_key)
                if cached:
                    return cached, 200

            try:
                result = self.request_with_backoff(
                    method="POST",
                    url="https://api.openai.com/v1/chat/completions",
                    headers=headers,
                    json=api_params,
                    allow_retry=bool(idem_cache_key),
                    max_attempts=3,
                )
                response = result.response
            except requests.Timeout:
                return {
                    "error": "AI service timed out. Please try again.",
                    "request_id": request_id,
                }, 504
            except requests.RequestException as exc:
                logger.warning("openai_request_failed request_id=%s err=%s", request_id, str(exc))
                return {"error": "AI service unavailable.", "request_id": request_id}, 502

            if response.status_code == 200:
                response_data = response.json()
                if "choices" in response_data and len(response_data["choices"]) > 0:
                    msg = response_data["choices"][0].get("message") or {}
                    cleaned_response = self.clean_response(msg.get("content"))
                    result = {
                        "response": cleaned_response
                        or "I could not generate a clear answer. Please try again."
                    }

                    if cache_key and cache_ttl > 0:
                        cache.set(cache_key, result, timeout=cache_ttl)
                    if idem_cache_key:
                        cache.set(
                            idem_cache_key,
                            result,
                            timeout=settings.OPENAI_IDEMPOTENCY_TTL_SECONDS,
                        )
                    return result, 200
                return {"error": "No valid response from the model.", "request_id": request_id}, 502

            logger.warning(
                "OpenAI non-200 request_id=%s status=%s body=%s",
                request_id,
                response.status_code,
                response.text[:200],
            )
            return {"error": "AI service error.", "request_id": request_id}, 502
        except Exception:
            logger.error("openai_unexpected_error request_id=%s", request_id, exc_info=True)
            return {"error": "Unexpected server error.", "request_id": request_id}, 500
        finally:
            if idem_lock_key:
                cache.delete(idem_lock_key)

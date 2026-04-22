"""
AI Tutor service — OpenAI-backed exercise feedback, hints, conversational chat,
path recommendations, and checkpoint question generation.

All functions degrade gracefully: return None / [] on failure so callers can
fall back to static strings without crashing.

Usage:
    from education.services.ai_tutor import generate_feedback, generate_hint, chat_stream
    from education.services.ai_tutor import generate_path_recommendations
    from education.services.ai_tutor import generate_checkpoint_questions
"""

from __future__ import annotations

import json
import logging
from typing import Any, Dict, Generator, List, Optional

import requests
from django.conf import settings

logger = logging.getLogger(__name__)

OPENAI_API_URL = "https://api.openai.com/v1/chat/completions"

# ---------------------------------------------------------------------------
# System prompts
# ---------------------------------------------------------------------------

_FEEDBACK_SYSTEM = (
    "You are Garzoni, a warm and encouraging personal finance tutor. "
    "Give concise, targeted feedback in 2–3 sentences. "
    "Identify the specific mistake and guide the student toward the correct concept. "
    "NEVER reveal the correct answer directly. "
    "Use simple, friendly language."
)

_HINT_SYSTEM = (
    "You are Garzoni, a patient personal finance tutor. "
    "Provide a single progressive hint based on the attempt number: "
    "Attempt 1 → conceptual nudge only (no numbers). "
    "Attempt 2 → mention the relevant formula or rule. "
    "Attempt 3+ → walk through the first calculation step without giving the final answer. "
    "NEVER reveal the final answer."
)

_CHAT_SYSTEM = (
    "You are Garzoni, a friendly personal finance tutor inside the Garzoni learning app.\n"
    'Student context: studying "{lesson_title}" at proficiency {proficiency}/100.\n'
    "Current exercise: {exercise_question}\n"
    "Answer context (DO NOT reveal directly): {correct_answer}\n\n"
    "Rules:\n"
    "- Be warm, encouraging, and Socratic.\n"
    "- NEVER give the answer outright — guide with hints and questions.\n"
    "- Keep responses to 3–5 sentences max.\n"
    "- Avoid jargon unless you are teaching it."
)

_PATH_SYSTEM = (
    "You are a curriculum advisor for Garzoni, a personal finance learning app. "
    "Given a student's onboarding answers and the list of available learning paths, "
    "rank the paths from most to least relevant for this student. "
    "Output ONLY a valid JSON array — no markdown, no explanation outside JSON: "
    '[{"title": "...", "reason": "one sentence"}, ...]'
)

_QUIZ_SYSTEM = (
    "You are an expert personal finance curriculum writer for Garzoni. "
    "Generate {n} novel comprehension questions based on the lesson content provided. "
    "Questions must NOT simply copy sentences from the text — they should test understanding. "
    "Each question is multiple-choice with exactly 4 options, exactly one correct. "
    "Output ONLY valid JSON — no markdown fences: "
    '[{{"question": "...", "choices": ["A","B","C","D"], "correct_answer": "A"}}, ...]'
)


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------


def _api_key() -> str:
    return (getattr(settings, "OPENAI_API_KEY", "") or "").strip()


def _post(
    messages: List[Dict],
    model: str = "gpt-4o-mini",
    temperature: float = 0.4,
    max_tokens: int = 512,
) -> Optional[str]:
    """Synchronous single-turn OpenAI call. Returns content string or None on error."""
    key = _api_key()
    if not key:
        logger.error("[ai_tutor] OPENAI_API_KEY not configured")
        return None

    payload: Dict[str, Any] = {
        "model": model,
        "messages": messages,
        "temperature": temperature,
        "max_tokens": max_tokens,
    }

    try:
        resp = requests.post(
            OPENAI_API_URL,
            headers={
                "Authorization": f"Bearer {key}",
                "Content-Type": "application/json",
            },
            json=payload,
            timeout=30,
        )
        resp.raise_for_status()
        data = resp.json()
        choices = data.get("choices") or []
        if choices:
            return (choices[0].get("message", {}).get("content") or "").strip()
        logger.warning("[ai_tutor] empty choices from OpenAI: %s", data)
        return None
    except requests.Timeout:
        logger.warning("[ai_tutor] OpenAI request timed out")
        return None
    except Exception as exc:
        logger.error("[ai_tutor] API error: %s", exc)
        return None


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


def generate_feedback(
    *,
    exercise_question: str,
    correct_answer: Any,
    user_answer: Any,
    is_correct: bool,
    exercise_type: str,
    misconception_tags: Optional[List] = None,
    error_patterns: Optional[List] = None,
    proficiency: int = 50,
) -> Optional[str]:
    """
    Generate targeted GPT feedback for an incorrect exercise submission.

    Returns None for correct answers (caller's static 'On point' is sufficient)
    or on API failure, so the caller can fall back to its static string.
    """
    if is_correct:
        return None

    tags = ", ".join(str(t) for t in (misconception_tags or [])) or "none"
    patterns = ", ".join(str(p) for p in (error_patterns or [])) or "none"

    prompt = (
        f"Exercise type: {exercise_type}\n"
        f"Question: {exercise_question}\n"
        f"Correct answer: {correct_answer}\n"
        f"Student answered: {user_answer}\n"
        f"Known misconception tags: {tags}\n"
        f"Known error patterns: {patterns}\n"
        f"Student proficiency: {proficiency}/100\n\n"
        "Give targeted feedback to help the student understand what went wrong."
    )

    return _post(
        [
            {"role": "system", "content": _FEEDBACK_SYSTEM},
            {"role": "user", "content": prompt},
        ],
        temperature=0.3,
        max_tokens=150,
    )


def generate_hint(
    *,
    exercise_question: str,
    exercise_type: str,
    correct_answer: Any,
    attempt_number: int,
    user_answer_so_far: Any = None,
    misconception_tags: Optional[List] = None,
    error_patterns: Optional[List] = None,
) -> Optional[str]:
    """
    Return a progressively more specific hint. attempt_number should be 1, 2, or 3+.
    Returns None on API failure.
    """
    tags = ", ".join(str(t) for t in (misconception_tags or [])) or "none"
    patterns = ", ".join(str(p) for p in (error_patterns or [])) or "none"

    prompt = (
        f"Exercise type: {exercise_type}\n"
        f"Question: {exercise_question}\n"
        f"Attempt number: {attempt_number}\n"
        f"Student's current answer: {user_answer_so_far}\n"
        f"Known misconception tags: {tags}\n"
        f"Known error patterns: {patterns}\n\n"
        "Give the appropriate level of hint for this attempt."
    )

    return _post(
        [
            {"role": "system", "content": _HINT_SYSTEM},
            {"role": "user", "content": prompt},
        ],
        temperature=0.4,
        max_tokens=120,
    )


def chat_stream(
    *,
    message: str,
    lesson_title: str,
    exercise_question: str,
    correct_answer: Any,
    proficiency: int,
    conversation_history: List[Dict],
) -> Generator[str, None, None]:
    """
    Stream SSE token chunks for the conversational tutor.
    Yields bare text strings; the caller wraps them in SSE `data:` lines.
    Falls back to a single error string on API failure.
    """
    key = _api_key()
    if not key:
        yield "I'm not available right now. Please try again later."
        return

    system = _CHAT_SYSTEM.format(
        lesson_title=lesson_title,
        proficiency=proficiency,
        exercise_question=exercise_question or "no specific exercise",
        correct_answer=correct_answer or "n/a",
    )

    messages: List[Dict] = [{"role": "system", "content": system}]
    for turn in (conversation_history or [])[-10:]:
        role = turn.get("role")
        content = turn.get("content")
        if role in ("user", "assistant") and content:
            messages.append({"role": role, "content": str(content)})
    messages.append({"role": "user", "content": message})

    payload: Dict[str, Any] = {
        "model": "gpt-4o-mini",
        "messages": messages,
        "temperature": 0.6,
        "max_tokens": 300,
        "stream": True,
    }

    try:
        with requests.post(
            OPENAI_API_URL,
            headers={
                "Authorization": f"Bearer {key}",
                "Content-Type": "application/json",
            },
            json=payload,
            stream=True,
            timeout=60,
        ) as resp:
            resp.raise_for_status()
            for raw_line in resp.iter_lines():
                if not raw_line:
                    continue
                line = raw_line.decode("utf-8") if isinstance(raw_line, bytes) else raw_line
                if not line.startswith("data: "):
                    continue
                data = line[6:]
                if data.strip() == "[DONE]":
                    break
                try:
                    chunk = json.loads(data)
                    token = chunk["choices"][0].get("delta", {}).get("content")
                    if token:
                        yield token
                except (json.JSONDecodeError, KeyError, IndexError):
                    continue
    except Exception as exc:
        logger.error("[ai_tutor] stream error: %s", exc)
        yield "I had trouble responding. Please try again."


def generate_path_recommendations(
    *,
    answers: Dict[str, Any],
    paths: List[Dict[str, str]],
) -> List[Dict[str, str]]:
    """
    Ask GPT to rank learning paths given a student's onboarding answers.

    Returns a list of {title, reason} dicts ordered most-to-least relevant,
    or an empty list on failure (caller falls back to keyword matching).
    """
    if not answers or not paths:
        return []

    path_list = "\n".join(f"- {p['title']}: {p.get('description', '').strip()}" for p in paths)
    answers_text = json.dumps(answers, indent=2)

    prompt = (
        f"Student onboarding answers:\n{answers_text}\n\n"
        f"Available learning paths:\n{path_list}\n\n"
        "Rank the paths from most to least relevant for this student."
    )

    raw = _post(
        [
            {"role": "system", "content": _PATH_SYSTEM},
            {"role": "user", "content": prompt},
        ],
        temperature=0.2,
        max_tokens=600,
    )
    if not raw:
        return []
    try:
        result = json.loads(raw)
        if isinstance(result, list):
            return result
    except json.JSONDecodeError:
        logger.warning("[ai_tutor] path recommendation JSON parse failed: %.200s", raw)
    return []


def generate_checkpoint_questions(
    *,
    section_content: str,
    lesson_title: str,
    n: int = 3,
) -> List[Dict[str, Any]]:
    """
    Generate n novel comprehension questions from a lesson section's text content.

    Returns a list of {question, choices, correct_answer} dicts,
    or an empty list on failure.
    """
    if not (section_content or "").strip():
        return []

    system = _QUIZ_SYSTEM.format(n=n)
    prompt = (
        f"Lesson title: {lesson_title}\n\n"
        f"Content:\n{section_content[:3000]}\n\n"
        f"Generate {n} comprehension questions."
    )

    raw = _post(
        [
            {"role": "system", "content": system},
            {"role": "user", "content": prompt},
        ],
        temperature=0.5,
        max_tokens=900,
    )
    if not raw:
        return []
    try:
        result = json.loads(raw)
        if isinstance(result, list):
            return result
    except json.JSONDecodeError:
        logger.warning("[ai_tutor] checkpoint question JSON parse failed: %.200s", raw)
    return []

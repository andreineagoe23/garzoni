"""
AI Tutor service — OpenAI SDK, exercise feedback/hints, path recommendations,
checkpoint question generation.

All public functions degrade gracefully (return None / []) on failure.
"""

from __future__ import annotations

import json
import logging
from typing import Any, Dict, Generator, List, Optional

from django.conf import settings

from support.prompts.tutor import (
    FEEDBACK_SYSTEM,
    HINT_SYSTEM,
    PATH_SYSTEM,
    QUIZ_SYSTEM,
    PRACTICE_QUESTION_SYSTEM,
)

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------


def _get_client():
    from openai import OpenAI

    return OpenAI(api_key=settings.OPENAI_API_KEY)


def _default_model() -> str:
    allowed = getattr(settings, "OPENAI_ALLOWED_MODELS_CSV", ["gpt-4o-mini"])
    return allowed[0] if allowed else "gpt-4o-mini"


def _post(
    messages: List[Dict],
    model: Optional[str] = None,
    temperature: float = 0.4,
    max_tokens: int = 512,
) -> Optional[str]:
    """Single-turn synchronous call via SDK. Returns content string or None."""
    if not getattr(settings, "OPENAI_API_KEY", ""):
        logger.error("[ai_tutor] OPENAI_API_KEY not configured")
        return None
    try:
        client = _get_client()
        resp = client.chat.completions.create(
            model=model or _default_model(),
            messages=messages,
            temperature=temperature,
            max_tokens=max_tokens,
        )
        return (resp.choices[0].message.content or "").strip() or None
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
            {"role": "system", "content": FEEDBACK_SYSTEM},
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
            {"role": "system", "content": HINT_SYSTEM},
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
    """Stream SSE token chunks for the conversational tutor."""
    if not getattr(settings, "OPENAI_API_KEY", ""):
        yield "I'm not available right now. Please try again later."
        return

    from support.prompts.tutor import TUTOR_SYSTEM

    system = (
        TUTOR_SYSTEM
        + f"\n\nStudent context: studying '{lesson_title}' at proficiency {proficiency}/100."
        + f"\nCurrent exercise: {exercise_question or 'no specific exercise'}"
        + "\nAnswer context (DO NOT reveal directly): "
        + str(correct_answer or "n/a")
    )

    messages: List[Dict] = [{"role": "system", "content": system}]
    for turn in (conversation_history or [])[-10:]:
        role = turn.get("role")
        content = turn.get("content")
        if role in ("user", "assistant") and content:
            messages.append({"role": role, "content": str(content)})
    messages.append({"role": "user", "content": message})

    try:
        client = _get_client()
        stream = client.chat.completions.create(
            model=_default_model(),
            messages=messages,
            temperature=0.6,
            max_tokens=300,
            stream=True,
        )
        for chunk in stream:
            token = (chunk.choices[0].delta.content or "") if chunk.choices else ""
            if token:
                yield token
    except Exception as exc:
        logger.error("[ai_tutor] stream error: %s", exc)
        yield "I had trouble responding. Please try again."


def generate_path_recommendations(
    *,
    answers: Dict[str, Any],
    paths: List[Dict[str, str]],
    mastery_context: Optional[str] = None,
) -> List[Dict[str, str]]:
    """
    Rank learning paths given onboarding answers and optional mastery context.
    Returns [{title, reason}, ...] or [] on failure.
    """
    if not answers or not paths:
        return []

    path_list = "\n".join(f"- {p['title']}: {p.get('description', '').strip()}" for p in paths)
    answers_text = json.dumps(answers, indent=2)
    extra = f"\nStudent mastery summary: {mastery_context}" if mastery_context else ""

    prompt = (
        f"Student onboarding answers:\n{answers_text}{extra}\n\n"
        f"Available learning paths:\n{path_list}\n\n"
        "Rank the paths from most to least relevant for this student."
    )
    raw = _post(
        [
            {"role": "system", "content": PATH_SYSTEM},
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
    if not (section_content or "").strip():
        return []

    system = QUIZ_SYSTEM.format(n=n)
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


def generate_exercise_explanation(
    *,
    exercise_question: str,
    exercise_type: str,
    correct_answer: Any,
    user_answer: Any,
    skill: Optional[str] = None,
    proficiency: int = 50,
) -> Optional[Dict[str, Any]]:
    """
    Generate a Socratic explanation for a wrong answer plus one follow-up practice question.
    Returns {"explanation": str, "practice_question": dict | None} or None on failure.
    """
    from support.prompts.tutor import EXERCISE_EXPLAIN_SYSTEM

    prompt = (
        f"Exercise type: {exercise_type}\n"
        f"Question: {exercise_question}\n"
        f"Correct answer: {correct_answer}\n"
        f"Student answered: {user_answer}\n"
        f"Skill: {skill or 'general finance'}\n"
        f"Student proficiency: {proficiency}/100\n\n"
        "Explain what went wrong using the Socratic method. End with one follow-up question."
    )
    explanation = _post(
        [
            {"role": "system", "content": EXERCISE_EXPLAIN_SYSTEM},
            {"role": "user", "content": prompt},
        ],
        temperature=0.4,
        max_tokens=300,
    )
    if not explanation:
        return None

    # Generate a follow-up practice question on the same skill
    practice = None
    if skill:
        difficulty = max(1, min(5, int(proficiency / 20)))
        system = PRACTICE_QUESTION_SYSTEM.format(skill=skill, difficulty=difficulty)
        raw = _post(
            [
                {"role": "system", "content": system},
                {"role": "user", "content": f"Generate a practice question about {skill}."},
            ],
            temperature=0.6,
            max_tokens=400,
        )
        if raw:
            try:
                practice = json.loads(raw)
            except json.JSONDecodeError:
                practice = {"question": raw, "type": "open"}

    return {"explanation": explanation, "practice_question": practice}


def generate_coach_brief(*, user) -> Optional[str]:
    """Generate a weekly coaching brief for a user."""
    from support.prompts.tutor import COACH_BRIEF_SYSTEM
    from education.models import Mastery, UserProgress
    from django.utils import timezone

    try:
        week_ago = timezone.now() - timezone.timedelta(days=7)

        # Gather stats
        completed_this_week = UserProgress.objects.filter(
            user=user,
            course_completed_at__gte=week_ago,
        ).count()

        weak_skills = list(
            Mastery.objects.filter(user=user)
            .order_by("proficiency")
            .values("skill", "proficiency")[:3]
        )
        streak = getattr(getattr(user, "profile", None), "streak", 0)

        profile = getattr(user, "profile", None)
        recommended = getattr(profile, "recommended_courses", []) if profile else []

        data = {
            "courses_completed_this_week": completed_this_week,
            "streak_days": streak,
            "weak_skills": weak_skills,
            "recommended_course_ids": recommended[:3],
        }

        try:
            from onboarding.models import QuestionnaireProgress

            q = QuestionnaireProgress.objects.filter(user=user).first()
            if q and q.answers:
                data["primary_goal"] = q.answers.get("primary_goal")
        except Exception:
            pass

        return _post(
            [
                {"role": "system", "content": COACH_BRIEF_SYSTEM},
                {"role": "user", "content": json.dumps(data, indent=2)},
            ],
            temperature=0.7,
            max_tokens=350,
        )
    except Exception as exc:
        logger.error("[ai_tutor] coach_brief error: %s", exc)
        return None


def generate_push_nudge(*, user) -> Optional[str]:
    """Generate a personalised push notification message for a user."""
    from support.prompts.tutor import NUDGE_SYSTEM
    from education.models import Mastery, UserProgress
    from django.utils import timezone

    try:
        weak = Mastery.objects.filter(user=user).order_by("proficiency").first()
        streak = getattr(getattr(user, "profile", None), "streak", 0)
        plan = None
        try:
            from authentication.entitlements import get_user_plan

            plan = get_user_plan(user)
        except Exception:
            pass

        context = {
            "streak": streak,
            "weakest_skill": weak.skill if weak else None,
            "weakest_skill_proficiency": weak.proficiency if weak else None,
            "plan": plan,
        }
        return _post(
            [
                {"role": "system", "content": NUDGE_SYSTEM},
                {"role": "user", "content": json.dumps(context)},
            ],
            temperature=0.8,
            max_tokens=40,
        )
    except Exception as exc:
        logger.error("[ai_tutor] nudge error: %s", exc)
        return None

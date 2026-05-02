"""
OpenAI function-calling tool definitions and their server-side dispatch.
Each tool returns a plain dict that gets serialised as the tool_result content.
"""

from __future__ import annotations

import json
import logging
from typing import Any, Dict, List, Optional

from django.contrib.auth.models import User

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Tool schemas (passed to the OpenAI API as `tools=`)
# ---------------------------------------------------------------------------

TOOL_DEFINITIONS: List[Dict] = [
    {
        "type": "function",
        "function": {
            "name": "get_user_progress",
            "description": (
                "Retrieve the student's current learning progress: streak, completed courses, "
                "currently active course, and completion percentage."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "course_id": {
                        "type": "integer",
                        "description": "Optional. Limit progress to a specific course.",
                    }
                },
                "required": [],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_weak_skills",
            "description": (
                "Return the student's weakest skills by proficiency score so you can "
                "suggest targeted practice."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "limit": {
                        "type": "integer",
                        "description": "Number of weak skills to return (default 5).",
                    }
                },
                "required": [],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_financial_profile",
            "description": (
                "Retrieve the student's financial profile: goals, risk comfort, income range, "
                "investing experience, savings rate."
            ),
            "parameters": {"type": "object", "properties": {}, "required": []},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "recommend_next_lesson",
            "description": (
                "Find the single best next lesson for the student to do right now, "
                "considering their path, mastery gaps, and completion history."
            ),
            "parameters": {"type": "object", "properties": {}, "required": []},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "generate_practice_question",
            "description": (
                "Generate one fresh practice question for a given skill and difficulty. "
                "Returns question text, answer choices, correct answer, and a brief explanation."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "skill": {
                        "type": "string",
                        "description": "The skill or topic to generate a question about.",
                    },
                    "difficulty": {
                        "type": "integer",
                        "description": "Difficulty 1 (easy) to 5 (hard).",
                    },
                },
                "required": ["skill", "difficulty"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "lookup_lesson",
            "description": (
                "Semantic search over Garzoni's lesson library. Use this when a student asks "
                "about a topic to find the most relevant lessons/courses to recommend."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "Natural-language description of the topic to find.",
                    },
                    "top_k": {
                        "type": "integer",
                        "description": "Number of results to return (default 3).",
                    },
                },
                "required": ["query"],
            },
        },
    },
]


# ---------------------------------------------------------------------------
# Dispatch: call the right DB / service function for each tool name
# ---------------------------------------------------------------------------


def dispatch_tool(tool_name: str, arguments: Dict, user: User) -> Dict:
    """
    Execute a tool call server-side. Returns a JSON-serialisable dict.
    Never raises — returns an error dict on failure so the model can handle it.
    """
    try:
        if tool_name == "get_user_progress":
            return _get_user_progress(user, arguments.get("course_id"))
        if tool_name == "get_weak_skills":
            return _get_weak_skills(user, int(arguments.get("limit", 5)))
        if tool_name == "get_financial_profile":
            return _get_financial_profile(user)
        if tool_name == "recommend_next_lesson":
            return _recommend_next_lesson(user)
        if tool_name == "generate_practice_question":
            return _generate_practice_question(
                arguments.get("skill", ""),
                int(arguments.get("difficulty", 3)),
            )
        if tool_name == "lookup_lesson":
            return _lookup_lesson(
                arguments.get("query", ""),
                int(arguments.get("top_k", 3)),
            )
        return {"error": f"Unknown tool: {tool_name}"}
    except Exception as exc:
        logger.warning("tool_dispatch_error tool=%s err=%s", tool_name, exc)
        return {"error": str(exc)}


# ---------------------------------------------------------------------------
# Tool implementations
# ---------------------------------------------------------------------------


def _get_user_progress(user: User, course_id: Optional[int] = None) -> Dict:
    from education.models import UserProgress

    try:
        profile = getattr(user, "profile", None)
        streak = getattr(profile, "streak", 0) if profile else 0

        qs = UserProgress.objects.filter(user=user).select_related("course", "course__path")
        if course_id:
            qs = qs.filter(course_id=course_id)

        completed_count = qs.filter(is_course_complete=True).count()
        active = qs.order_by("-last_course_activity_date").first()
        active_info = None
        if active and active.course:
            active_info = {
                "course": active.course.title,
                "path": active.course.path.title if active.course.path else None,
                "is_complete": active.is_course_complete,
                "last_activity": (
                    active.last_course_activity_date.isoformat()
                    if active.last_course_activity_date
                    else None
                ),
            }

        return {
            "streak_days": streak,
            "completed_courses": completed_count,
            "active_course": active_info,
        }
    except Exception as exc:
        logger.warning("get_user_progress error: %s", exc)
        return {"error": str(exc)}


def _get_weak_skills(user: User, limit: int = 5) -> Dict:
    from education.models import Mastery

    try:
        skills = list(
            Mastery.objects.filter(user=user)
            .order_by("proficiency")
            .values("skill", "proficiency")[:limit]
        )
        return {"weak_skills": skills}
    except Exception as exc:
        return {"error": str(exc)}


def _get_financial_profile(user: User) -> Dict:
    try:
        profile = getattr(user, "profile", None)
        if not profile:
            return {"error": "No profile found"}

        data: Dict[str, Any] = {}
        for field in (
            "goal_types",
            "timeframe",
            "risk_comfort",
            "income_range",
            "savings_rate_estimate",
            "investing_experience",
        ):
            val = getattr(profile, field, None)
            if val is not None:
                data[field] = val

        try:
            from onboarding.models import QuestionnaireProgress

            q = QuestionnaireProgress.objects.filter(user=user).first()
            if q and q.answers:
                data["onboarding_goals"] = q.answers.get("primary_goal")
                data["biggest_challenge"] = q.answers.get("biggest_challenge")
        except Exception:
            pass

        return data or {"note": "No financial profile data found"}
    except Exception as exc:
        return {"error": str(exc)}


def _recommend_next_lesson(user: User) -> Dict:
    from education.models import UserProgress, Mastery

    try:
        profile = getattr(user, "profile", None)
        recommended = getattr(profile, "recommended_courses", []) if profile else []

        # Find the first recommended course that isn't complete
        if recommended:
            from education.models import Course

            for course_id in recommended:
                progress = UserProgress.objects.filter(user=user, course_id=course_id).first()
                if not progress or not progress.is_course_complete:
                    try:
                        course = Course.objects.select_related("path").get(id=course_id)
                        return {
                            "course_id": course.id,
                            "course_title": course.title,
                            "path": course.path.title if course.path else None,
                            "reason": "next on your personalized path",
                        }
                    except Course.DoesNotExist:
                        continue

        # Fall back: weakest skill → find related course
        weakest = Mastery.objects.filter(user=user).order_by("proficiency").first()
        if weakest:
            return {
                "skill_to_practice": weakest.skill,
                "proficiency": weakest.proficiency,
                "reason": "weakest skill — needs the most attention",
            }

        return {"note": "No specific recommendation — keep exploring!"}
    except Exception as exc:
        return {"error": str(exc)}


def _generate_practice_question(skill: str, difficulty: int) -> Dict:
    """Generate a fresh practice question via the AI tutor service."""
    try:
        from support.prompts.tutor import PRACTICE_QUESTION_SYSTEM
        from education.services.ai_tutor import _post

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
                return json.loads(raw)
            except json.JSONDecodeError:
                return {"question": raw, "type": "open"}
        return {"error": "Could not generate question"}
    except Exception as exc:
        return {"error": str(exc)}


def _lookup_lesson(query: str, top_k: int = 3) -> Dict:
    """Semantic search via RAG (WS2). Falls back to title keyword match if embeddings not ready."""
    try:
        from education.services.retrieval import search as rag_search

        results = rag_search(query, top_k=top_k)
        return {"results": results}
    except ImportError:
        pass
    except Exception as exc:
        logger.debug("rag_search error: %s", exc)

    # Keyword fallback (pre-WS2)
    try:
        from education.models import Lesson

        terms = query.lower().split()[:5]
        from django.db.models import Q

        q = Q()
        for term in terms:
            q |= Q(title__icontains=term)
        lessons = list(Lesson.objects.filter(q).values("id", "title")[:top_k])
        return {"results": lessons}
    except Exception as exc:
        return {"error": str(exc)}

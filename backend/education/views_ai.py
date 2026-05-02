"""
AI-powered education endpoints: exercise explanations and coaching briefs.
"""

from __future__ import annotations

import logging

from django.conf import settings
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from authentication.entitlements import check_and_consume_entitlement

logger = logging.getLogger(__name__)


class ExerciseExplainView(APIView):
    """
    POST /api/exercises/explain/

    Body:
        exercise_question: str
        exercise_type: str
        correct_answer: any
        user_answer: any
        skill: str (optional)
        exercise_id: int (optional, for mastery lookup)

    Returns:
        { explanation: str, practice_question: dict | null }

    Gating:
        - Free: 3/day  (ai_explain entitlement)
        - Plus/Pro: unlimited
    """

    permission_classes = [IsAuthenticated]

    def post(self, request):
        allowed, meta = check_and_consume_entitlement(request.user, "ai_explain")
        if not allowed:
            from rest_framework import status

            status_code = (
                status.HTTP_402_PAYMENT_REQUIRED
                if meta.get("reason") == "upgrade"
                else status.HTTP_429_TOO_MANY_REQUESTS
            )
            return Response(
                {"error": meta.get("error", "Explain limit reached."), **meta}, status=status_code
            )

        data = request.data
        exercise_question = str(data.get("exercise_question") or "").strip()
        exercise_type = str(data.get("exercise_type") or "multiple_choice")
        correct_answer = data.get("correct_answer")
        user_answer = data.get("user_answer")
        skill = str(data.get("skill") or "").strip() or None
        exercise_id = data.get("exercise_id")

        if not exercise_question:
            return Response({"error": "exercise_question is required."}, status=400)

        # Try to resolve skill from exercise if not provided
        if not skill and exercise_id:
            try:
                from education.models import Exercise

                ex = Exercise.objects.filter(id=exercise_id).first()
                if ex:
                    skill_tags = getattr(ex, "skill_tags", None) or []
                    if skill_tags:
                        skill = skill_tags[0] if isinstance(skill_tags, list) else str(skill_tags)
            except Exception:
                pass

        # Resolve proficiency
        proficiency = 50
        if skill and request.user:
            try:
                from education.models import Mastery

                m = Mastery.objects.filter(user=request.user, skill=skill).first()
                if m:
                    proficiency = m.proficiency
            except Exception:
                pass

        try:
            from education.services.ai_tutor import generate_exercise_explanation

            result = generate_exercise_explanation(
                exercise_question=exercise_question,
                exercise_type=exercise_type,
                correct_answer=correct_answer,
                user_answer=user_answer,
                skill=skill,
                proficiency=proficiency,
            )
            if result is None:
                return Response({"error": "Could not generate explanation."}, status=502)
            return Response(result)
        except Exception:
            logger.error("exercise_explain_error", exc_info=True)
            return Response({"error": "Unexpected error."}, status=500)


class CoachBriefView(APIView):
    """
    GET /api/coach-brief/

    Returns a weekly AI coaching brief for the authenticated user.
    Plus/Pro only.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        allowed, meta = check_and_consume_entitlement(request.user, "ai_coach_brief")
        if not allowed:
            from rest_framework import status

            status_code = (
                status.HTTP_402_PAYMENT_REQUIRED
                if meta.get("reason") == "upgrade"
                else status.HTTP_429_TOO_MANY_REQUESTS
            )
            return Response(
                {"error": meta.get("error", "Coach brief requires Plus or Pro."), **meta},
                status=status_code,
            )

        # Cache the brief for 24h per user to avoid re-generating on every refresh
        from django.core.cache import cache

        cache_key = f"coach_brief:{request.user.id}"
        cached = cache.get(cache_key)
        if cached:
            return Response({"brief": cached, "cached": True})

        try:
            from education.services.ai_tutor import generate_coach_brief

            brief = generate_coach_brief(user=request.user)
            if not brief:
                return Response({"error": "Could not generate brief."}, status=502)
            cache.set(cache_key, brief, timeout=86400)
            return Response({"brief": brief, "cached": False})
        except Exception:
            logger.error("coach_brief_error", exc_info=True)
            return Response({"error": "Unexpected error."}, status=500)

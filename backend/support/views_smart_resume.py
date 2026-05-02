"""
Smart Resume endpoint.
Returns an AI-generated next-action suggestion for the app homescreen.
Cached 24h per user to avoid re-calling on every app open.
"""

from __future__ import annotations

import logging

from django.core.cache import cache
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

logger = logging.getLogger(__name__)

_SMART_RESUME_SYSTEM = (
    "You are Garzoni. In 12 words or fewer, suggest the single most valuable thing "
    "this student should do in the app right now based on their data. "
    "Be specific and motivating. No emojis. No punctuation at the end."
)


class SmartResumeView(APIView):
    """
    GET /api/smart-resume/

    Returns: { action: str, cached: bool }
    Available to all authenticated users (no entitlement gate — improves retention).
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        cache_key = f"smart_resume:{user.id}"
        cached = cache.get(cache_key)
        if cached:
            return Response({"action": cached, "cached": True})

        try:
            from support.services.tools import _get_weak_skills, _get_user_progress
            from support.services.openai import _get_openai_client, _model_for_user
            import json

            progress = _get_user_progress(user)
            weak = _get_weak_skills(user, limit=3)

            context = json.dumps(
                {
                    "streak": progress.get("streak_days", 0),
                    "active_course": progress.get("active_course"),
                    "weak_skills": weak.get("weak_skills", []),
                },
                default=str,
            )

            client = _get_openai_client()
            resp = client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": _SMART_RESUME_SYSTEM},
                    {"role": "user", "content": context},
                ],
                max_tokens=30,
                temperature=0.6,
            )
            action = (resp.choices[0].message.content or "").strip()
            if action:
                cache.set(cache_key, action, timeout=86_400)
                return Response({"action": action, "cached": False})

        except Exception:
            logger.debug("smart_resume_error", exc_info=True)

        return Response({"action": None, "cached": False})

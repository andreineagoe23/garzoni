"""
Smart Resume endpoint.
Returns an AI-generated next-action suggestion for the app homescreen.
Cached 24h per user to avoid re-calling on every app open.
"""

from __future__ import annotations

import logging

from django.conf import settings
from django.core.cache import cache
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from education.utils import get_request_language

logger = logging.getLogger(__name__)

# Homescreen nudge: nice to have, never worth stalling the app open. One shot,
# no SDK retries, short timeout.
_SMART_RESUME_TIMEOUT = 8.0
# Negative cache. Without it every cold start pays the full failure latency
# again and re-hammers an API that just refused us.
_FAIL_TTL = 600
_QUOTA_FAIL_TTL = 3_600
# An empty balance is account-wide, so one refusal parks every user instead of each
# user paying their own failed call first.
_QUOTA_FAIL_KEY = "smart_resume:quota_exhausted"

_SMART_RESUME_SYSTEM_EN = (
    "You are Garzoni. In 12 words or fewer, suggest the single most valuable thing "
    "this student should do in the app right now based on their data. "
    "Be specific and motivating. No emojis. No punctuation at the end. "
    "Write your answer in English."
)
_SMART_RESUME_SYSTEM_RO = (
    "You are Garzoni. In 12 words or fewer, suggest the single most valuable thing "
    "this student should do in the app right now based on their data. "
    "Be specific and motivating. No emojis. No punctuation at the end. "
    "Write your answer in Romanian."
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
        lang = get_request_language(request)
        cache_key = f"smart_resume:{user.id}:{lang}"
        cached = cache.get(cache_key)
        if cached:
            return Response({"action": cached, "cached": True})

        fail_key = f"{cache_key}:failed"
        if cache.get(fail_key) or cache.get(_QUOTA_FAIL_KEY):
            return Response({"action": None, "cached": False})

        # Imported before the try so the except clause below can never NameError.
        from openai import RateLimitError

        try:
            from support.services.tools import _get_weak_skills, _get_user_progress
            from support.services.openai import _get_openai_client
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

            system = _SMART_RESUME_SYSTEM_RO if lang == "ro" else _SMART_RESUME_SYSTEM_EN

            client = _get_openai_client().with_options(max_retries=0, timeout=_SMART_RESUME_TIMEOUT)
            resp = client.chat.completions.create(
                model=getattr(settings, "OPENAI_MODEL_EXTRACTION", "gpt-4.1-nano"),
                messages=[
                    {"role": "system", "content": system},
                    {"role": "user", "content": context},
                ],
                max_tokens=30,
                temperature=0.6,
            )
            action = (resp.choices[0].message.content or "").strip()
            if action:
                cache.set(cache_key, action, timeout=86_400)
                return Response({"action": action, "cached": False})

        except RateLimitError as exc:
            # insufficient_quota is not transient — the key is out of credit and
            # will stay that way until someone tops it up. Warn, don't whisper.
            body = exc.body if isinstance(exc.body, dict) else {}
            code = body.get("code")
            if code in {"insufficient_quota", "credit_balance_exhausted"}:
                cache.set(_QUOTA_FAIL_KEY, 1, timeout=_QUOTA_FAIL_TTL)
            else:
                cache.set(fail_key, 1, timeout=_FAIL_TTL)
            logger.warning("smart_resume_rate_limited code=%s", code)
        except Exception:
            cache.set(fail_key, 1, timeout=_FAIL_TTL)
            logger.debug("smart_resume_error", exc_info=True)

        return Response({"action": None, "cached": False})

"""Live numbers for the public landing page.

The page shows real figures only: how many learners have an account, how many of
them are on a streak right now, and the App Store rating. Every value is read from
the database or Apple the environment is running against, so dev shows dev and
production shows production.

Both reads are cached. /api/public/* is also cached at the Cloudflare edge, so
these run at most once per cache window, not once per visitor.
"""

from __future__ import annotations

import logging
from datetime import timedelta

import requests
from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.utils import timezone

from authentication.models import UserProfile
from core.http_client import get_shared_session

logger = logging.getLogger(__name__)

APP_STORE_ID = "6761790801"
APP_STORE_LOOKUP_URL = "https://itunes.apple.com/lookup"

COUNTS_CACHE_KEY = "public_stats:counts"
RATING_CACHE_KEY = "public_stats:app_store_rating"
_COUNTS_TTL = 600
_RATING_TTL = 86_400
# A failed lookup is retried hourly, not on every request.
_RATING_FAIL_TTL = 3_600


def learner_counts() -> dict:
    """Active learner accounts, and how many of them hold a streak of a day or more."""
    cached = cache.get(COUNTS_CACHE_KEY)
    if cached is not None:
        return cached

    learners = get_user_model().objects.filter(is_active=True, is_staff=False)
    # reset_inactive_streaks zeroes a broken streak on the user's own day, so
    # `streak >= 1` is the live count. The date floor keeps a stalled reset task
    # from inflating it: two days covers every timezone's "yesterday".
    streak_floor = timezone.localdate() - timedelta(days=2)
    on_streak = UserProfile.objects.filter(
        user__in=learners, streak__gte=1, last_completed_date__gte=streak_floor
    )
    counts = {"learners": learners.count(), "on_streak": on_streak.count()}
    cache.set(COUNTS_CACHE_KEY, counts, timeout=_COUNTS_TTL)
    return counts


def app_store_rating() -> dict | None:
    """The App Store average and rating count, or None when Apple can't be reached."""
    cached = cache.get(RATING_CACHE_KEY)
    if cached is not None:
        # An empty dict marks a recent failure.
        return cached or None

    rating = None
    try:
        resp = get_shared_session().get(
            APP_STORE_LOOKUP_URL, params={"id": APP_STORE_ID, "country": "gb"}, timeout=5
        )
        resp.raise_for_status()
        result = (resp.json().get("results") or [{}])[0]
        average, count = result.get("averageUserRating"), result.get("userRatingCount")
        if average and count:
            rating = {"average": round(float(average), 1), "count": int(count)}
    except (requests.RequestException, ValueError, TypeError, AttributeError) as exc:
        logger.warning("app_store_rating_lookup_failed: %s", exc)

    cache.set(RATING_CACHE_KEY, rating or {}, timeout=_RATING_TTL if rating else _RATING_FAIL_TTL)
    return rating


def public_stats() -> dict:
    return {**learner_counts(), "app_store_rating": app_store_rating()}

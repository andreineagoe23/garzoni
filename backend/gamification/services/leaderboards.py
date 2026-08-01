"""
Windowed XP leaderboards backed by RewardLedgerEntry.

The old leaderboard filtered UserProfile by "was active recently"
(last_completed_date) and then ordered by LIFETIME points -- so "this
week" was never actually windowed XP. RewardLedgerEntry records every
grant with a timestamp, so we aggregate over it directly.

Week/month boundaries reuse the same local-calendar-date helper as
mission cycles (gamification.services.mission_cycles) so this leaderboard's
notion of "week" agrees with weekly mission resets -- there is exactly one
week-key scheme in this codebase.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, time, timedelta

from django.core.cache import cache
from django.db.models import Sum
from django.utils import timezone

from authentication.models import UserProfile
from gamification.models import RewardLedgerEntry
from gamification.services.mission_cycles import local_cycle_date, weekly_cycle_id

LEADERBOARD_CACHE_TTL = 60
# Key includes the database name: dev and test share one Redis in the docker
# stack (see mission_cycles._MISSION_POOL_CACHE_KEY for the same reasoning).
_LEADERBOARD_CACHE_KEY = "xp_leaderboard:v1:{db}:{window}:{limit}"
_RANK_CACHE_KEY = "xp_rank:v1:{db}:{window}:{user_id}"


@dataclass
class LeaderboardRow:
    user_id: int
    xp: int
    profile: UserProfile | None = None


def _db_name() -> str:
    from django.db import connection

    return str(connection.settings_dict.get("NAME") or "default")


def _leaderboard_cache_key(window: str, limit: int) -> str:
    return _LEADERBOARD_CACHE_KEY.format(db=_db_name(), window=window, limit=limit)


def _rank_cache_key(window: str, user_id: int) -> str:
    return _RANK_CACHE_KEY.format(db=_db_name(), window=window, user_id=user_id)


def window_start(window: str):
    """Aware datetime lower bound for a leaderboard window.

    "week" = Monday 00:00 local time (same week boundary as weekly mission
    cycles). "month" = 30 days back at 00:00 local time. Anything else
    (including "all-time") returns None, meaning no lower bound.
    """
    today = local_cycle_date()
    if window == "week":
        start_date = today - timedelta(days=today.weekday())
    elif window == "month":
        start_date = today - timedelta(days=30)
    else:
        return None

    tzinfo = timezone.get_current_timezone()
    naive_start = datetime.combine(start_date, time.min)
    return timezone.make_aware(naive_start, tzinfo)


def weekly_xp_leaderboard(window: str, limit: int = 10) -> list[LeaderboardRow]:
    """Top `limit` users by XP earned within `window`, cached for 60s.

    Hydrates UserProfile/User in one extra query (no N+1). Rows for users
    without a UserProfile (shouldn't normally happen) are dropped.
    """
    key = _leaderboard_cache_key(window, limit)
    cached = cache.get(key)
    if cached is not None:
        return cached

    start = window_start(window)
    qs = RewardLedgerEntry.objects.all()
    if start is not None:
        qs = qs.filter(created_at__gte=start)

    aggregated = list(
        qs.values("user")
        .annotate(xp=Sum("points"))
        .filter(xp__gt=0)
        .order_by("-xp", "user")[:limit]
    )
    user_ids = [row["user"] for row in aggregated]
    profiles = {
        p.user_id: p
        for p in UserProfile.objects.select_related("user").filter(user_id__in=user_ids)
    }

    result = [
        LeaderboardRow(user_id=row["user"], xp=row["xp"], profile=profiles[row["user"]])
        for row in aggregated
        if row["user"] in profiles
    ]
    cache.set(key, result, LEADERBOARD_CACHE_TTL)
    return result


def xp_in_window(user, window: str) -> int:
    """Total XP a user earned within `window` (0 if none)."""
    start = window_start(window)
    qs = RewardLedgerEntry.objects.filter(user=user)
    if start is not None:
        qs = qs.filter(created_at__gte=start)
    return qs.aggregate(xp=Sum("points"))["xp"] or 0


def rank_in_window(user, window: str) -> int:
    """1-based rank: count of users with strictly greater windowed XP, + 1."""
    my_xp = xp_in_window(user, window)

    start = window_start(window)
    qs = RewardLedgerEntry.objects.all()
    if start is not None:
        qs = qs.filter(created_at__gte=start)

    higher_ranked = qs.values("user").annotate(xp=Sum("points")).filter(xp__gt=my_xp).count()
    return higher_ranked + 1

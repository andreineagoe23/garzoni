"""
Normalize and build Customer.io transactional ``message_data`` payloads.

Liquid templates receive these as ``trigger.<key>`` per Customer.io docs.
"""

from __future__ import annotations

import calendar
import logging
from datetime import date, datetime, timedelta
from decimal import Decimal
from typing import Any

from django.contrib.auth.models import User
from django.db.models import Sum
from django.utils import timezone

from authentication.models import UserProfile
from education.models import LessonCompletion
from gamification.models import RewardLedgerEntry

logger = logging.getLogger(__name__)


def normalize_scalar_for_message_data(value: Any) -> Any:
    """Coerce Django/ORM types to JSON-safe primitives for CIO ``message_data``."""
    if value is None:
        return None
    # bool must come before int (bool is a subclass of int).
    if isinstance(value, bool):
        return value
    if isinstance(value, int):
        return value
    if isinstance(value, float):
        return value
    if isinstance(value, str):
        return value
    if isinstance(value, Decimal):
        # Preserve currency-like values as strings to avoid float drift.
        if value == value.to_integral():
            return int(value)
        return format(value, "f")
    if isinstance(value, datetime):
        return value.isoformat()
    if isinstance(value, date):
        return value.isoformat()
    logger.debug("Omitted non-scalar message_data value type=%s", type(value).__name__)
    return None


def flatten_context_for_cio(context: dict[str, Any]) -> dict[str, Any]:
    """
    Build ``message_data`` from a Django template context dict.
    Drops unsupported types; normalizes decimals/dates.
    """
    out: dict[str, Any] = {}
    for k, v in context.items():
        if v is None:
            out[k] = None
            continue
        normalized = normalize_scalar_for_message_data(v)
        if normalized is not None:
            out[k] = normalized
    return out


def format_week_label(week_start: date, week_end: date) -> str:
    """
    Human-readable range for digest subject lines, e.g. ``May 5–11`` or ``Apr 28 – May 4``.
    Uses en-style month abbreviations (locale may differ from user prefs).
    """
    if week_start > week_end:
        week_start, week_end = week_end, week_start
    if week_start.month == week_end.month and week_start.year == week_end.year:
        return f"{calendar.month_abbr[week_start.month]} {week_start.day}–{week_end.day}"
    return (
        f"{calendar.month_abbr[week_start.month]} {week_start.day}–"
        f"{calendar.month_abbr[week_end.month]} {week_end.day}"
    )


def modules_completed_plural_suffix(count: int) -> str:
    return "" if count == 1 else "s"


def weekly_digest_week_bounds(reference: date | None = None) -> tuple[date, date, date]:
    """
    ISO week: Monday..Sunday bounds for ``reference`` (default: local today).

    Returns ``(week_monday, metrics_end_inclusive, week_sunday)`` where
    ``metrics_end_inclusive`` is min(reference, week_sunday) so counts are
    week-to-date while ``week_label`` still shows the full calendar week.
    """
    today = reference or timezone.localdate()
    monday = today - timedelta(days=today.weekday())
    sunday = monday + timedelta(days=6)
    metrics_end = today if today <= sunday else sunday
    return monday, metrics_end, sunday


def build_weekly_digest_message_data(
    *,
    user: User,
    profile: UserProfile,
    metrics_start: date,
    metrics_end: date,
    label_start: date,
    label_end: date,
) -> dict[str, Any]:
    """
    Required CIO template fields for weekly digest transactional messages.

    ``modules_completed`` counts completed lessons in the metrics window.
    """
    lessons_completed = LessonCompletion.objects.filter(
        user_progress__user=user,
        completed_at__date__gte=metrics_start,
        completed_at__date__lte=metrics_end,
    ).count()

    xp_sum = (
        RewardLedgerEntry.objects.filter(
            user=user,
            created_at__date__gte=metrics_start,
            created_at__date__lte=metrics_end,
        ).aggregate(total=Sum("points"))["total"]
        or 0
    )

    streak_days = int(profile.streak or 0)

    return {
        "week_label": format_week_label(label_start, label_end),
        "modules_completed": int(lessons_completed),
        "modules_completed_plural": modules_completed_plural_suffix(int(lessons_completed)),
        "streak_days": streak_days,
        "xp_earned": int(xp_sum),
    }

"""Device time zone, reported by the apps on every request as ``X-Garzoni-Timezone``.

``UserProfile.timezone_name`` drives the streak day boundary and evening reminders. It used
to be set only when a push token was registered, so anyone who never granted push stayed on
server time (growth audit 2026-11, item 0.3).
"""

from __future__ import annotations

from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from authentication.models import UserProfile

TIMEZONE_HEADER = "X-Garzoni-Timezone"


def normalize_timezone(raw) -> str:
    """Return ``raw`` if it names a real IANA zone, else ``""``."""
    tz = str(raw or "").strip()[:64]
    if not tz:
        return ""
    try:
        ZoneInfo(tz)
    except (ZoneInfoNotFoundError, ValueError):
        return ""
    return tz


def apply_request_timezone(request, profile: UserProfile) -> bool:
    """Store the request's device zone on ``profile`` when it is valid and changed."""
    tz = normalize_timezone(request.headers.get(TIMEZONE_HEADER))
    if not tz or tz == profile.timezone_name:
        return False
    profile.timezone_name = tz
    profile.save(update_fields=["timezone_name"])
    return True

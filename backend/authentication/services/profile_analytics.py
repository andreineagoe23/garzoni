"""
Analytics timestamp helpers for UserProfile.

Centralizes one-time writes for onboarding completion and first lesson so admin,
product dashboards, and Customer.io stay aligned.
"""

from __future__ import annotations

import logging
from typing import TYPE_CHECKING

from django.utils import timezone

from authentication.models import UserProfile

if TYPE_CHECKING:
    from django.contrib.auth.models import User

logger = logging.getLogger(__name__)


def mark_onboarding_completed(user: User, *, when=None) -> bool:
    """Set onboarding_completed_at once when the questionnaire finishes."""
    when = when or timezone.now()
    profile = UserProfile.objects.filter(user=user, onboarding_completed_at__isnull=True).first()
    if not profile:
        return False
    profile.onboarding_completed_at = when
    profile.save(update_fields=["onboarding_completed_at"])
    return True


def mark_first_lesson(user: User, *, when=None) -> bool:
    """Set first_lesson_at once on the user's first lesson completion."""
    when = when or timezone.now()
    profile = UserProfile.objects.filter(user=user, first_lesson_at__isnull=True).first()
    if not profile:
        return False
    profile.first_lesson_at = when
    profile.save(update_fields=["first_lesson_at"])
    return True


def sync_last_login_date(user: User, *, when=None) -> bool:
    """Mirror auth last_login onto profile.last_login_date (calendar day, local TZ)."""
    when = when or getattr(user, "last_login", None) or timezone.now()
    login_date = timezone.localtime(when).date()
    profile = getattr(user, "profile", None)
    if profile is None:
        try:
            profile = UserProfile.objects.get(user=user)
        except UserProfile.DoesNotExist:
            return False
    if profile.last_login_date == login_date:
        return False
    profile.last_login_date = login_date
    profile.save(update_fields=["last_login_date"])
    return True


def update_last_seen_platform(user: User, platform: str) -> bool:
    """Persist last_seen_platform when the client header/UA resolves to a known platform."""
    platform = (platform or "").strip().lower()
    if platform not in {"web", "ios", "android"}:
        return False
    updated = (
        UserProfile.objects.filter(user=user)
        .exclude(last_seen_platform=platform)
        .update(last_seen_platform=platform)
    )
    return bool(updated)

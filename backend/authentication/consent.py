"""Helpers for capturing legal consent (Terms/Privacy + minimum age) at signup.

Used by every account-creation path — email/password, Google, Apple — so a
demonstrable consent record (GDPR Art. 7) is stored uniformly on UserProfile.
"""

from __future__ import annotations

from django.conf import settings
from django.utils import timezone


def client_ip(request) -> str | None:
    """Best-effort client IP, honoring a single proxy hop (X-Forwarded-For)."""
    if request is None:
        return None
    xff = request.META.get("HTTP_X_FORWARDED_FOR")
    if xff:
        return xff.split(",")[0].strip() or None
    return request.META.get("REMOTE_ADDR") or None


def record_consent(profile, request=None, *, age_confirmed: bool = True, save: bool = True) -> None:
    """Stamp the current Terms version, acceptance time, IP, and age confirmation.

    Idempotent-ish: always records the *current* acceptance (re-consent on a new
    version legitimately overwrites the prior stamp).
    """
    if profile is None:
        return
    profile.terms_version = getattr(settings, "CURRENT_TERMS_VERSION", "")
    profile.terms_accepted_at = timezone.now()
    profile.terms_accepted_ip = client_ip(request)
    profile.age_confirmed = bool(age_confirmed)
    if save:
        profile.save(
            update_fields=[
                "terms_version",
                "terms_accepted_at",
                "terms_accepted_ip",
                "age_confirmed",
            ]
        )


def truthy(value) -> bool:
    """Parse a consent flag from JSON/form input (bool, "true", "1", "on", "yes")."""
    if isinstance(value, bool):
        return value
    return str(value).strip().lower() in {"true", "1", "on", "yes"}

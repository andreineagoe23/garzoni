from __future__ import annotations

import logging
from typing import Any

from django.contrib.auth.models import User
from django.utils import timezone

from authentication.models import UserEmailPreference, UserProfile
from notifications.customer_io import identify_person
from notifications.identity import customer_io_person_id

logger = logging.getLogger(__name__)


def build_identify_traits(user: User) -> dict[str, Any]:
    profile = UserProfile.objects.filter(user=user).select_related("user").first()
    prefs = UserEmailPreference.objects.filter(user=user).first()
    traits: dict[str, Any] = {
        "id": customer_io_person_id(user),
        "email": (user.email or "").strip() or None,
        "first_name": user.first_name or "",
        "last_name": user.last_name or "",
        "username": user.username or "",
        "workspace": "garzoni",
        "created_at": int(user.date_joined.timestamp()) if user.date_joined else None,
    }
    if profile:
        traits["subscription_status"] = profile.subscription_status or ""
        traits["expo_push_token"] = profile.expo_push_token or ""
        traits["email_reminder_preference"] = profile.email_reminder_preference or "none"
    if prefs:
        traits["marketing_opt_in"] = bool(prefs.marketing)
        traits["reminders_opt_in"] = bool(prefs.reminders)
        traits["weekly_digest_opt_in"] = bool(prefs.weekly_digest)
        traits["billing_alerts_opt_in"] = bool(prefs.billing_alerts)
        traits["streak_alerts_opt_in"] = bool(prefs.streak_alerts)
        traits["reminder_frequency"] = prefs.reminder_frequency or "weekly"
        traits["push_opt_in"] = bool(getattr(prefs, "push_notifications", True))
    traits["last_seen_at"] = int(timezone.now().timestamp())

    def _keep(_k: str, v: Any) -> bool:
        if v is None:
            return False
        if isinstance(v, bool):
            return True
        if v == "":
            return False
        return True

    return {k: v for k, v in traits.items() if _keep(k, v)}


class NotificationProfileSync:
    """Sync people to Customer.io (identify)."""

    def sync_user(self, user: User) -> tuple[bool, str | None]:
        pid = customer_io_person_id(user)
        traits = build_identify_traits(user)
        ok, err = identify_person(pid, traits)
        if not ok:
            logger.warning("Customer.io identify failed user=%s: %s", pid, err)
        return ok, err

    def delete_user(self, user: User) -> tuple[bool, str | None]:
        from notifications.customer_io import delete_person

        pid = customer_io_person_id(user)
        return delete_person(pid)

    def sync_device(
        self, user: User, token: str | None, platform: str | None = None
    ) -> tuple[bool, str | None]:
        """Push device state via traits (Expo token on profile)."""
        pid = customer_io_person_id(user)
        traits: dict[str, Any] = {
            "expo_push_token": token or "",
        }
        if platform:
            traits["push_platform"] = platform
        return identify_person(pid, traits)

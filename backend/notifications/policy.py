from __future__ import annotations

import logging
from dataclasses import dataclass
from enum import Enum

from django.contrib.auth.models import User

from authentication.models import UserEmailPreference, UserProfile
from notifications.enums import CioTemplate

logger = logging.getLogger(__name__)


class MessageKind(str, Enum):
    TRANSACTIONAL_OPERATIONAL = "transactional_operational"
    TRANSACTIONAL_PRODUCT = "transactional_product"
    MARKETING = "marketing"


class NotificationCategory(str, Enum):
    """High-level channel-routing category. Independent from CIO template."""

    # Always email; push optional companion.
    TRANSACTIONAL_CRITICAL = "transactional_critical"
    # Push-first if mobile; email fallback otherwise.
    TRANSACTIONAL_ACCOUNT = "transactional_account"
    # Push-first if mobile; email fallback otherwise.
    MARKETING = "marketing"
    # Always both channels.
    SECURITY = "security"


@dataclass(frozen=True)
class PolicyResult:
    allowed: bool
    reason: str


@dataclass(frozen=True)
class ChannelDecision:
    email: bool
    push: bool
    reason: str


def _prefs(user: User) -> UserEmailPreference | None:
    return UserEmailPreference.objects.filter(user=user).first()


def _has_mobile_token(user: User) -> bool:
    profile = UserProfile.objects.filter(user=user).only("expo_push_token").first()
    if not profile:
        return False
    return bool((profile.expo_push_token or "").strip())


def resolve_channels(user: User, category: NotificationCategory) -> ChannelDecision:
    """
    Route a notification to push/email/both based on category and mobile presence.

    Rules:
    - TRANSACTIONAL_CRITICAL: email always (legal/billing record). Push companion if mobile.
    - SECURITY: email always + push always (best-effort delivery).
    - TRANSACTIONAL_ACCOUNT / MARKETING: push if mobile, else email.
    """
    has_mobile = _has_mobile_token(user)
    if category == NotificationCategory.TRANSACTIONAL_CRITICAL:
        return ChannelDecision(email=True, push=has_mobile, reason="critical")
    if category == NotificationCategory.SECURITY:
        return ChannelDecision(email=True, push=has_mobile, reason="security")
    # MARKETING / TRANSACTIONAL_ACCOUNT
    if has_mobile:
        return ChannelDecision(email=False, push=True, reason="push_first")
    return ChannelDecision(email=True, push=False, reason="email_fallback_no_token")


def template_kind(template: CioTemplate) -> MessageKind:
    if template in (
        CioTemplate.PASSWORD_RESET,
        CioTemplate.PASSWORD_CHANGED,
        CioTemplate.EMAIL_VERIFICATION,
        CioTemplate.MAGIC_LOGIN,
        CioTemplate.ORDER_CONFIRMED,
        CioTemplate.PAYMENT_RECEIPT,
        CioTemplate.PAYMENT_FAILED,
    ):
        return MessageKind.TRANSACTIONAL_OPERATIONAL
    if template in (
        CioTemplate.WELCOME,
        CioTemplate.SUBSCRIPTION_CANCELLED,
        CioTemplate.TRIAL_ENDING,
        CioTemplate.RENEWAL_REMINDER,
        CioTemplate.REFERRAL_REFERRER,
        CioTemplate.REFERRAL_REFERRED,
    ):
        return MessageKind.TRANSACTIONAL_PRODUCT
    return MessageKind.MARKETING


def should_send_email(user: User, template: CioTemplate) -> PolicyResult:
    """
    Single gate for preference checks. Operational transactional messages ignore marketing prefs.
    """
    kind = template_kind(template)
    if kind == MessageKind.TRANSACTIONAL_OPERATIONAL:
        if not (user.email or "").strip():
            return PolicyResult(False, "no_email")
        return PolicyResult(True, "ok")

    prefs = _prefs(user)

    if kind == MessageKind.TRANSACTIONAL_PRODUCT:
        if not (user.email or "").strip():
            return PolicyResult(False, "no_email")
        if template == CioTemplate.WELCOME:
            return PolicyResult(True, "ok")
        if template in (CioTemplate.REFERRAL_REFERRER, CioTemplate.REFERRAL_REFERRED):
            return PolicyResult(True, "ok")
        if template in (
            CioTemplate.SUBSCRIPTION_CANCELLED,
            CioTemplate.TRIAL_ENDING,
            CioTemplate.RENEWAL_REMINDER,
        ):
            if prefs and not prefs.billing_alerts:
                return PolicyResult(False, "billing_alerts_off")
            return PolicyResult(True, "ok")

    # Marketing / lifecycle digests
    if not (user.email or "").strip():
        return PolicyResult(False, "no_email")
    if not prefs:
        return PolicyResult(True, "ok_no_prefs_row")

    if template == CioTemplate.STREAK_BROKEN:
        if not prefs.streak_alerts:
            return PolicyResult(False, "streak_alerts_off")
        return PolicyResult(True, "ok")

    if template == CioTemplate.WEEKLY_DIGEST:
        if not prefs.reminders or not prefs.weekly_digest:
            return PolicyResult(False, "digest_disabled")
        return PolicyResult(True, "ok")

    # REMINDER_MONTHLY is the email fallback for AI nudges / generic marketing.
    # Master marketing opt-out must hard-block it; previously only `reminders`
    # was consulted so users who unsubscribed via CIO (which sets
    # prefs.marketing=False through the unsub webhook) still received this mail.
    if template == CioTemplate.REMINDER_MONTHLY:
        if not prefs.marketing:
            return PolicyResult(False, "marketing_off")
        if not prefs.reminders:
            return PolicyResult(False, "reminders_off")
        return PolicyResult(True, "ok")

    # Default for any future marketing-class template: respect the master switch.
    if not prefs.marketing:
        return PolicyResult(False, "marketing_off")
    return PolicyResult(True, "ok_default")


# Push category → the preference that governs it, and the Android channel it is
# filed under. Categories reuse the existing per-topic preferences rather than
# duplicating them: a user who turns "Streak alerts" off means it for both
# channels, and a second parallel set of switches would only invite the two to
# disagree.
#
# Deliberately narrow. `reminders`, `weekly_digest` and `marketing` are also
# flipped to False server-side by the Customer.io bounce webhook, so mapping
# every category here would mean a *hard-bounced email address* silently killing
# that user's push — cutting the only channel still reachable for them. Only the
# two topics a user sets on purpose are mapped; `billing` is operational and is
# governed by the master switch alone.
PUSH_CATEGORY_PREF = {
    "streak": "streak_alerts",
    "marketing": "marketing",
}

PUSH_CATEGORY_CHANNEL = {
    "streak": "streak",
    "marketing": "marketing",
    "reminder": "lessons",
    "digest": "lessons",
    "billing": "billing",
    "transactional": "billing",
}


def push_channel_for_category(category: str) -> str:
    """Android channel id for a push category (see mobile ensureAndroidNotificationChannels)."""
    return PUSH_CATEGORY_CHANNEL.get(category, "default")


def within_frequency_cap(user: User) -> PolicyResult:
    """
    Cap non-operational messages per user per rolling day.

    Several journeys (streak alert, coach nudge, re-engage, weekly digest) can
    independently decide the same person is worth contacting on the same day.
    Nothing coordinated them, so a lapsed user could collect four nudges in an
    evening — the fastest way to earn an uninstall. Operational mail (receipts,
    password resets) never passes through here.

    Counted in the cache, not the DB: an approximate cap that degrades to
    "allow" if Redis is down is the right failure mode for a courtesy limit.
    """
    from django.conf import settings as dj_settings
    from django.core.cache import cache
    from django.utils import timezone as dj_timezone

    limit = int(getattr(dj_settings, "NOTIFICATION_DAILY_CAP", 2) or 0)
    if limit <= 0:
        return PolicyResult(True, "cap_disabled")
    key = f"notif_cap:{user.pk}:{dj_timezone.localdate().isoformat()}"
    try:
        sent = cache.get(key) or 0
        if int(sent) >= limit:
            return PolicyResult(False, "daily_cap_reached")
    except Exception:
        return PolicyResult(True, "cap_unavailable")
    return PolicyResult(True, "ok")


def record_capped_send(user: User) -> None:
    """Count one capped send against today's allowance."""
    from django.core.cache import cache
    from django.utils import timezone as dj_timezone

    key = f"notif_cap:{user.pk}:{dj_timezone.localdate().isoformat()}"
    try:
        # add() then incr() so the first write establishes the 36h TTL.
        cache.add(key, 0, timeout=60 * 60 * 36)
        cache.incr(key)
    except Exception:
        pass


def should_send_push(user: User, category: str) -> PolicyResult:
    """
    Push policy: master switch on `push_notifications`, then the per-topic
    preference for the categories in PUSH_CATEGORY_PREF. Everything else —
    operational/transactional push (receipts, payment failures, billing) —
    honours the master switch alone.
    """
    prefs = _prefs(user)
    if not prefs:
        return PolicyResult(True, "ok")
    if not getattr(prefs, "push_notifications", True):
        return PolicyResult(False, "push_master_off")
    pref_field = PUSH_CATEGORY_PREF.get(category)
    if pref_field and not getattr(prefs, pref_field, True):
        return PolicyResult(False, f"{pref_field}_off")
    return PolicyResult(True, "ok")

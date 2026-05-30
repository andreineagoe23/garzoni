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


def should_send_push(user: User, category: str) -> PolicyResult:
    """Push policy: master switch on UserEmailPreference.push_notifications."""
    prefs = _prefs(user)
    if prefs and not getattr(prefs, "push_notifications", True):
        return PolicyResult(False, "push_master_off")
    if prefs and not prefs.marketing and category == "marketing":
        return PolicyResult(False, "marketing_push_off")
    return PolicyResult(True, "ok")

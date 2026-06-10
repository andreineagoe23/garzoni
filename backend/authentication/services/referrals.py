from __future__ import annotations

import logging
from typing import TYPE_CHECKING

from django.db import IntegrityError, transaction

from authentication.models import Referral, UserProfile
from authentication.services.referral_rewards import (
    REFERRAL_SIGNUP_POINTS_REFEREE,
    REFERRAL_SIGNUP_POINTS_REFERRER,
    resolve_referrer_profile,
)

if TYPE_CHECKING:
    from django.contrib.auth.models import User

logger = logging.getLogger(__name__)


class ReferralError(Exception):
    def __init__(self, message: str, code: str = "invalid"):
        super().__init__(message)
        self.message = message
        self.code = code


def apply_referral(referrer_profile: UserProfile, referred_user: User) -> Referral:
    """
    Attribute a referral at signup or post-signup apply. Awards signup points;
    50% discount codes are granted later when earn conditions are met.
    """
    if referrer_profile.user_id == referred_user.id:
        raise ReferralError("You cannot refer yourself.", "self_referral")

    ref_email = (referrer_profile.user.email or "").strip().lower()
    new_email = (referred_user.email or "").strip().lower()
    if ref_email and new_email and ref_email == new_email:
        raise ReferralError("You cannot refer yourself.", "self_referral")

    if Referral.objects.filter(referred_user=referred_user).exists():
        raise ReferralError("Referral already applied.", "already_applied")

    try:
        with transaction.atomic():
            referral = Referral.objects.create(
                referrer=referrer_profile.user,
                referred_user=referred_user,
                referral_code=referrer_profile.referral_code,
                referral_points=REFERRAL_SIGNUP_POINTS_REFERRER,
                reward_status=Referral.REWARD_STATUS_PENDING,
            )
            referrer_profile.add_points(REFERRAL_SIGNUP_POINTS_REFERRER)
            referred_user.profile.add_points(REFERRAL_SIGNUP_POINTS_REFEREE)
    except IntegrityError:
        # Concurrent request won the OneToOne(referred_user) race.
        raise ReferralError("Referral already applied.", "already_applied")

    logger.info(
        "referral_applied",
        extra={
            "referrer_id": referrer_profile.user_id,
            "referred_id": referred_user.id,
            "referral_id": referral.id,
        },
    )
    return referral


def try_apply_referral_code(referred_user: User, referral_code: str | None) -> Referral | None:
    cleaned = (referral_code or "").strip()
    if not cleaned:
        return None
    referrer_profile = resolve_referrer_profile(cleaned)
    if not referrer_profile:
        raise ReferralError("Invalid referral code.", "invalid_code")
    return apply_referral(referrer_profile, referred_user)


def apply_referral_for_new_user(
    user: User, is_new_user: bool, referral_code: str | None
) -> Referral | None:
    if not is_new_user:
        return None
    try:
        return try_apply_referral_code(user, referral_code)
    except ReferralError as exc:
        logger.info("referral skipped for new oauth user_id=%s: %s", user.id, exc.message)
        return None

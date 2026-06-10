from __future__ import annotations

import logging
import secrets
from typing import TYPE_CHECKING

import stripe
from django.conf import settings
from django.db import transaction
from django.utils import timezone

from authentication.models import Referral, UserProfile

if TYPE_CHECKING:
    from django.contrib.auth.models import User

logger = logging.getLogger(__name__)

REFERRAL_SIGNUP_POINTS_REFERRER = 50
REFERRAL_SIGNUP_POINTS_REFEREE = 25
MAX_EARNED_UNREDEEMED_PER_REFERRER = 10


def user_has_verified_email(user: User) -> bool:
    """OAuth users are verified by the provider; email signups require a non-empty email."""
    profile = getattr(user, "profile", None)
    if profile and profile.apple_sub:
        return True
    if not user.has_usable_password():
        return True
    return bool((user.email or "").strip())


def user_completed_first_lesson(user: User) -> bool:
    from django.db.models import Count

    from education.models import LessonCompletion, UserProgress

    if LessonCompletion.objects.filter(user_progress__user=user).exists():
        return True
    return (
        UserProgress.objects.filter(user=user)
        .annotate(lesson_count=Count("completed_lessons"))
        .filter(lesson_count__gte=1)
        .exists()
    )


def _stripe_configured() -> bool:
    return bool((getattr(settings, "STRIPE_SECRET_KEY", "") or "").strip())


def _referral_coupon_id() -> str | None:
    configured = (getattr(settings, "STRIPE_REFERRAL_COUPON_ID", "") or "").strip()
    if configured:
        return configured
    if not _stripe_configured():
        return None
    stripe.api_key = settings.STRIPE_SECRET_KEY
    try:
        coupon = stripe.Coupon.create(
            percent_off=50,
            duration="once",
            name="Garzoni Referral 50% Off",
            metadata={"source": "garzoni_referral"},
        )
        logger.info("Created Stripe referral coupon %s", coupon.id)
        return coupon.id
    except stripe.error.StripeError as exc:
        logger.error("Failed to create referral coupon: %s", exc)
        return None


def _create_promotion_code(
    *, coupon_id: str, user: User, referral: Referral, role: str
) -> tuple[str, str]:
    stripe.api_key = settings.STRIPE_SECRET_KEY
    suffix = secrets.token_hex(3).upper()
    code = f"GZ{user.id}{referral.id}{suffix}"[:20]
    promo = stripe.PromotionCode.create(
        coupon=coupon_id,
        code=code,
        max_redemptions=1,
        metadata={
            "referral_id": str(referral.id),
            "role": role,
            "user_id": str(user.id),
        },
    )
    return promo.code, promo.id


def _referrer_earned_unredeemed_count(referrer_id: int) -> int:
    return Referral.objects.filter(
        referrer_id=referrer_id,
        reward_status=Referral.REWARD_STATUS_EARNED,
        referrer_redeemed_at__isnull=True,
    ).count()


def maybe_earn_referral_reward(referred_user: User) -> bool:
    """
    When a referred user verifies email (OAuth or signup email) and completes their
    first lesson, grant both parties a 50% Stripe promotion code.
    """
    try:
        referral = Referral.objects.select_related("referrer", "referred_user").get(
            referred_user=referred_user
        )
    except Referral.DoesNotExist:
        return False

    if referral.reward_status == Referral.REWARD_STATUS_EARNED:
        return False

    if not user_has_verified_email(referred_user):
        return False
    if not user_completed_first_lesson(referred_user):
        return False

    if (
        (referral.referrer.email or "").strip()
        and (referred_user.email or "").strip()
        and referral.referrer.email.strip().lower() == referred_user.email.strip().lower()
    ):
        logger.warning("Referral earn blocked: same email for referrer and referee")
        return False

    coupon_id = _referral_coupon_id()
    if not coupon_id:
        logger.error("Referral earn skipped: no Stripe coupon available")
        return False

    with transaction.atomic():
        locked = Referral.objects.select_for_update().get(pk=referral.pk)
        if locked.reward_status == Referral.REWARD_STATUS_EARNED:
            return False

        # Per-referrer mutex: concurrent earns lock different Referral rows, so
        # serialize on the referrer's profile before counting toward the cap.
        UserProfile.objects.select_for_update().filter(user_id=locked.referrer_id).first()
        if (
            _referrer_earned_unredeemed_count(locked.referrer_id)
            >= MAX_EARNED_UNREDEEMED_PER_REFERRER
        ):
            logger.warning(
                "Referral earn blocked: referrer %s at unredeemed cap",
                locked.referrer_id,
            )
            return False

        ref_code, ref_stripe_id = _create_promotion_code(
            coupon_id=coupon_id,
            user=locked.referrer,
            referral=locked,
            role="referrer",
        )
        referee_code, referee_stripe_id = _create_promotion_code(
            coupon_id=coupon_id,
            user=locked.referred_user,
            referral=locked,
            role="referee",
        )
        locked.referrer_promo_code = ref_code
        locked.referrer_promo_stripe_id = ref_stripe_id
        locked.referee_promo_code = referee_code
        locked.referee_promo_stripe_id = referee_stripe_id
        locked.reward_status = Referral.REWARD_STATUS_EARNED
        locked.earned_at = timezone.now()
        locked.save(
            update_fields=[
                "referrer_promo_code",
                "referrer_promo_stripe_id",
                "referee_promo_code",
                "referee_promo_stripe_id",
                "reward_status",
                "earned_at",
            ]
        )

    from authentication.tasks import send_referral_discount_emails

    try:
        send_referral_discount_emails.delay(locked.id)
    except Exception:
        logger.warning(
            "send_referral_discount_emails dispatch failed referral_id=%s",
            locked.id,
            exc_info=True,
        )
    return True


def get_unredeemed_promo_for_user(user: User) -> tuple[str, str, Referral] | None:
    """
    Return (customer_facing_code, stripe_promo_id, referral) for the user's next
    unredeemed earned referral discount, preferring referee reward then referrer.
    """
    as_referee = (
        Referral.objects.filter(
            referred_user=user,
            reward_status=Referral.REWARD_STATUS_EARNED,
            referee_redeemed_at__isnull=True,
        )
        .exclude(referee_promo_stripe_id="")
        .order_by("earned_at")
        .first()
    )
    if as_referee:
        return (
            as_referee.referee_promo_code,
            as_referee.referee_promo_stripe_id,
            as_referee,
        )

    as_referrer = (
        Referral.objects.filter(
            referrer=user,
            reward_status=Referral.REWARD_STATUS_EARNED,
            referrer_redeemed_at__isnull=True,
        )
        .exclude(referrer_promo_stripe_id="")
        .order_by("earned_at")
        .first()
    )
    if as_referrer:
        return (
            as_referrer.referrer_promo_code,
            as_referrer.referrer_promo_stripe_id,
            as_referrer,
        )
    return None


def mark_referral_promo_redeemed(user: User, stripe_promo_id: str) -> None:
    if not stripe_promo_id:
        return
    now = timezone.now()
    Referral.objects.filter(
        referred_user=user,
        referee_promo_stripe_id=stripe_promo_id,
        referee_redeemed_at__isnull=True,
    ).update(referee_redeemed_at=now)
    Referral.objects.filter(
        referrer=user,
        referrer_promo_stripe_id=stripe_promo_id,
        referrer_redeemed_at__isnull=True,
    ).update(referrer_redeemed_at=now)


def resolve_referrer_profile(referral_code: str) -> UserProfile | None:
    cleaned = (referral_code or "").strip()
    if not cleaned:
        return None
    return UserProfile.objects.filter(referral_code__iexact=cleaned).first()

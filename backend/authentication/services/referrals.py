from django.db import transaction
import logging

from authentication.models import Referral, UserProfile

logger = logging.getLogger(__name__)


def apply_referral(referrer_profile, referred_user):
    with transaction.atomic():
        Referral.objects.create(
            referrer=referrer_profile.user,
            referred_user=referred_user,
            referral_code=referrer_profile.referral_code,
        )

        referrer_profile.add_points(10)
        referred_user.profile.add_points(5)
    logger.info(
        "referral_applied",
        extra={"referrer_id": referrer_profile.user_id, "referred_id": referred_user.id},
    )

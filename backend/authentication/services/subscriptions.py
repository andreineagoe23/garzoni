from django.core.cache import cache

from authentication.services.profile import invalidate_profile_cache

_UNSET = object()


def apply_subscription_to_profile(
    profile,
    *,
    has_paid=_UNSET,
    is_premium=_UNSET,
    subscription_status=_UNSET,
    subscription_plan_id=_UNSET,
    stripe_payment_id=_UNSET,
    stripe_subscription_id=_UNSET,
    trial_end=_UNSET,
    stripe_customer_id=_UNSET,
):
    """
    Update subscription-related fields on a UserProfile in one place and
    consistently invalidate all related cache keys.
    """

    update_fields = []

    if has_paid is not _UNSET and profile.has_paid != has_paid:
        profile.has_paid = has_paid
        update_fields.append("has_paid")
    if is_premium is not _UNSET and profile.is_premium != is_premium:
        profile.is_premium = is_premium
        update_fields.append("is_premium")
    if subscription_status is not _UNSET and profile.subscription_status != subscription_status:
        profile.subscription_status = subscription_status
        update_fields.append("subscription_status")
    if subscription_plan_id is not _UNSET and profile.subscription_plan_id != subscription_plan_id:
        profile.subscription_plan_id = subscription_plan_id
        update_fields.append("subscription_plan_id")
    if stripe_payment_id is not _UNSET and profile.stripe_payment_id != stripe_payment_id:
        profile.stripe_payment_id = stripe_payment_id
        update_fields.append("stripe_payment_id")
    if (
        stripe_subscription_id is not _UNSET
        and profile.stripe_subscription_id != stripe_subscription_id
    ):
        profile.stripe_subscription_id = stripe_subscription_id
        update_fields.append("stripe_subscription_id")
    if trial_end is not _UNSET and profile.trial_end != trial_end:
        profile.trial_end = trial_end
        update_fields.append("trial_end")
    if stripe_customer_id is not _UNSET and profile.stripe_customer_id != stripe_customer_id:
        profile.stripe_customer_id = stripe_customer_id
        update_fields.append("stripe_customer_id")

    if update_fields:
        profile.save(update_fields=update_fields)
        cache.delete_many(
            [
                f"user_payment_status_{profile.user_id}",
                f"user_profile_{profile.user_id}",
            ]
        )
        if "subscription_plan_id" in update_fields or "stripe_subscription_id" in update_fields:
            uid = profile.user_id
            cache.delete(f"stripe_plan_infer_{uid}")
            cache.delete(f"stripe_plan_infer_cust_{uid}")
        invalidate_profile_cache(profile.user)

    return profile

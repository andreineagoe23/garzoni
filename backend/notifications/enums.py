from enum import Enum


class CioTemplate(str, Enum):
    """Transactional template trigger slugs; map to CIO IDs or trigger names via settings."""

    PASSWORD_RESET = "password-reset"
    WELCOME = "welcome"
    EMAIL_VERIFICATION = "email-verification"
    MAGIC_LOGIN = "magic-login"
    ORDER_CONFIRMED = "order-confirmed"
    PAYMENT_RECEIPT = "payment-receipt"
    PAYMENT_FAILED = "payment-failed"
    SUBSCRIPTION_CANCELLED = "subscription-cancelled"
    TRIAL_ENDING = "trial-ending"
    RENEWAL_REMINDER = "renewal-reminder"
    WEEKLY_DIGEST = "weekly-digest"
    REMINDER_MONTHLY = "reminder-monthly"
    REFERRAL_REFERRER = "referral-referrer"
    REFERRAL_REFERRED = "referral-referred"
    STREAK_BROKEN = "streak-broken"


class CioEventName(str, Enum):
    """Domain events for journeys / segmentation (identify + track)."""

    USER_REGISTERED = "user_registered"
    USER_LOGIN = "user_login"
    WEEKLY_DIGEST_ELIGIBLE = "weekly_digest_eligible"
    MONTHLY_REMINDER_ELIGIBLE = "monthly_reminder_eligible"
    TRIAL_ENDING_SOON = "trial_ending_soon"
    RENEWAL_UPCOMING = "renewal_upcoming"
    SUBSCRIPTION_CANCELLED = "subscription_cancelled"
    ORDER_CONFIRMED = "order_confirmed"
    PAYMENT_FAILED = "payment_failed"
    CHECKOUT_ABANDONED = "checkout_abandoned"

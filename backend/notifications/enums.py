from enum import Enum


class CioTemplate(str, Enum):
    """Transactional template trigger slugs; map to CIO IDs or trigger names via settings."""

    PASSWORD_RESET = "password-reset"
    PASSWORD_CHANGED = "password-changed"
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
    PORTFOLIO_UPDATE = "portfolio-update"
    AI_NUDGE = "ai-nudge"
    COACH_BRIEF = "coach-brief"


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
    COACH_NUDGE = "coach_nudge"
    STREAK_ABOUT_TO_EXPIRE = "streak_about_to_expire"
    INACTIVITY_NUDGE = "inactivity_nudge"
    # Celebration events. Both fire on something the user *earned*, which is the
    # only kind of notification that reliably improves retention rather than
    # spending it — a badge nobody is told about does no work.
    # The conversion signal every retention journey is measured against. Emitted
    # server-side so web counts too — the mobile SDK's client-side copy never
    # reached the workspace, which is why every campaign reported 0 conversions.
    LESSON_COMPLETED = "lesson_completed"
    STREAK_MILESTONE = "streak_milestone"
    LEAGUE_WEEK_CLOSED = "league_week_closed"

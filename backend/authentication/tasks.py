# authentication/tasks.py
from celery import shared_task
from django.core.mail import send_mail
from django.db.models import Q
from django.db.models import Sum
from django.template.loader import render_to_string
from django.utils.html import strip_tags
from django.conf import settings
from django.utils import timezone
from datetime import timedelta, datetime
from django.contrib.auth import get_user_model
import logging
import stripe

from authentication.models import UserProfile, UserEmailPreference
from authentication.user_display import normalize_display_string
from finance.models import UserPurchase
from education.models import LessonCompletion

logger = logging.getLogger(__name__)


def _email_configured():
    """Return True if an email backend has enough config to send."""
    backend = (getattr(settings, "EMAIL_BACKEND", "") or "").lower()
    if "console" in backend:
        return True
    if "anymail" in backend:
        return bool(getattr(settings, "ANYMAIL", None))
    return bool(
        getattr(settings, "EMAIL_HOST_USER", None)
        and getattr(settings, "EMAIL_HOST_PASSWORD", None)
    )


def _send_reminder_email(profile: UserProfile, frequency: str, now=None):
    if not now:
        now = timezone.now()
    api_base = (getattr(settings, "BACKEND_URL", "") or "").rstrip("/")
    context = {
        "user": profile.user,
        "frequency": frequency,
        "app_url": getattr(settings, "FRONTEND_URL", "https://monevo.tech"),
        "preferences_link": f"{getattr(settings, 'FRONTEND_URL', 'https://monevo.tech').rstrip('/')}/settings",
        "unsubscribe_link": f"{api_base}/email/unsubscribe/?token={profile.get_unsubscribe_token()}",
        "year": now.year,
    }
    html_message = render_to_string("emails/reminder.html", context)
    subject = (
        "Weekly Reminder: Your Financial Learning Journey Awaits"
        if frequency == "weekly"
        else "Monthly Reminder: Continue Your Financial Learning"
    )
    send_mail(
        subject,
        strip_tags(html_message),
        settings.DEFAULT_FROM_EMAIL,
        [profile.user.email],
        html_message=html_message,
        fail_silently=False,
    )


def _send_weekly_digest_email(profile: UserProfile, now=None):
    if not now:
        now = timezone.now()
    week_start = now - timedelta(days=7)
    lessons_completed_this_week = LessonCompletion.objects.filter(
        user_progress__user=profile.user,
        completed_at__gte=week_start,
    ).count()
    coins_spent = (
        UserPurchase.objects.filter(user=profile.user, purchased_at__gte=week_start).aggregate(
            total=Sum("reward__cost")
        )["total"]
        or 0
    )
    context = {
        "display_name": normalize_display_string(
            profile.user.first_name or profile.user.username or "there"
        ),
        "lessons_completed_this_week": lessons_completed_this_week,
        "current_streak": profile.streak,
        "coins_earned_this_week": 0,
        "coins_spent_this_week": coins_spent,
        "recommended_next_lesson": "Continue where you left off in your latest lesson.",
        "app_url": getattr(settings, "FRONTEND_URL", "https://monevo.tech"),
        "manage_url": f"{getattr(settings, 'FRONTEND_URL', 'https://monevo.tech').rstrip('/')}/dashboard",
        "year": now.year,
    }
    html_message = render_to_string("emails/weekly_digest.html", context)
    send_mail(
        "Your Weekly Monevo Progress Digest",
        strip_tags(html_message),
        settings.DEFAULT_FROM_EMAIL,
        [profile.user.email],
        html_message=html_message,
        fail_silently=False,
    )


@shared_task(
    bind=True, autoretry_for=(Exception,), retry_backoff=60, retry_kwargs={"max_retries": 3}
)
def send_email_reminders(self):
    """
    Send email reminders to users based on their preferences.
    Weekly: users who want weekly and haven't logged in for 7 days (uses User.last_login).
    Monthly: users who want monthly and haven't logged in for 28 days.
    """
    if not _email_configured():
        logger.warning("Email reminders skipped: EMAIL_HOST_USER or EMAIL_HOST_PASSWORD not set")
        return "Skipped (email not configured)"
    now = timezone.now()
    weekly_cutoff = now - timedelta(days=7)
    monthly_cutoff = now - timedelta(days=28)

    # Use User.last_login (set on every login); avoid relying on UserProfile.last_login_date which may not be synced
    weekly_users = (
        UserProfile.objects.filter(
            email_preferences__reminder_frequency="weekly",
            email_preferences__reminders=True,
            email_preferences__weekly_digest=True,
            user__email__isnull=False,
        )
        .exclude(last_reminder_sent__gt=now - timedelta(days=6))
        .filter(Q(user__last_login__isnull=True) | Q(user__last_login__lt=weekly_cutoff))
        .select_related("user")
    )

    monthly_users = (
        UserProfile.objects.filter(
            email_preferences__reminder_frequency="monthly",
            email_preferences__reminders=True,
            user__email__isnull=False,
        )
        .exclude(last_reminder_sent__gt=now - timedelta(days=27))
        .filter(Q(user__last_login__isnull=True) | Q(user__last_login__lt=monthly_cutoff))
        .select_related("user")
    )

    sent_weekly, sent_monthly = 0, 0
    for profile in weekly_users:
        try:
            _send_weekly_digest_email(profile, now=now)
            profile.last_reminder_sent = now
            profile.save(update_fields=["last_reminder_sent"])
            sent_weekly += 1
        except Exception as e:
            logger.warning("Weekly reminder send failed for %s: %s", profile.user.email, e)

    for profile in monthly_users:
        try:
            _send_reminder_email(profile, "monthly", now=now)
            profile.last_reminder_sent = now
            profile.save(update_fields=["last_reminder_sent"])
            sent_monthly += 1
        except Exception as e:
            logger.warning("Monthly reminder send failed for %s: %s", profile.user.email, e)

    return f"Sent {sent_weekly} weekly and {sent_monthly} monthly reminders"


@shared_task(
    bind=True, autoretry_for=(Exception,), retry_backoff=60, retry_kwargs={"max_retries": 3}
)
def send_trial_ending_reminder(self):
    """
    On day 5 of a 7-day trial, send a reminder: "Your trial ends in 2 days."
    Runs daily; sends to users whose trial_end is in 2 days (date).
    """
    if not _email_configured():
        logger.warning(
            "Trial ending reminder skipped: EMAIL_HOST_USER or EMAIL_HOST_PASSWORD not set"
        )
        return "Skipped (email not configured)"
    now = timezone.now()
    in_two_days = (now + timedelta(days=2)).date()
    profiles = UserProfile.objects.filter(
        subscription_status="trialing",
        trial_end__isnull=False,
        trial_end__date=in_two_days,
        email_preferences__billing_alerts=True,
    )
    sent = 0
    for profile in profiles:
        try:
            display_name = normalize_display_string(
                profile.user.first_name or profile.user.username
            )
            trial_end_str = None
            try:
                trial_end_str = (
                    profile.trial_end.strftime("%B %d, %Y") if profile.trial_end else None
                )
            except Exception:
                trial_end_str = None
            context = {
                "display_name": display_name,
                "trial_end_str": trial_end_str,
                "manage_url": f"{getattr(settings, 'FRONTEND_URL', 'https://monevo.tech').rstrip('/')}/billing",
            }
            html_message = render_to_string("emails/trial_ending.html", context)
            send_mail(
                "Your free trial ends in 2 days",
                strip_tags(html_message),
                settings.DEFAULT_FROM_EMAIL,
                [profile.user.email],
                html_message=html_message,
                fail_silently=False,
            )
            sent += 1
            logger.info("Sent trial ending reminder to %s", profile.user.email)
        except Exception as e:
            logger.error("Trial reminder send failed for %s: %s", profile.user.email, e)
    return f"Sent {sent} trial ending reminders"


@shared_task(
    bind=True, autoretry_for=(Exception,), retry_backoff=60, retry_kwargs={"max_retries": 3}
)
def send_subscription_cancelled_email(
    self, email: str, display_name: str, access_until_iso: str | None = None
):
    """
    Send a confirmation email after the user cancels their subscription.
    access_until_iso: ISO datetime string for current_period_end (optional).
    """
    if not _email_configured():
        logger.warning(
            "Subscription cancelled email skipped: EMAIL_HOST_USER or EMAIL_HOST_PASSWORD not set"
        )
        return "Skipped (email not configured)"
    try:
        access_until_str = None
        if access_until_iso:
            try:
                from datetime import datetime as dt_parse

                dt = dt_parse.fromisoformat(access_until_iso.replace("Z", "+00:00"))
                access_until_str = dt.strftime("%B %d, %Y")
            except Exception:
                access_until_str = (
                    access_until_iso[:10] if len(access_until_iso) >= 10 else access_until_iso
                )
            access_line = (
                f"You'll keep access until {access_until_str}. You won't be charged again.\n\n"
            )
        else:
            access_line = "You'll keep access until the end of your current billing period. You won't be charged again.\n\n"
        context = {
            "display_name": display_name,
            "access_until_str": access_until_str,
            "manage_url": f"{getattr(settings, 'FRONTEND_URL', 'https://monevo.tech').rstrip('/')}/billing",
            "year": timezone.now().year,
        }
        html_message = render_to_string("emails/subscription_cancelled.html", context)
        send_mail(
            "Your subscription has been cancelled",
            strip_tags(html_message),
            settings.DEFAULT_FROM_EMAIL,
            [email],
            html_message=html_message,
            fail_silently=False,
        )
        logger.info("Sent subscription cancelled email to %s", email)
        return "Sent"
    except Exception as e:
        logger.warning("Subscription cancelled email failed for %s: %s", email, e)
        return f"Failed: {e}"


@shared_task(
    bind=True, autoretry_for=(Exception,), retry_backoff=60, retry_kwargs={"max_retries": 3}
)
def send_welcome_email(self, user_id: int):
    if not _email_configured():
        return "Skipped (email not configured)"
    User = get_user_model()
    try:
        user = User.objects.get(id=user_id)
    except User.DoesNotExist:
        return "Skipped (user not found)"
    display_name = normalize_display_string(user.first_name or user.username or "there")
    context = {
        "display_name": display_name,
        "app_url": getattr(settings, "FRONTEND_URL", "https://monevo.tech"),
        "year": timezone.now().year,
    }
    html_message = render_to_string("emails/welcome.html", context)
    send_mail(
        "Welcome to Monevo",
        strip_tags(html_message),
        settings.DEFAULT_FROM_EMAIL,
        [user.email],
        html_message=html_message,
        fail_silently=False,
    )
    return "Sent"


@shared_task(
    bind=True, autoretry_for=(Exception,), retry_backoff=60, retry_kwargs={"max_retries": 3}
)
def send_referral_reward_emails(self, referrer_id: int, referred_id: int):
    User = get_user_model()
    try:
        referrer = User.objects.get(id=referrer_id)
        referred = User.objects.get(id=referred_id)
    except User.DoesNotExist:
        return "Skipped (user not found)"

    referrer_context = {
        "display_name": normalize_display_string(
            referrer.first_name or referrer.username or "there"
        ),
        "friend_name": normalize_display_string(
            referred.first_name or referred.username or "your friend"
        ),
        "bonus_coins": 10,
        "app_url": getattr(settings, "FRONTEND_URL", "https://monevo.tech"),
        "year": timezone.now().year,
    }
    referred_context = {
        "display_name": normalize_display_string(
            referred.first_name or referred.username or "there"
        ),
        "friend_name": normalize_display_string(
            referrer.first_name or referrer.username or "your friend"
        ),
        "bonus_coins": 5,
        "app_url": getattr(settings, "FRONTEND_URL", "https://monevo.tech"),
        "year": timezone.now().year,
    }

    referrer_prefs = UserEmailPreference.objects.filter(user=referrer).first()
    referred_prefs = UserEmailPreference.objects.filter(user=referred).first()

    html_referrer = render_to_string("emails/referral_reward_referrer.html", referrer_context)
    if not referrer_prefs or referrer_prefs.reminders:
        send_mail(
            "Your friend joined Monevo! You earned bonus coins",
            strip_tags(html_referrer),
            settings.DEFAULT_FROM_EMAIL,
            [referrer.email],
            html_message=html_referrer,
            fail_silently=False,
        )

    html_referred = render_to_string("emails/referral_reward_referred.html", referred_context)
    if not referred_prefs or referred_prefs.reminders:
        send_mail(
            "Welcome! You received a referral bonus",
            strip_tags(html_referred),
            settings.DEFAULT_FROM_EMAIL,
            [referred.email],
            html_message=html_referred,
            fail_silently=False,
        )
    return "Sent"


@shared_task(
    bind=True, autoretry_for=(Exception,), retry_backoff=60, retry_kwargs={"max_retries": 3}
)
def send_streak_broken_email(self, user_id: int, streak_count: int):
    if streak_count <= 3:
        return "Skipped (streak too short)"
    User = get_user_model()
    try:
        user = User.objects.get(id=user_id)
    except User.DoesNotExist:
        return "Skipped (user not found)"
    context = {
        "display_name": normalize_display_string(user.first_name or user.username or "there"),
        "streak_count": streak_count,
        "app_url": getattr(settings, "FRONTEND_URL", "https://monevo.tech"),
        "year": timezone.now().year,
    }
    html_message = render_to_string("emails/streak_broken.html", context)
    email_prefs = UserEmailPreference.objects.filter(user=user).first()
    if email_prefs and not email_prefs.streak_alerts:
        return "Skipped (user disabled streak alerts)"
    send_mail(
        "Your streak ended - start a new one today",
        strip_tags(html_message),
        settings.DEFAULT_FROM_EMAIL,
        [user.email],
        html_message=html_message,
        fail_silently=False,
    )
    return "Sent"


@shared_task(
    bind=True, autoretry_for=(Exception,), retry_backoff=60, retry_kwargs={"max_retries": 3}
)
def send_renewal_reminder(self):
    if not _email_configured():
        return "Skipped (email not configured)"
    if not getattr(settings, "STRIPE_SECRET_KEY", ""):
        return "Skipped (stripe not configured)"

    stripe.api_key = settings.STRIPE_SECRET_KEY
    target_date = (timezone.now() + timedelta(days=3)).date()
    profiles = UserProfile.objects.filter(
        subscription_status__in=["active", "trialing"],
        stripe_subscription_id__isnull=False,
        user__email__isnull=False,
        email_preferences__billing_alerts=True,
    ).select_related("user")

    sent = 0
    for profile in profiles:
        sub_id = (profile.stripe_subscription_id or "").strip()
        if not sub_id:
            continue
        try:
            sub = stripe.Subscription.retrieve(sub_id)
            period_end = getattr(sub, "current_period_end", None)
            if not period_end:
                continue
            renewal_dt = datetime.fromtimestamp(period_end, tz=timezone.utc)
            if renewal_dt.date() != target_date:
                continue
            context = {
                "display_name": normalize_display_string(
                    profile.user.first_name or profile.user.username or "there"
                ),
                "renewal_date": renewal_dt.strftime("%B %d, %Y"),
                "manage_url": f"{getattr(settings, 'FRONTEND_URL', 'https://monevo.tech').rstrip('/')}/billing",
                "year": timezone.now().year,
            }
            html_message = render_to_string("emails/renewal_reminder.html", context)
            send_mail(
                "Upcoming renewal reminder",
                strip_tags(html_message),
                settings.DEFAULT_FROM_EMAIL,
                [profile.user.email],
                html_message=html_message,
                fail_silently=False,
            )
            sent += 1
        except Exception as exc:
            logger.warning("Failed renewal reminder for profile=%s: %s", profile.id, exc)
    return f"Sent {sent} renewal reminders"

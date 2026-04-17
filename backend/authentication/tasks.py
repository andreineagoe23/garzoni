# authentication/tasks.py
from __future__ import annotations

import logging
from datetime import datetime, timedelta

import stripe
from celery import shared_task
from django.conf import settings
from django.contrib.auth import get_user_model
from django.db.models import Q, Sum
from django.utils import timezone

from authentication.models import UserEmailPreference, UserProfile
from authentication.user_display import normalize_display_string
from education.models import LessonCompletion
from finance.models import UserPurchase
from notifications.delivery_smtp import smtp_configured
from notifications.enums import CioEventName, CioTemplate
from notifications.service import NotificationService

logger = logging.getLogger(__name__)


def _email_configured() -> bool:
    """Return True if an email backend has enough config to send (SMTP/Anymail/console)."""
    return smtp_configured() or getattr(settings, "CIO_TRANSACTIONAL_ENABLED", False)


def _journey_reminders_mode() -> bool:
    return bool(
        getattr(settings, "CIO_REMINDERS_VIA_JOURNEYS", False)
        and getattr(settings, "CIO_JOURNEY_EVENTS_ENABLED", False)
        and getattr(settings, "CIO_TRACK_ENABLED", False)
    )


@shared_task(
    bind=True, autoretry_for=(Exception,), retry_backoff=60, retry_kwargs={"max_retries": 3}
)
def send_email_reminders(self):
    """
    Send email reminders to users based on their preferences.
    When CIO_REMINDERS_VIA_JOURNEYS is enabled, emit track events only; Customer.io journeys deliver mail.
    """
    if not _email_configured():
        logger.warning("Email reminders skipped: email not configured")
        return "Skipped (email not configured)"
    now = timezone.now()
    weekly_cutoff = now - timedelta(days=7)
    monthly_cutoff = now - timedelta(days=28)

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

    svc = NotificationService()
    sent_weekly, sent_monthly = 0, 0

    for profile in weekly_users:
        try:
            if _journey_reminders_mode():
                svc.track_journey_eligible(
                    profile.user,
                    CioEventName.WEEKLY_DIGEST_ELIGIBLE,
                    {"frequency": "weekly", "source": "celery_beat"},
                )
            else:
                week_start = now - timedelta(days=7)
                lessons_completed_this_week = LessonCompletion.objects.filter(
                    user_progress__user=profile.user,
                    completed_at__gte=week_start,
                ).count()
                coins_spent = (
                    UserPurchase.objects.filter(
                        user=profile.user, purchased_at__gte=week_start
                    ).aggregate(total=Sum("reward__cost"))["total"]
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
                    "app_url": getattr(settings, "FRONTEND_URL", "https://garzoni.app"),
                    "manage_url": f"{getattr(settings, 'FRONTEND_URL', 'https://garzoni.app').rstrip('/')}/dashboard",
                    "year": now.year,
                }
                r = svc.send_template_for_user(
                    profile.user,
                    CioTemplate.WEEKLY_DIGEST,
                    subject="Your Weekly Garzoni Progress Digest",
                    django_template="emails/weekly_digest.html",
                    context=context,
                    idempotency_key=f"weekly_digest:{profile.pk}:{now.date().isoformat()}",
                    purpose="weekly_digest",
                )
                if r.startswith("policy_denied") or r.startswith("skipped"):
                    continue
            profile.last_reminder_sent = now
            profile.save(update_fields=["last_reminder_sent"])
            sent_weekly += 1
        except Exception as e:
            logger.warning("Weekly reminder failed for %s: %s", profile.user.email, e)

    for profile in monthly_users:
        try:
            if _journey_reminders_mode():
                svc.track_journey_eligible(
                    profile.user,
                    CioEventName.MONTHLY_REMINDER_ELIGIBLE,
                    {"frequency": "monthly", "source": "celery_beat"},
                )
            else:
                api_base = (getattr(settings, "BACKEND_URL", "") or "").rstrip("/")
                context = {
                    "user": profile.user,
                    "frequency": "monthly",
                    "app_url": getattr(settings, "FRONTEND_URL", "https://garzoni.app"),
                    "preferences_link": f"{getattr(settings, 'FRONTEND_URL', 'https://garzoni.app').rstrip('/')}/settings",
                    "unsubscribe_link": f"{api_base}/email/unsubscribe/?token={profile.get_unsubscribe_token()}",
                    "year": now.year,
                }
                r = svc.send_template_for_user(
                    profile.user,
                    CioTemplate.REMINDER_MONTHLY,
                    subject="Monthly Reminder: Continue Your Financial Learning",
                    django_template="emails/reminder.html",
                    context=context,
                    idempotency_key=f"monthly_reminder:{profile.pk}:{now.date().isoformat()}",
                    purpose="monthly_reminder",
                )
                if r.startswith("policy_denied") or r.startswith("skipped"):
                    continue
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
    if not _email_configured():
        logger.warning("Trial ending reminder skipped: email not configured")
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
    svc = NotificationService()
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
            if _journey_reminders_mode():
                svc.track_journey_eligible(
                    profile.user,
                    CioEventName.TRIAL_ENDING_SOON,
                    {
                        "trial_end_str": trial_end_str or "",
                        "display_name": display_name,
                    },
                )
            else:
                context = {
                    "display_name": display_name,
                    "trial_end_str": trial_end_str,
                    "manage_url": f"{getattr(settings, 'FRONTEND_URL', 'https://garzoni.app').rstrip('/')}/billing",
                }
                r = svc.send_template_for_user(
                    profile.user,
                    CioTemplate.TRIAL_ENDING,
                    subject="Your free trial ends in 2 days",
                    django_template="emails/trial_ending.html",
                    context=context,
                    idempotency_key=f"trial_ending:{profile.pk}:{in_two_days.isoformat()}",
                    purpose="trial_ending",
                )
                if r.startswith("policy_denied") or r.startswith("skipped"):
                    continue
            sent += 1
            logger.info("Trial ending notification for %s", profile.user.email)
        except Exception as e:
            logger.error("Trial reminder failed for %s: %s", profile.user.email, e)
    return f"Sent {sent} trial ending reminders"


@shared_task(
    bind=True, autoretry_for=(Exception,), retry_backoff=60, retry_kwargs={"max_retries": 3}
)
def send_subscription_cancelled_email(
    self,
    email: str,
    display_name: str,
    access_until_iso: str | None = None,
    user_id: int | None = None,
):
    if not _email_configured():
        logger.warning("Subscription cancelled email skipped: email not configured")
        return "Skipped (email not configured)"
    User = get_user_model()
    user = User.objects.filter(pk=user_id).first() if user_id else None
    try:
        result = NotificationService().send_subscription_cancelled(
            email=email,
            display_name=display_name,
            access_until_iso=access_until_iso,
            user=user,
            idempotency_key=(
                f"sub_cancelled:{user_id or email}:{(access_until_iso or '')[:16]}"
                if user_id or email
                else None
            ),
        )
        logger.info("Subscription cancelled email result=%s to=%s", result, email)
        return result
    except Exception as e:
        logger.warning("Subscription cancelled email failed for %s: %s", email, e)
        return f"Failed: {e}"


@shared_task(
    bind=True, autoretry_for=(Exception,), retry_backoff=60, retry_kwargs={"max_retries": 3}
)
def send_welcome_email(self, user_id: int):
    """Delegates to notifications.tasks for identify + delivery (keeps Celery task name stable)."""
    from notifications.tasks import send_welcome_email_task

    return send_welcome_email_task(user_id, idempotency_key=f"welcome:{user_id}")


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
        "app_url": getattr(settings, "FRONTEND_URL", "https://garzoni.app"),
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
        "app_url": getattr(settings, "FRONTEND_URL", "https://garzoni.app"),
        "year": timezone.now().year,
    }

    svc = NotificationService()
    referrer_prefs = UserEmailPreference.objects.filter(user=referrer).first()
    if not referrer_prefs or referrer_prefs.reminders:
        svc.send_template_for_user(
            referrer,
            CioTemplate.REFERRAL_REFERRER,
            subject="Your friend joined Garzoni! You earned bonus coins",
            django_template="emails/referral_reward_referrer.html",
            context=referrer_context,
            idempotency_key=f"referral_referrer:{referrer_id}:{referred_id}",
            purpose="referral_referrer",
        )

    referred_prefs = UserEmailPreference.objects.filter(user=referred).first()
    if not referred_prefs or referred_prefs.reminders:
        svc.send_template_for_user(
            referred,
            CioTemplate.REFERRAL_REFERRED,
            subject="Welcome! You received a referral bonus",
            django_template="emails/referral_reward_referred.html",
            context=referred_context,
            idempotency_key=f"referral_referred:{referrer_id}:{referred_id}",
            purpose="referral_referred",
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
        "app_url": getattr(settings, "FRONTEND_URL", "https://garzoni.app"),
        "year": timezone.now().year,
    }
    NotificationService().send_template_for_user(
        user,
        CioTemplate.STREAK_BROKEN,
        subject="Your streak ended - start a new one today",
        django_template="emails/streak_broken.html",
        context=context,
        idempotency_key=f"streak_broken:{user_id}:{streak_count}",
        purpose="streak_broken",
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
    svc = NotificationService()
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
            if _journey_reminders_mode():
                svc.track_journey_eligible(
                    profile.user,
                    CioEventName.RENEWAL_UPCOMING,
                    {
                        "renewal_date": renewal_dt.strftime("%B %d, %Y"),
                        "stripe_subscription_id": sub_id,
                    },
                )
            else:
                context = {
                    "display_name": normalize_display_string(
                        profile.user.first_name or profile.user.username or "there"
                    ),
                    "renewal_date": renewal_dt.strftime("%B %d, %Y"),
                    "manage_url": f"{getattr(settings, 'FRONTEND_URL', 'https://garzoni.app').rstrip('/')}/billing",
                    "year": timezone.now().year,
                }
                r = svc.send_template_for_user(
                    profile.user,
                    CioTemplate.RENEWAL_REMINDER,
                    subject="Upcoming renewal reminder",
                    django_template="emails/renewal_reminder.html",
                    context=context,
                    idempotency_key=f"renewal_reminder:{profile.pk}:{target_date.isoformat()}",
                    purpose="renewal_reminder",
                )
                if r.startswith("policy_denied") or r.startswith("skipped"):
                    continue
            sent += 1
        except Exception as exc:
            logger.warning("Failed renewal reminder for profile=%s: %s", profile.id, exc)
    return f"Sent {sent} renewal reminders"

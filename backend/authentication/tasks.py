# authentication/tasks.py
from celery import shared_task
from django.core.mail import send_mail
from django.db.models import Q
from django.template.loader import render_to_string
from django.utils.html import strip_tags
from django.conf import settings
from django.utils import timezone
from datetime import timedelta
import logging

from authentication.models import UserProfile
from authentication.user_display import normalize_display_string

logger = logging.getLogger(__name__)


def _email_configured():
    """Return True if SMTP is configured (needed for reminders and trial emails)."""
    return bool(
        getattr(settings, "EMAIL_HOST_USER", None)
        and getattr(settings, "EMAIL_HOST_PASSWORD", None)
    )


@shared_task
def send_email_reminders():
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
            email_reminder_preference="weekly",
            user__email__isnull=False,
        )
        .exclude(last_reminder_sent__gt=now - timedelta(days=6))
        .filter(Q(user__last_login__isnull=True) | Q(user__last_login__lt=weekly_cutoff))
        .select_related("user")
    )

    monthly_users = (
        UserProfile.objects.filter(
            email_reminder_preference="monthly",
            user__email__isnull=False,
        )
        .exclude(last_reminder_sent__gt=now - timedelta(days=27))
        .filter(Q(user__last_login__isnull=True) | Q(user__last_login__lt=monthly_cutoff))
        .select_related("user")
    )

    sent_weekly, sent_monthly = 0, 0
    for profile in weekly_users:
        try:
            send_mail(
                "Weekly Reminder: Your Financial Learning Journey Awaits",
                f"""Hi {normalize_display_string(profile.user.username)},

It's been a week since your last login. Your financial learning journey is waiting for you!

Your current progress:
- Balance: {profile.earned_money} coins
- Points: {profile.points}
- Streak: {profile.streak} days

Don't let your streak break! Come back and continue learning.

Best regards,
The Monevo Team""",
                settings.DEFAULT_FROM_EMAIL,
                [profile.user.email],
                fail_silently=True,
            )
            profile.last_reminder_sent = now
            profile.save(update_fields=["last_reminder_sent"])
            sent_weekly += 1
        except Exception as e:
            logger.warning("Weekly reminder send failed for %s: %s", profile.user.email, e)

    for profile in monthly_users:
        try:
            send_mail(
                "Monthly Reminder: Continue Your Financial Learning",
                f"""Hi {normalize_display_string(profile.user.username)},

It's been a while since your last visit. Your progress is saved and we'd love to see you back!

Your current progress:
- Balance: {profile.earned_money} coins
- Points: {profile.points}
- Streak: {profile.streak} days

Pick up where you left off and keep building your financial knowledge.

Best regards,
The Monevo Team""",
                settings.DEFAULT_FROM_EMAIL,
                [profile.user.email],
                fail_silently=True,
            )
            profile.last_reminder_sent = now
            profile.save(update_fields=["last_reminder_sent"])
            sent_monthly += 1
        except Exception as e:
            logger.warning("Monthly reminder send failed for %s: %s", profile.user.email, e)

    return f"Sent {sent_weekly} weekly and {sent_monthly} monthly reminders"


@shared_task
def send_trial_ending_reminder():
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
    )
    sent = 0
    for profile in profiles:
        try:
            send_mail(
                "Your free trial ends in 2 days",
                f"""Hi {normalize_display_string(profile.user.first_name or profile.user.username)},

Your Monevo free trial ends in 2 days. On the trial end date you'll be charged the full yearly amount for your plan.

If you have any questions, visit your subscription settings or contact support.

Best regards,
The Monevo Team""",
                settings.DEFAULT_FROM_EMAIL,
                [profile.user.email],
                fail_silently=True,
            )
            sent += 1
            logger.info("Sent trial ending reminder to %s", profile.user.email)
        except Exception as e:
            logger.error("Trial reminder send failed for %s: %s", profile.user.email, e)
    return f"Sent {sent} trial ending reminders"


@shared_task
def send_subscription_cancelled_email(
    email: str, display_name: str, access_until_iso: str | None = None
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
        send_mail(
            "Your subscription has been cancelled",
            f"""Hi {display_name},

We've cancelled your Monevo subscription as requested.

{access_line}If you change your mind, you can resubscribe anytime from your account.

Best regards,
The Monevo Team""",
            settings.DEFAULT_FROM_EMAIL,
            [email],
            fail_silently=True,
        )
        logger.info("Sent subscription cancelled email to %s", email)
        return "Sent"
    except Exception as e:
        logger.warning("Subscription cancelled email failed for %s: %s", email, e)
        return f"Failed: {e}"


def send_emails(profiles, frequency):
    """
    Send reminder emails to a list of user profiles.

    - Generates an email context for each user, including an unsubscribe link.
    - Sends an email with the appropriate frequency (weekly or monthly).
    - Logs success or failure for each email sent.
    """
    for profile in profiles:
        try:
            context = {
                "user": profile.user,
                "frequency": frequency,
                "unsubscribe_link": f"https://monevo.tech/settings?token={profile.get_unsubscribe_token()}",
            }
            html_message = render_to_string("emails/reminder.html", context)

            send_mail(
                subject=f"Your {frequency.capitalize()} Financial Reminder",
                message=strip_tags(html_message),
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=[profile.user.email],
                html_message=html_message,
            )
            logger.info(f"Sent {frequency} email to {profile.user.email}")
        except Exception as e:
            logger.error(f"Failed to send {frequency} email to {profile.user.email}: {str(e)}")

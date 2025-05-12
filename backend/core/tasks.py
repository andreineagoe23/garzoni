from celery import shared_task
from django.core.mail import send_mail
from django.template.loader import render_to_string
from .models import UserProfile
import logging
from celery import shared_task
from django.utils import timezone
from django.contrib.auth.models import User
from django.db.models import Max
from django.utils.html import strip_tags
from django.conf import settings
from .models import UserProgress

logger = logging.getLogger(__name__)

@shared_task
def send_email_reminders():
    """
    Send email reminders to users based on their email frequency preferences.
    
    - Daily emails are sent every day.
    - Weekly emails are sent only on Mondays.
    - Monthly emails are sent on the 1st of each month.
    
    Logs the number of emails sent for each frequency type.
    """
    logger.info("Starting send_email_reminders task")
    try:
        today = timezone.now().date()
        daily_users = UserProfile.objects.filter(
            email_reminders=True,
            email_frequency='daily'
        )

        # Weekly emails only on Mondays
        if today.weekday() == 0:  # Monday
            weekly_users = UserProfile.objects.filter(
                email_reminders=True,
                email_frequency='weekly'
            )
            send_emails(weekly_users, 'weekly')

        # Monthly emails on 1st of month
        if today.day == 1:
            monthly_users = UserProfile.objects.filter(
                email_reminders=True,
                email_frequency='monthly'
            )
            send_emails(monthly_users, 'monthly')

        # Send daily emails
        send_emails(daily_users, 'daily')

        return f"Sent {daily_users.count()} daily, " \
               f"{weekly_users.count() if 'weekly_users' in locals() else 0} weekly, " \
               f"{monthly_users.count() if 'monthly_users' in locals() else 0} monthly emails"
    except Exception as e:
        logger.error(f"Task failed: {e}")
        raise e

@shared_task
def reset_inactive_streaks():
    """
    Reset streaks for users who have been inactive for over 24 hours.
    
    - Checks the last activity date for each user.
    - If a user has been inactive for more than a day, their streak is reset to 0.
    """
    users = User.objects.annotate(last_active=Max('userprogress__last_completed_date'))

    for user in users:
        if user.last_active:
            today = timezone.now().date()
            days_inactive = (today - user.last_active).days
            if days_inactive > 1:
                UserProgress.objects.filter(user=user).update(streak=0)

def send_emails(profiles, frequency):
    """
    Send reminder emails to a list of user profiles.
    
    - Generates an email context for each user, including an unsubscribe link.
    - Sends an email with the appropriate frequency (daily, weekly, or monthly).
    - Logs success or failure for each email sent.
    """
    for profile in profiles:
        try:
            context = {
                'user': profile.user,
                'frequency': frequency,
                'unsubscribe_link': f"https://monevo.tech/settings?token={profile.get_unsubscribe_token()}"
            }
            html_message = render_to_string('emails/reminder.html', context)

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

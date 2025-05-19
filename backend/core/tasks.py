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
from datetime import timedelta

logger = logging.getLogger(__name__)

@shared_task
def send_email_reminders():
    """
    Send email reminders to users based on their preferences.
    Daily reminders are sent to users who haven't logged in for 24 hours.
    Weekly reminders are sent to users who haven't logged in for 7 days.
    """
    now = timezone.now()
    
    # Get users who want daily reminders and haven't logged in for 24 hours
    daily_users = UserProfile.objects.filter(
        email_reminder_preference='daily',
        last_login_date__lt=now.date() - timedelta(days=1)
    ).exclude(
        last_reminder_sent__gt=now - timedelta(hours=23)  # Don't send if reminder was sent in last 23 hours
    )

    # Get users who want weekly reminders and haven't logged in for 7 days
    weekly_users = UserProfile.objects.filter(
        email_reminder_preference='weekly',
        last_login_date__lt=now.date() - timedelta(days=7)
    ).exclude(
        last_reminder_sent__gt=now - timedelta(days=6)  # Don't send if reminder was sent in last 6 days
    )

    # Send daily reminders
    for profile in daily_users:
        send_mail(
            'Daily Reminder: Continue Your Financial Learning Journey',
            f'''Hi {profile.user.username},

We noticed you haven't logged in for a while. Don't forget to continue your financial learning journey!

Your current progress:
- Balance: {profile.earned_money} coins
- Points: {profile.points}
- Streak: {profile.streak} days

Keep up the great work and maintain your streak!

Best regards,
The Monevo Team''',
            settings.DEFAULT_FROM_EMAIL,
            [profile.user.email],
            fail_silently=False,
        )
        profile.last_reminder_sent = now
        profile.save()

    # Send weekly reminders
    for profile in weekly_users:
        send_mail(
            'Weekly Reminder: Your Financial Learning Journey Awaits',
            f'''Hi {profile.user.username},

It's been a week since your last login. Your financial learning journey is waiting for you!

Your current progress:
- Balance: {profile.earned_money} coins
- Points: {profile.points}
- Streak: {profile.streak} days

Don't let your streak break! Come back and continue learning.

Best regards,
The Monevo Team''',
            settings.DEFAULT_FROM_EMAIL,
            [profile.user.email],
            fail_silently=False,
        )
        profile.last_reminder_sent = now
        profile.save()

    return f"Sent {daily_users.count()} daily and {weekly_users.count()} weekly reminders"

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

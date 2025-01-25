from celery import shared_task
from django.core.mail import send_mail
from django.template.loader import render_to_string
from .models import UserProfile
import logging

logger = logging.getLogger(__name__)

@shared_task
def send_email_reminders():
    logger.info("Starting send_email_reminders task")
    try:
        profiles = UserProfile.objects.filter(email_reminders=True)
        if not profiles.exists():
            logger.info("No users to send reminders to.")
            return "No users to send reminders to."

        for profile in profiles:
            try:
                html_message = render_to_string(
                    'emails/reminder.html', {'user': profile.user}
                )
                send_mail(
                    subject="Reminder: Continue Your Learning Path on Monevo",
                    message="This is a fallback plain text message.",
                    from_email="no-reply@monevo.com",
                    recipient_list=[profile.user.email],
                    html_message=html_message,
                )
                logger.info(f"Email sent to {profile.user.email}")
            except Exception as e:
                logger.error(f"Error sending email to {profile.user.email}: {e}")
        return "Emails sent successfully."
    except Exception as e:
        logger.error(f"Task failed: {e}")
        raise e

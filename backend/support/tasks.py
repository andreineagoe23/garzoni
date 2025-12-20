from celery import shared_task
from django.conf import settings
from django.core.mail import send_mail
import logging

logger = logging.getLogger(__name__)


@shared_task(bind=True, autoretry_for=(Exception,), retry_backoff=True, retry_kwargs={"max_retries": 3})
def send_contact_email(self, email: str, topic: str, message: str) -> None:
    """
    Send contact form notifications asynchronously.
    """
    recipients = (
        [settings.CONTACT_EMAIL]
        if hasattr(settings, "CONTACT_EMAIL") and settings.CONTACT_EMAIL
        else [settings.DEFAULT_FROM_EMAIL]
    )

    send_mail(
        f"[Contact Form] {topic}",
        f"From: {email}\n\n{message}",
        settings.DEFAULT_FROM_EMAIL,
        recipients,
        fail_silently=False,
    )



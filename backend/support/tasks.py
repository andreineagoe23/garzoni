import logging

from celery import shared_task

from notifications.service import NotificationService

logger = logging.getLogger(__name__)


@shared_task(
    bind=True,
    autoretry_for=(Exception,),
    retry_backoff=True,
    retry_kwargs={"max_retries": 3},
)
def send_contact_email(self, email: str, topic: str, message: str) -> None:
    """Send contact form notifications asynchronously (internal staff mail via NotificationService)."""
    NotificationService().send_staff_contact_email(from_email=email, topic=topic, message=message)

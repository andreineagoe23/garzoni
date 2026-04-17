import logging
import sys
import uuid

from django.conf import settings
from django.contrib.auth.models import User
from django.db import transaction
from django.db.models.signals import post_save, pre_save
from django.dispatch import receiver
from django_rest_passwordreset.signals import reset_password_token_created

from authentication.models import UserEmailPreference, UserProfile
from authentication.tasks import send_welcome_email
from core.utils import normalize_text_encoding
from notifications.tasks import send_password_reset_email_task

logger = logging.getLogger(__name__)


@receiver(pre_save, sender=User)
def normalize_user_identity_fields(sender, instance, **kwargs):
    """
    Normalize User identity fields before every save so mojibake does not persist
    back to the database (e.g. RoÈ™u -> Roșu, Â£ -> £).
    """
    instance.username = normalize_text_encoding(instance.username) or ""
    instance.first_name = normalize_text_encoding(instance.first_name) or ""
    instance.last_name = normalize_text_encoding(instance.last_name) or ""
    instance.email = normalize_text_encoding(instance.email) or ""


@receiver(post_save, sender=User)
def create_user_profile(sender, instance, created, **kwargs):
    """
    Signal handler that automatically creates a UserProfile for a newly created User.
    Generates a unique referral code for the user profile upon creation.
    Skip during loaddata so fixture UserProfile rows load without duplicate-key errors.
    """
    if "loaddata" in sys.argv:
        return
    if created:
        profile, created = UserProfile.objects.get_or_create(user=instance)
        if created:
            profile.referral_code = uuid.uuid4().hex[:8].upper()
            profile.save()
        UserEmailPreference.objects.get_or_create(
            user=instance,
            defaults={
                "reminder_frequency": profile.email_reminder_preference,
                "reminders": profile.email_reminder_preference != "none",
            },
        )

        # Dispatch welcome email after DB commit (Celery). If the broker is unavailable, log only.
        def _enqueue_welcome():
            try:
                send_welcome_email.delay(instance.id)
            except Exception:
                logger.warning(
                    "send_welcome_email task dispatch failed for user_id=%s — "
                    "broker may be unavailable (Redis, Celery).",
                    instance.id,
                    exc_info=True,
                )

        transaction.on_commit(_enqueue_welcome)


@receiver(reset_password_token_created)
def on_password_reset_token_created(sender, instance, reset_password_token, **kwargs):
    """
    django-rest-passwordreset only emits this signal; it does not send email itself.
    Queue the same NotificationService path as the custom password-reset API.
    Reset link targets the SPA + POST /api/auth/drf-password-reset/confirm/ (see authentication.urls).
    """
    user = reset_password_token.user
    base = getattr(settings, "FRONTEND_URL", "https://garzoni.app").rstrip("/")
    reset_link = f"{base}/password-reset?token={reset_password_token.key}"
    idempotency_key = f"pwd_reset:{user.pk}:{uuid.uuid4().hex[:12]}"

    def _enqueue():
        try:
            send_password_reset_email_task.delay(user.pk, reset_link, idempotency_key=idempotency_key)
        except Exception:
            logger.warning(
                "send_password_reset_email_task dispatch failed for user_id=%s — "
                "broker may be unavailable (Redis, Celery).",
                user.pk,
                exc_info=True,
            )

    transaction.on_commit(_enqueue)

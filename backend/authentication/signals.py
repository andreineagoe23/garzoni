import logging
import sys
import threading
import uuid

from django.conf import settings
from django.contrib.auth.models import User
from django.db import transaction
from django.db.models.signals import post_save, pre_save
from django.dispatch import receiver

from authentication.models import UserEmailPreference, UserProfile
from authentication.tasks import send_welcome_email
from core.utils import normalize_text_encoding
from notifications.tasks import safe_enqueue_sync_user_to_customer_io

# Fields whose change should re-push the CIO profile so email/name stay in sync.
_CIO_SYNC_FIELDS = ("email", "first_name", "last_name", "username")

logger = logging.getLogger(__name__)


@receiver(pre_save, sender=User)
def normalize_user_identity_fields(sender, instance, **kwargs):
    """
    Normalize User identity fields before every save so mojibake does not persist
    back to the database (e.g. RoÈ™u -> Roșu, Â£ -> £).

    Also snapshot identity fields onto the instance so post_save can detect changes
    and re-sync the profile to Customer.io when email/name shifts.
    """
    instance.username = normalize_text_encoding(instance.username) or ""
    instance.first_name = normalize_text_encoding(instance.first_name) or ""
    instance.last_name = normalize_text_encoding(instance.last_name) or ""
    instance.email = normalize_text_encoding(instance.email) or ""

    if instance.pk:
        try:
            prev = User.objects.only(*_CIO_SYNC_FIELDS).get(pk=instance.pk)
        except User.DoesNotExist:
            instance._cio_prev_identity = None
        else:
            instance._cio_prev_identity = {f: getattr(prev, f, "") for f in _CIO_SYNC_FIELDS}
    else:
        instance._cio_prev_identity = None


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
        # GDPR-safe defaults: service/transactional preferences ON (legitimate
        # interest / performance-of-contract under UK GDPR + EU GDPR), marketing
        # OFF until the user explicitly opts in (UK PECR reg. 22 + EU ePrivacy).
        # A marketing opt-in from the signup form is passed via the transient
        # attribute `_signup_marketing_opt_in` on the User instance.
        UserEmailPreference.objects.get_or_create(
            user=instance,
            defaults={
                "reminders": True,
                "streak_alerts": True,
                "weekly_digest": True,
                "billing_alerts": True,
                "push_notifications": True,
                "reminder_frequency": "weekly",
                "marketing": bool(getattr(instance, "_signup_marketing_opt_in", False)),
            },
        )

        # Dispatch welcome email after DB commit (Celery). Run publish in a daemon thread so a
        # slow/unreachable Redis broker cannot block the HTTP worker (Google OAuth callback, etc.);
        # Gunicorn would otherwise abort the worker with SystemExit after timeout — not catchable
        # as Exception and visible in Sentry as an unhandled crash.
        user_id = instance.pk

        def _enqueue_welcome():
            def _dispatch():
                try:
                    send_welcome_email.delay(user_id)
                except Exception:
                    logger.warning(
                        "send_welcome_email task dispatch failed for user_id=%s — "
                        "broker may be unavailable (Redis, Celery).",
                        user_id,
                        exc_info=True,
                    )

            threading.Thread(target=_dispatch, daemon=True).start()

        transaction.on_commit(_enqueue_welcome)

        # Identify the user to Customer.io the moment the row exists so CIO has
        # email + traits before any transactional send. Daemon thread so a slow
        # Redis broker cannot block the HTTP worker (Google/Apple OAuth callback).
        new_user_id = instance.pk

        def _enqueue_cio_sync():
            def _dispatch():
                try:
                    safe_enqueue_sync_user_to_customer_io(new_user_id)
                except Exception:
                    logger.warning(
                        "safe_enqueue_sync_user_to_customer_io failed for user_id=%s on create",
                        new_user_id,
                        exc_info=True,
                    )

            threading.Thread(target=_dispatch, daemon=True).start()

        transaction.on_commit(_enqueue_cio_sync)
        return

    # Update path: re-push identify if any tracked identity field actually changed.
    prev = getattr(instance, "_cio_prev_identity", None)
    if not prev:
        return
    changed = any((prev.get(f) or "") != (getattr(instance, f, "") or "") for f in _CIO_SYNC_FIELDS)
    if not changed:
        return
    user_id = instance.pk

    def _enqueue_cio_update_sync():
        def _dispatch():
            try:
                safe_enqueue_sync_user_to_customer_io(user_id)
            except Exception:
                logger.warning(
                    "safe_enqueue_sync_user_to_customer_io failed for user_id=%s on update",
                    user_id,
                    exc_info=True,
                )

        threading.Thread(target=_dispatch, daemon=True).start()

    transaction.on_commit(_enqueue_cio_update_sync)


@receiver(post_save, sender=UserEmailPreference)
def resync_cio_on_pref_change(sender, instance, created, **kwargs):
    """Propagate opt-in/frequency changes to Customer.io as profile traits."""
    user_id = getattr(instance, "user_id", None)
    if not user_id:
        return

    def _enqueue():
        def _dispatch():
            try:
                safe_enqueue_sync_user_to_customer_io(user_id)
            except Exception:
                logger.warning(
                    "safe_enqueue_sync_user_to_customer_io failed for user_id=%s on pref change",
                    user_id,
                    exc_info=True,
                )

        threading.Thread(target=_dispatch, daemon=True).start()

    transaction.on_commit(_enqueue)

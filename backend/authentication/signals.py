import logging
import sys
import threading
import uuid

from django.conf import settings
from django.contrib.auth.models import User
from django.contrib.auth.signals import user_logged_in
from django.db import transaction
from django.db.models.signals import post_delete, post_save, pre_save
from django.dispatch import receiver

from authentication.models import UserEmailPreference, UserProfile
from authentication.services.profile_analytics import (
    sync_last_login_date,
    update_last_seen_platform,
)
from authentication.tasks import send_welcome_email
from core.request_platform import resolve_request_platform
from core.utils import normalize_text_encoding
from notifications.identity import customer_io_person_id
from notifications.tasks import (
    safe_enqueue_delete_user_from_customer_io,
    safe_enqueue_sync_user_to_customer_io,
)

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
            prev = User.objects.only(*_CIO_SYNC_FIELDS, "last_login").get(pk=instance.pk)
        except User.DoesNotExist:
            instance._cio_prev_identity = None
            instance._profile_prev_last_login = None
        else:
            instance._cio_prev_identity = {f: getattr(prev, f, "") for f in _CIO_SYNC_FIELDS}
            instance._profile_prev_last_login = prev.last_login
    else:
        instance._cio_prev_identity = None
        instance._profile_prev_last_login = None


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
    prev_login = getattr(instance, "_profile_prev_last_login", None)
    if instance.last_login and instance.last_login != prev_login:
        sync_last_login_date(instance, when=instance.last_login)
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


@receiver(post_delete, sender=User)
def delete_customer_io_profile(sender, instance, **kwargs):
    """Remove the Customer.io profile whenever a User row disappears.

    The account-deletion view already called this explicitly, but that covered
    exactly one of the ways a user can be removed. Deletions from the Django
    admin, a management shell, a data migration or a cascade all bypassed it, and
    the profile was left behind forever — 89 of the 179 profiles in the workspace
    on 2026-08-20 had no Django row at all. A profile that outlives its account
    still enters journeys and still fails every email send.

    post_delete rather than pre_delete so the profile is only removed once the
    row is actually gone; `instance.pk` is still populated here. Enqueued on
    commit so a rolled-back transaction does not delete a live person's profile.
    """
    person_id = customer_io_person_id(instance)
    if not person_id or person_id == "None":
        return

    def _dispatch():
        safe_enqueue_delete_user_from_customer_io(person_id)

    try:
        transaction.on_commit(_dispatch)
    except Exception:
        # Outside an atomic block on_commit runs inline; if it raises, never let
        # a messaging concern block the deletion itself.
        logger.exception("cio profile delete dispatch failed for person_id=%s", person_id)


@receiver(user_logged_in)
def sync_profile_login_analytics(sender, request, user, **kwargs):
    """Mirror last login date and last seen platform on every successful login."""
    sync_last_login_date(user)
    if request:
        platform = resolve_request_platform(request)
        if platform:
            update_last_seen_platform(user, platform)


@receiver(pre_save, sender=UserEmailPreference)
def snapshot_marketing_opt_in(sender, instance, **kwargs):
    """Remember the stored `marketing` value so post_save can spot an off→on flip."""
    instance._marketing_was = None
    if not instance.pk:
        return
    try:
        instance._marketing_was = (
            UserEmailPreference.objects.filter(pk=instance.pk)
            .values_list("marketing", flat=True)
            .first()
        )
    except Exception:  # pragma: no cover - defensive, never block a save
        instance._marketing_was = None


@receiver(post_save, sender=UserEmailPreference)
def resync_cio_on_pref_change(sender, instance, created, **kwargs):
    """Propagate opt-in/frequency changes to Customer.io as profile traits."""
    user_id = getattr(instance, "user_id", None)
    if not user_id:
        return

    # Opting back into marketing must clear the CIO-side `unsubscribed` flag as
    # well. Profile traits never carry it (a blanket write would resurrect
    # bounce-suppressed addresses on every sync), so without this explicit flip
    # anyone who ever hit "unsubscribe" stayed unreachable forever — re-ticking
    # the box in Settings looked like it worked but changed nothing in CIO.
    if getattr(instance, "_marketing_was", None) is False and instance.marketing:
        try:
            from notifications.tasks import safe_enqueue_resubscribe_customer_in_cio

            transaction.on_commit(lambda: safe_enqueue_resubscribe_customer_in_cio(str(user_id)))
        except Exception:
            logger.warning(
                "safe_enqueue_resubscribe_customer_in_cio failed for user_id=%s",
                user_id,
                exc_info=True,
            )

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

from __future__ import annotations

import logging

from celery import shared_task
from django.conf import settings
from django.contrib.auth import get_user_model

from django.utils import timezone

from notifications.enums import CioTemplate
from notifications.service import NotificationService

logger = logging.getLogger(__name__)


@shared_task(
    bind=True,
    autoretry_for=(Exception,),
    retry_backoff=60,
    retry_kwargs={"max_retries": 3},
)
def send_password_reset_email_task(
    self, user_pk: int, reset_link: str, idempotency_key: str | None = None
) -> str:
    User = get_user_model()
    try:
        user = User.objects.get(pk=user_pk)
    except User.DoesNotExist:
        return "skipped_no_user"
    svc = NotificationService()
    svc.sync_user_profile(user)
    return svc.send_password_reset(user, reset_link, idempotency_key=idempotency_key)


@shared_task(
    bind=True,
    autoretry_for=(Exception,),
    retry_backoff=60,
    retry_kwargs={"max_retries": 3},
)
def send_welcome_email_task(self, user_id: int, idempotency_key: str | None = None) -> str:
    User = get_user_model()
    try:
        user = User.objects.get(id=user_id)
    except User.DoesNotExist:
        return "skipped (user not found)"
    svc = NotificationService()
    svc.sync_user_profile(user)
    return svc.send_welcome(user, idempotency_key=idempotency_key)


@shared_task(
    bind=True,
    autoretry_for=(Exception,),
    retry_backoff=60,
    retry_kwargs={"max_retries": 3},
)
def sync_user_to_customer_io(self, user_id: int) -> str:
    User = get_user_model()
    try:
        user = User.objects.get(id=user_id)
    except User.DoesNotExist:
        return "skipped"
    from notifications.customer_io import is_test_email

    if is_test_email(user.email):
        return "skipped_test_email"
    ok, err = NotificationService().sync_user_profile(user)
    return "ok" if ok else f"failed:{err}"


@shared_task(
    bind=True,
    autoretry_for=(Exception,),
    retry_backoff=60,
    retry_kwargs={"max_retries": 3},
)
def send_billing_order_confirmed_task(
    self, user_pk: int, message_data: dict, idempotency_key: str | None = None
) -> str:
    User = get_user_model()
    try:
        user = User.objects.get(pk=user_pk)
    except User.DoesNotExist:
        return "skipped_no_user"
    svc = NotificationService()
    svc.sync_user_profile(user)
    return svc.send_order_confirmed(
        user, message_data=message_data, idempotency_key=idempotency_key
    )


@shared_task(
    bind=True,
    autoretry_for=(Exception,),
    retry_backoff=60,
    retry_kwargs={"max_retries": 3},
)
def send_billing_payment_receipt_task(
    self, user_pk: int, message_data: dict, idempotency_key: str | None = None
) -> str:
    User = get_user_model()
    try:
        user = User.objects.get(pk=user_pk)
    except User.DoesNotExist:
        return "skipped_no_user"
    svc = NotificationService()
    svc.sync_user_profile(user)
    return svc.send_payment_receipt(
        user, message_data=message_data, idempotency_key=idempotency_key
    )


@shared_task(
    bind=True,
    autoretry_for=(Exception,),
    retry_backoff=60,
    retry_kwargs={"max_retries": 3},
)
def send_billing_payment_failed_task(
    self, user_pk: int, message_data: dict, idempotency_key: str | None = None
) -> str:
    User = get_user_model()
    try:
        user = User.objects.get(pk=user_pk)
    except User.DoesNotExist:
        return "skipped_no_user"
    svc = NotificationService()
    svc.sync_user_profile(user)
    return svc.send_payment_failed(user, message_data=message_data, idempotency_key=idempotency_key)


@shared_task(
    bind=True,
    autoretry_for=(Exception,),
    retry_backoff=60,
    retry_kwargs={"max_retries": 3},
)
def send_password_changed_email_task(
    self, user_pk: int, *, idempotency_key: str | None = None
) -> str:
    User = get_user_model()
    try:
        user = User.objects.get(pk=user_pk)
    except User.DoesNotExist:
        return "skipped_no_user"
    display_name = user.first_name or user.username or "there"
    ctx = {"display_name": display_name, "year": timezone.now().year}
    svc = NotificationService()
    svc.sync_user_profile(user)
    return svc.send_template_for_user(
        user,
        CioTemplate.PASSWORD_CHANGED,
        subject="Your Garzoni password was changed",
        django_template="emails/password_changed.html",
        context=ctx,
        idempotency_key=idempotency_key,
        purpose="password_changed",
    )


def safe_enqueue_sync_user_to_customer_io(user_id: int) -> None:
    """
    Queue Customer.io profile sync without failing the HTTP request if Celery/Redis is down.
    Falls back to synchronous sync so traits (e.g. expo_push_token) still reach Customer.io.
    """
    try:
        sync_user_to_customer_io.delay(user_id)
        return
    except Exception:
        logger.warning(
            "sync_user_to_customer_io.delay failed for user_id=%s — "
            "broker may be unavailable (Redis, Celery). Running inline sync.",
            user_id,
            exc_info=True,
        )
    try:
        User = get_user_model()
        user = User.objects.get(id=user_id)
    except User.DoesNotExist:
        return
    try:
        ok, err = NotificationService().sync_user_profile(user)
        if not ok:
            logger.warning(
                "inline Customer.io sync failed user_id=%s: %s",
                user_id,
                err,
            )
    except Exception:
        logger.warning(
            "inline Customer.io sync raised for user_id=%s",
            user_id,
            exc_info=True,
        )


# ---------------------------------------------------------------------------
# AI-generated push nudges
# ---------------------------------------------------------------------------


@shared_task(bind=True, max_retries=1)
def send_ai_nudge_task(self, user_pk: int) -> str:
    """
    Generate a personalised AI nudge and route it via the channel resolver:
    push when the user has a mobile token, email otherwise.
    """
    User = get_user_model()
    try:
        user = User.objects.select_related("profile").get(pk=user_pk)
    except User.DoesNotExist:
        return "skipped_no_user"

    # Hard opt-out check BEFORE any AI generation. Cheap, avoids LLM cost on
    # users who unsubscribed via CIO (mirrored back to prefs.marketing).
    try:
        from authentication.models import UserEmailPreference

        prefs = UserEmailPreference.objects.filter(user=user).first()
        if prefs and not prefs.marketing:
            return "skipped_marketing_off"
    except Exception:
        pass

    try:
        from education.services.ai_tutor import generate_push_nudge

        nudge_text = generate_push_nudge(user=user)
        if not nudge_text:
            return "skipped_no_nudge"

        svc = NotificationService()
        svc.sync_user_profile(user)
        result = svc.send_marketing_nudge(
            user,
            push_template=CioTemplate.AI_NUDGE,
            email_template=CioTemplate.REMINDER_MONTHLY,
            push_data={"message": nudge_text, "user_id": user_pk},
            email_data={
                "message": nudge_text,
                "user_id": user_pk,
                "customer_name": user.first_name or user.username or "there",
            },
            smtp_subject="A quick nudge from Garzoni",
            smtp_template="emails/reminder_monthly.html",
            smtp_context={"nudge_text": nudge_text},
            purpose="ai_nudge",
        )
        logger.info("ai_nudge_dispatched user=%s outcome=%s", user_pk, result)
        return result
    except Exception as exc:
        logger.error("ai_nudge_task_error user=%s", user_pk, exc_info=True)
        raise self.retry(exc=exc)


@shared_task
def send_ai_nudges_batch() -> dict:
    """
    DISABLED 2026-05-30. This task previously blasted every active user with an
    "AI nudge" daily at 09:00; the email fallback re-used CioTemplate.REMINDER_MONTHLY
    (subject "A quick check-in from garzoni"), which generated daily-email complaints
    and reached unsubscribed users because the SMTP fallback did not consult CIO's
    unsubscribe state. The Celery beat entry is also removed in settings/celery.py.

    Kept as a no-op so DB-scheduled (django_celery_beat) entries that still reference
    this task name do not crash. To re-enable, gate per user on:
      - prefs.marketing == True
      - last_ai_nudge_sent older than N days (recommend 7)
      - resolve_channels(...) prefers push, never email
    """
    if not getattr(settings, "AI_NUDGES_BATCH_ENABLED", False):
        logger.info("ai_nudges_batch_disabled")
        return {"sent": 0, "skipped": 0, "disabled": True}

    User = get_user_model()
    from django.utils import timezone
    from django.core.cache import cache

    today = timezone.now().date().isoformat()
    sent = 0
    skipped = 0

    users = User.objects.filter(is_active=True).select_related("profile")[:500]

    for user in users:
        cache_key = f"ai_nudge_sent:{user.id}:{today}"
        if cache.get(cache_key):
            skipped += 1
            continue
        try:
            send_ai_nudge_task.delay(user.pk)
            cache.set(cache_key, 1, timeout=90_000)
            sent += 1
        except Exception:
            skipped += 1

    logger.info("ai_nudges_batch_queued sent=%s skipped=%s", sent, skipped)
    return {"sent": sent, "skipped": skipped}

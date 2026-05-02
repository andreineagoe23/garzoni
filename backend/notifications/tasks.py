from __future__ import annotations

import logging

from celery import shared_task
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
    Matches the pattern used for welcome email in authentication.signals.
    """
    try:
        sync_user_to_customer_io.delay(user_id)
    except Exception:
        logger.warning(
            "sync_user_to_customer_io.delay failed for user_id=%s — "
            "broker may be unavailable (Redis, Celery).",
            user_id,
            exc_info=True,
        )


# ---------------------------------------------------------------------------
# AI-generated push nudges
# ---------------------------------------------------------------------------


@shared_task(bind=True, max_retries=1)
def send_ai_nudge_task(self, user_pk: int) -> str:
    """
    Generate a personalised AI nudge for a single user and send it via Customer.io push.
    Intended to be called from a daily beat schedule or queued per-user.
    """
    User = get_user_model()
    try:
        user = User.objects.select_related("profile").get(pk=user_pk)
    except User.DoesNotExist:
        return "skipped_no_user"

    # Only send to users who have a push token
    push_token = getattr(getattr(user, "profile", None), "expo_push_token", None)
    if not push_token:
        return "skipped_no_token"

    try:
        from education.services.ai_tutor import generate_push_nudge

        nudge_text = generate_push_nudge(user=user)
        if not nudge_text:
            return "skipped_no_nudge"

        from notifications.transactional import TransactionalMessages
        from notifications.enums import CioTemplate

        transactional = TransactionalMessages()
        ok, err = transactional.send_push(
            CioTemplate.AI_NUDGE,
            user,
            {"message": nudge_text, "user_id": user_pk},
        )
        if ok:
            logger.info("ai_nudge_sent user=%s", user_pk)
            return "sent"
        logger.warning("ai_nudge_cio_failed user=%s err=%s", user_pk, err)
        return f"cio_failed:{err}"
    except Exception as exc:
        logger.error("ai_nudge_task_error user=%s", user_pk, exc_info=True)
        raise self.retry(exc=exc)


@shared_task
def send_ai_nudges_batch() -> dict:
    """
    Dispatch AI nudges to all active users with push tokens.
    Intended to be run daily from Celery Beat.
    """
    User = get_user_model()
    from django.utils import timezone
    from django.core.cache import cache

    today = timezone.now().date().isoformat()
    sent = 0
    skipped = 0

    users = User.objects.filter(
        profile__expo_push_token__isnull=False,
        is_active=True,
    ).select_related("profile")[:500]

    for user in users:
        # Rate-limit: max one nudge per user per day
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

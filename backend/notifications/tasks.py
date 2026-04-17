from __future__ import annotations

import logging

from celery import shared_task
from django.contrib.auth import get_user_model

from notifications.service import NotificationService

logger = logging.getLogger(__name__)


@shared_task(
    bind=True, autoretry_for=(Exception,), retry_backoff=60, retry_kwargs={"max_retries": 3}
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
    bind=True, autoretry_for=(Exception,), retry_backoff=60, retry_kwargs={"max_retries": 3}
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
    bind=True, autoretry_for=(Exception,), retry_backoff=60, retry_kwargs={"max_retries": 3}
)
def sync_user_to_customer_io(self, user_id: int) -> str:
    User = get_user_model()
    try:
        user = User.objects.get(id=user_id)
    except User.DoesNotExist:
        return "skipped"
    ok, err = NotificationService().sync_user_profile(user)
    return "ok" if ok else f"failed:{err}"


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

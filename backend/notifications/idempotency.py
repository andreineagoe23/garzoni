from __future__ import annotations

from django.db import IntegrityError, transaction

from notifications.models import NotificationIdempotency


def idempotency_already_sent(key: str | None) -> bool:
    """True if this notification key was already recorded after a successful send."""
    if not key:
        return False
    return NotificationIdempotency.objects.filter(key=key[:255]).exists()


def record_idempotency_success(key: str | None, purpose: str, metadata: dict | None = None) -> None:
    """
    Persist idempotency **after** a successful send so transient failures can retry
    without permanent skip (claim-before-send caused duplicate skips on Celery retry).
    """
    if not key:
        return
    try:
        with transaction.atomic():
            NotificationIdempotency.objects.create(
                key=key[:255],
                purpose=purpose[:64],
                metadata=metadata or {},
            )
    except IntegrityError:
        # Concurrent completion or duplicate scheduler — safe to ignore.
        pass


def claim_idempotency_key(key: str, purpose: str, metadata: dict | None = None) -> bool:
    """
    Returns True if this worker owns the first send for `key`.
    Returns False if key already claimed (duplicate / retry safe skip).
    """
    try:
        with transaction.atomic():
            NotificationIdempotency.objects.create(
                key=key[:255],
                purpose=purpose[:64],
                metadata=metadata or {},
            )
        return True
    except IntegrityError:
        return False

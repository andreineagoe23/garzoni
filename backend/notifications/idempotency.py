from __future__ import annotations

from django.db import IntegrityError, transaction

from notifications.models import NotificationIdempotency


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

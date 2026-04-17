"""Atomic streak-freeze consumption (inventory + expiry)."""

from __future__ import annotations

from django.db import transaction
from django.utils import timezone


def consume_one_streak_freeze(user) -> bool:
    """
    Decrement one streak_freeze if available and not expired.
    Caller must bridge calendar gaps on the profile after success.
    """
    from gamification.models import StreakItem

    with transaction.atomic():
        rows = list(
            StreakItem.objects.select_for_update()
            .filter(user=user, item_type="streak_freeze", quantity__gt=0)
            .order_by("id")
        )
        now = timezone.now()
        for row in rows:
            if row.expires_at and row.expires_at < now:
                continue
            row.quantity -= 1
            row.save(update_fields=["quantity"])
            return True
    return False

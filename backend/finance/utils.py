"""Utility helpers for finance-related instrumentation and metrics."""

from __future__ import annotations

import logging
from typing import Any, Dict, Optional

from django.contrib.auth.models import AbstractBaseUser

from django.apps import apps

logger = logging.getLogger(__name__)


def record_funnel_event(
    event_type: str,
    *,
    status: str = "success",
    user: Optional[AbstractBaseUser] = None,
    session_id: str = "",
    metadata: Optional[Dict[str, Any]] = None,
) -> None:
    """Persist a funnel event without breaking the caller on failure."""

    FunnelEvent = apps.get_model("finance", "FunnelEvent")
    if FunnelEvent is None:
        logger.warning("FunnelEvent model not available; skipping event %s", event_type)
        return

    try:
        FunnelEvent.objects.create(
            user=user if user and getattr(user, "is_authenticated", False) else None,
            event_type=event_type,
            status=status,
            session_id=session_id or "",
            metadata=metadata or {},
        )
    except Exception as exc:  # pragma: no cover - defensive logging only
        logger.warning("Unable to record funnel event %s: %s", event_type, exc)

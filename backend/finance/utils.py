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
    platform: str = "",
) -> None:
    """Persist a funnel event without breaking the caller on failure.

    ``platform`` ("web"/"ios"/"android") tags the originating client so the
    analytics dashboard can split the funnel — pass
    ``resolve_request_platform(request)`` from request-bound callers. Genuine
    server-side callers (e.g. Stripe webhooks, Celery tasks) pass
    ``platform="server"``. Empty string is treated as "server" in the dashboard.
    """

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
            platform=(platform or "")[:16],
        )
    except Exception as exc:  # pragma: no cover - defensive logging only
        logger.warning("Unable to record funnel event %s: %s", event_type, exc)

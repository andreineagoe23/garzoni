from __future__ import annotations

import logging
from typing import Any

from django.contrib.auth.models import User

from notifications.customer_io import track_event
from notifications.enums import CioEventName
from notifications.identity import customer_io_person_id

logger = logging.getLogger(__name__)


class NotificationEvents:
    """Publish domain events to Customer.io for journeys and analytics."""

    def track(
        self,
        user: User,
        event_name: str | CioEventName,
        properties: dict[str, Any] | None = None,
        *,
        identify_first: bool = False,
    ) -> tuple[bool, str | None]:
        name = event_name.value if isinstance(event_name, CioEventName) else event_name
        pid = customer_io_person_id(user)
        # Track API auto-creates a bare `id`-only profile when the person does not
        # exist yet, leaving `email`/`preferences_url` unset so email templates fail
        # to render ("undefined variable: customer.email"). For journey events that
        # can trigger an email, upsert the full profile first (best-effort — never
        # let an identify failure swallow the event).
        if identify_first:
            try:
                from notifications.profile_sync import NotificationProfileSync

                NotificationProfileSync().sync_user(user)
            except Exception as exc:  # pragma: no cover - defensive
                logger.warning("identify-before-track failed user=%s event=%s: %s", pid, name, exc)
        ok, err = track_event(pid, name, properties or {})
        if not ok:
            logger.warning("Customer.io track failed user=%s event=%s: %s", pid, name, err)
        return ok, err

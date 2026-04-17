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
        self, user: User, event_name: str | CioEventName, properties: dict[str, Any] | None = None
    ) -> tuple[bool, str | None]:
        name = event_name.value if isinstance(event_name, CioEventName) else event_name
        pid = customer_io_person_id(user)
        ok, err = track_event(pid, name, properties or {})
        if not ok:
            logger.warning("Customer.io track failed user=%s event=%s: %s", pid, name, err)
        return ok, err

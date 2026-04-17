"""
Notification layer contracts (reference for tests and future DI).
Concrete implementations live in profile_sync.py, events.py, transactional.py, and service.py.
"""

from __future__ import annotations

from typing import Any, Protocol

from django.contrib.auth.models import User


class NotificationProfileSyncProtocol(Protocol):
    def sync_user(self, user: User) -> tuple[bool, str | None]: ...

    def delete_user(self, user: User) -> tuple[bool, str | None]: ...

    def sync_device(
        self, user: User, token: str | None, platform: str | None = None
    ) -> tuple[bool, str | None]: ...


class NotificationEventsProtocol(Protocol):
    def track(
        self, user: User, event_name: str, properties: dict[str, Any] | None = None
    ) -> tuple[bool, str | None]: ...


class TransactionalMessagesProtocol(Protocol):
    def send(
        self,
        template: Any,
        user: User,
        data: dict[str, Any],
        *,
        to_email: str | None = None,
    ) -> tuple[bool, str | None]: ...

    def send_push(
        self, template: Any, user: User, data: dict[str, Any]
    ) -> tuple[bool, str | None]: ...

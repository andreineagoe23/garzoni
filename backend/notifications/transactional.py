from __future__ import annotations

import logging
from typing import Any

from django.contrib.auth.models import User

from authentication.models import UserProfile
from notifications.customer_io import (
    customer_io_transactional_configured,
    resolve_transactional_ref,
    send_transactional_email,
    send_transactional_push,
)
from notifications.enums import CioTemplate
from notifications.expo_push import send_expo_push
from notifications.identity import customer_io_person_id

logger = logging.getLogger(__name__)


def _get_expo_token(user: User) -> str:
    profile = UserProfile.objects.filter(user=user).only("expo_push_token").first()
    return (getattr(profile, "expo_push_token", "") or "").strip()


def cio_email_identifiers(person_id: str, email: str) -> dict[str, str]:
    """
    Customer.io transactional email expects ``to`` plus identifiers; including ``email``
    keeps Liquid ``customer.email`` populated even when templates reference it.
    """
    ids: dict[str, str] = {"id": person_id}
    e = (email or "").strip()
    if e:
        ids["email"] = e
    return ids


class TransactionalMessages:
    """Programmatic transactional email/push via Customer.io App API."""

    def send(
        self,
        template: CioTemplate,
        user: User,
        data: dict[str, Any],
        *,
        to_email: str | None = None,
    ) -> tuple[bool, str | None]:
        ref = resolve_transactional_ref(template.value)
        if ref is None:
            return False, f"no transactional mapping for template={template.value}"
        email = (to_email or user.email or "").strip()
        if not email:
            return False, "missing recipient email"
        pid = customer_io_person_id(user)
        if not customer_io_transactional_configured():
            return False, "transactional API not configured"
        ok, err = send_transactional_email(
            to_email=email,
            transactional_message_ref=ref,
            message_data=data,
            identifiers=cio_email_identifiers(pid, email),
        )
        if not ok:
            logger.warning(
                "CIO transactional email failed template=%s user=%s: %s", template.value, pid, err
            )
        return ok, err

    def send_push(
        self, template: CioTemplate, user: User, data: dict[str, Any]
    ) -> tuple[bool, str | None]:
        # Prefer Expo direct push when the user has a registered token — CIO App API
        # returns 200 even when no native device is in the Journeys device table,
        # causing silent non-delivery. Expo guarantees delivery or returns an error.
        expo_token = _get_expo_token(user)
        if expo_token:
            title = str(data.get("title") or "Garzoni")
            body = str(
                data.get("message") or data.get("body") or "Your next 5-minute lesson is ready."
            )
            deeplink = data.get("deeplink", "garzoni:///(tabs)/learn")
            extra = {k: v for k, v in data.items() if k not in ("title", "message", "body")}
            push_data = {"deeplink": deeplink, **extra}
            ok, err = send_expo_push(expo_token, title, body, push_data, user_id=user.pk)
            if ok:
                return True, None
            logger.warning(
                "Expo push failed template=%s user=%s err=%s — falling back to CIO",
                template.value,
                user.pk,
                err,
            )

        ref = resolve_transactional_ref(template.value)
        if ref is None:
            return False, f"no transactional mapping for template={template.value}"
        pid = customer_io_person_id(user)
        if not customer_io_transactional_configured():
            return False, "transactional API not configured"
        ok, err = send_transactional_push(
            identifiers={"id": pid},
            transactional_message_ref=ref,
            message_data=data,
        )
        if not ok:
            logger.warning(
                "CIO transactional push failed template=%s user=%s: %s", template.value, pid, err
            )
        return ok, err

    def send_with_identifiers(
        self,
        template: CioTemplate,
        *,
        to_email: str,
        identifiers: dict[str, str],
        data: dict[str, Any],
    ) -> tuple[bool, str | None]:
        ref = resolve_transactional_ref(template.value)
        if ref is None:
            return False, f"no transactional mapping for template={template.value}"
        email = to_email.strip()
        if not email:
            return False, "missing recipient email"
        if not customer_io_transactional_configured():
            return False, "transactional API not configured"
        merged = dict(identifiers)
        em = email.strip()
        if em and "email" not in merged:
            merged["email"] = em
        ok, err = send_transactional_email(
            to_email=email,
            transactional_message_ref=ref,
            message_data=data,
            identifiers=merged,
        )
        if not ok:
            logger.warning(
                "CIO transactional email failed template=%s identifiers=%s: %s",
                template.value,
                list(identifiers.keys()),
                err,
            )
        return ok, err

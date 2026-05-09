from __future__ import annotations

import logging
from typing import Any

from django.contrib.auth.models import User

from notifications.customer_io import (
    customer_io_transactional_configured,
    resolve_transactional_ref,
    send_transactional_email,
    send_transactional_push,
)
from notifications.enums import CioTemplate
from notifications.identity import customer_io_person_id

logger = logging.getLogger(__name__)


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

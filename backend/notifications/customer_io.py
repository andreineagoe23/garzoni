from __future__ import annotations

import base64
import json
import logging
from typing import Any

import requests
from django.conf import settings

logger = logging.getLogger(__name__)


def _track_api_base() -> str:
    if getattr(settings, "CIO_REGION", "us").lower() == "eu":
        return "https://track-eu.customer.io"
    return "https://track.customer.io"


def _app_api_base() -> str:
    if getattr(settings, "CIO_REGION", "us").lower() == "eu":
        return "https://api-eu.customer.io"
    return "https://api.customer.io"


def _track_auth_header() -> str | None:
    site_id = (getattr(settings, "CIO_SITE_ID", "") or "").strip()
    api_key = (getattr(settings, "CIO_TRACK_API_KEY", "") or "").strip()
    if not site_id or not api_key:
        return None
    token = base64.b64encode(f"{site_id}:{api_key}".encode()).decode()
    return f"Basic {token}"


def _app_bearer() -> str | None:
    key = (getattr(settings, "CIO_APP_API_KEY", "") or "").strip()
    if not key:
        return None
    return f"Bearer {key}"


def _timeout() -> float:
    return float(getattr(settings, "EXTERNAL_REQUEST_TIMEOUT_SECONDS", 15))


def customer_io_track_configured() -> bool:
    return bool(
        (getattr(settings, "CIO_SITE_ID", "") or "").strip()
        and (getattr(settings, "CIO_TRACK_API_KEY", "") or "").strip()
    )


def customer_io_transactional_configured() -> bool:
    return bool((getattr(settings, "CIO_APP_API_KEY", "") or "").strip())


def identify_person(person_id: str, traits: dict[str, Any]) -> tuple[bool, str | None]:
    """
    PUT /api/v1/customers/{id} — Track API.
    person_id is the stable Garzoni identifier (stringified Django user pk).
    """
    if not getattr(settings, "CIO_TRACK_ENABLED", False):
        return True, "skipped (CIO_TRACK_ENABLED=false)"
    auth = _track_auth_header()
    if not auth:
        return False, "missing CIO_SITE_ID or CIO_TRACK_API_KEY"
    url = f"{_track_api_base()}/api/v1/customers/{person_id}"
    try:
        r = requests.put(
            url,
            json=traits,
            headers={"Authorization": auth, "Content-Type": "application/json"},
            timeout=_timeout(),
        )
        if r.status_code >= 400:
            return False, f"HTTP {r.status_code}: {r.text[:500]}"
        return True, None
    except requests.RequestException as e:
        return False, str(e)


def track_event(person_id: str, name: str, data: dict[str, Any] | None = None) -> tuple[bool, str | None]:
    """POST /api/v1/customers/{id}/events"""
    if not getattr(settings, "CIO_TRACK_ENABLED", False):
        return True, "skipped (CIO_TRACK_ENABLED=false)"
    auth = _track_auth_header()
    if not auth:
        return False, "missing CIO_SITE_ID or CIO_TRACK_API_KEY"
    url = f"{_track_api_base()}/api/v1/customers/{person_id}/events"
    body: dict[str, Any] = {"name": name}
    if data:
        body["data"] = data
    try:
        r = requests.post(
            url,
            json=body,
            headers={"Authorization": auth, "Content-Type": "application/json"},
            timeout=_timeout(),
        )
        if r.status_code >= 400:
            return False, f"HTTP {r.status_code}: {r.text[:500]}"
        return True, None
    except requests.RequestException as e:
        return False, str(e)


def delete_person(person_id: str) -> tuple[bool, str | None]:
    """DELETE customer (GDPR-style cleanup when supported)."""
    if not getattr(settings, "CIO_TRACK_ENABLED", False):
        return True, "skipped"
    auth = _track_auth_header()
    if not auth:
        return False, "missing track credentials"
    url = f"{_track_api_base()}/api/v1/customers/{person_id}"
    try:
        r = requests.delete(url, headers={"Authorization": auth}, timeout=_timeout())
        if r.status_code >= 400 and r.status_code != 404:
            return False, f"HTTP {r.status_code}: {r.text[:500]}"
        return True, None
    except requests.RequestException as e:
        return False, str(e)


def send_transactional_email(
    *,
    to_email: str,
    transactional_message_ref: str | int,
    message_data: dict[str, Any],
    identifiers: dict[str, str],
) -> tuple[bool, str | None]:
    """
    App API: POST /v1/send/email
    transactional_message_ref is numeric template id or trigger name string.
    identifiers must include one of id, email, or cio_id per Customer.io docs.
    """
    if not getattr(settings, "CIO_TRANSACTIONAL_ENABLED", False):
        return True, "skipped (CIO_TRANSACTIONAL_ENABLED=false)"
    bearer = _app_bearer()
    if not bearer:
        return False, "missing CIO_APP_API_KEY"
    url = f"{_app_api_base()}/v1/send/email"
    clean_data = {k: v for k, v in (message_data or {}).items() if v is not None}
    payload: dict[str, Any] = {
        "to": to_email,
        "identifiers": identifiers,
        "transactional_message_id": transactional_message_ref,
        "message_data": clean_data,
    }
    try:
        r = requests.post(
            url,
            json=payload,
            headers={"Authorization": bearer, "Content-Type": "application/json"},
            timeout=_timeout(),
        )
        if r.status_code >= 400:
            return False, f"HTTP {r.status_code}: {r.text[:500]}"
        return True, None
    except requests.RequestException as e:
        return False, str(e)


def send_transactional_push(
    *,
    identifiers: dict[str, str],
    transactional_message_ref: str | int,
    message_data: dict[str, Any],
) -> tuple[bool, str | None]:
    """POST /v1/send/push — targets last_used device when template is push."""
    if not getattr(settings, "CIO_TRANSACTIONAL_ENABLED", False):
        return True, "skipped (CIO_TRANSACTIONAL_ENABLED=false)"
    bearer = _app_bearer()
    if not bearer:
        return False, "missing CIO_APP_API_KEY"
    url = f"{_app_api_base()}/v1/send/push"
    clean_data = {k: v for k, v in (message_data or {}).items() if v is not None}
    payload: dict[str, Any] = {
        "to": "last_used",
        "identifiers": identifiers,
        "transactional_message_id": transactional_message_ref,
        "message_data": clean_data,
    }
    try:
        r = requests.post(
            url,
            json=payload,
            headers={"Authorization": bearer, "Content-Type": "application/json"},
            timeout=_timeout(),
        )
        if r.status_code >= 400:
            return False, f"HTTP {r.status_code}: {r.text[:500]}"
        return True, None
    except requests.RequestException as e:
        return False, str(e)


def load_transactional_map() -> dict[str, str | int]:
    raw = (getattr(settings, "CIO_TRANSACTIONAL_TRIGGERS_JSON", "") or "").strip()
    if not raw:
        return {}
    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        logger.warning("CIO_TRANSACTIONAL_TRIGGERS_JSON is not valid JSON")
        return {}
    out: dict[str, str | int] = {}
    for k, v in data.items():
        if isinstance(v, bool):
            continue
        if isinstance(v, int):
            out[str(k)] = v
        elif isinstance(v, str):
            # numeric string -> int for legacy IDs
            if v.isdigit():
                out[str(k)] = int(v)
            else:
                out[str(k)] = v
    return out


def resolve_transactional_ref(template_slug: str) -> str | int | None:
    m = load_transactional_map()
    return m.get(template_slug)

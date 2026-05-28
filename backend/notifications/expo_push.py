from __future__ import annotations

import logging
from typing import Any

import requests

logger = logging.getLogger(__name__)

_EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send"
_TIMEOUT = 10


def _first_ticket(response_data: Any) -> dict[str, Any] | None:
    data = response_data.get("data") if isinstance(response_data, dict) else None
    if isinstance(data, dict):
        return data
    if isinstance(data, list) and data and isinstance(data[0], dict):
        return data[0]
    return None


def send_expo_push(
    token: str,
    title: str,
    body: str,
    data: dict[str, Any] | None = None,
) -> tuple[bool, str | None]:
    """POST to Expo push API. Returns (ok, error_message).

    Expo responses: {"data": [{"status": "ok"} or {"status": "error", "message": "..."}]}
    """
    t = (token or "").strip()
    if not t:
        return False, "missing_token"

    payload: dict[str, Any] = {"to": t, "title": title, "body": body}
    if data:
        payload["data"] = data

    try:
        r = requests.post(
            _EXPO_PUSH_URL,
            json=payload,
            headers={
                "Accept": "application/json",
                "Accept-Encoding": "gzip, deflate",
                "Content-Type": "application/json",
            },
            timeout=_TIMEOUT,
        )
        if r.status_code >= 400:
            return False, f"HTTP {r.status_code}: {r.text[:200]}"

        item = _first_ticket(r.json())
        if item and item.get("status") == "error":
            detail = item.get("message") or item.get("details", {}).get("error", "expo_error")
            logger.warning("Expo push error token=%s detail=%s", t[:30], detail)
            return False, str(detail)

        return True, None
    except requests.RequestException as e:
        logger.warning("Expo push request failed: %s", e)
        return False, str(e)

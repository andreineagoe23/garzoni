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


def _clear_stale_expo_token(token: str, user_id: int | None = None) -> None:
    try:
        from authentication.models import UserProfile

        qs = UserProfile.objects.filter(expo_push_token=token)
        if user_id is not None:
            qs = qs.filter(user_id=user_id)
        qs.update(expo_push_token=None)
    except Exception:
        logger.warning("Failed to clear stale expo token", exc_info=True)


def send_expo_push(
    token: str,
    title: str,
    body: str,
    data: dict[str, Any] | None = None,
    *,
    user_id: int | None = None,
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
            detail_str = str(detail)
            if "DeviceNotRegistered" in detail_str:
                _clear_stale_expo_token(t, user_id=user_id)
            logger.warning("Expo push error token=%s detail=%s", t[:30], detail)
            return False, detail_str

        return True, None
    except requests.RequestException as e:
        logger.warning("Expo push request failed: %s", e)
        return False, str(e)

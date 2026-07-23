from __future__ import annotations

import logging
from typing import Any

import requests

logger = logging.getLogger(__name__)

_EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send"
_EXPO_RECEIPTS_URL = "https://exp.host/--/api/v2/push/getReceipts"
_TIMEOUT = 10


def _first_ticket(response_data: Any) -> dict[str, Any] | None:
    data = response_data.get("data") if isinstance(response_data, dict) else None
    if isinstance(data, dict):
        return data
    if isinstance(data, list) and data and isinstance(data[0], dict):
        return data[0]
    return None


def _clear_stale_expo_token(token: str, user_id: int | None = None) -> None:
    """Drop a token Expo reported as DeviceNotRegistered, and mirror the change
    to Customer.io. Without the resync the CIO profile keeps the dead token and
    a `has_mobile_app=true` gate, so every journey keeps choosing the push branch
    for a device that can no longer receive anything."""
    try:
        from authentication.models import UserProfile

        qs = UserProfile.objects.filter(expo_push_token=token)
        if user_id is not None:
            qs = qs.filter(user_id=user_id)
        affected = list(qs.values_list("user_id", flat=True))
        qs.update(expo_push_token=None)
    except Exception:
        logger.warning("Failed to clear stale expo token", exc_info=True)
        return
    for uid in affected:
        try:
            from notifications.tasks import safe_enqueue_sync_user_to_customer_io

            safe_enqueue_sync_user_to_customer_io(uid)
        except Exception:
            logger.warning("Failed to resync CIO after clearing token", exc_info=True)


def _record_ticket(ticket_id: str, token: str, user_id: int | None, purpose: str) -> None:
    """Persist an accepted ticket so the receipt sweep can ask Expo how it went."""
    tid = (ticket_id or "").strip()
    if not tid:
        return
    try:
        from notifications.models import PushTicket

        PushTicket.objects.get_or_create(
            ticket_id=tid,
            defaults={
                "user_id": user_id,
                "token": token[:200],
                "purpose": purpose[:64],
            },
        )
    except Exception:
        logger.warning("Failed to record push ticket", exc_info=True)


def send_expo_push(
    token: str,
    title: str,
    body: str,
    data: dict[str, Any] | None = None,
    *,
    user_id: int | None = None,
    purpose: str = "",
    channel_id: str = "default",
) -> tuple[bool, str | None]:
    """POST to Expo push API. Returns (ok, error_message).

    Expo responses: {"data": [{"status": "ok"} or {"status": "error", "message": "..."}]}

    A returned ticket means *queued*, not *delivered* — the ticket id is stored so
    `poll_expo_push_receipts` can fetch the real APNs/FCM verdict later.
    """
    t = (token or "").strip()
    if not t:
        return False, "missing_token"

    # `channelId` must match the channel the app creates on Android 8+
    # (pushNotificationsMobile.ensureAndroidNotificationChannel) or the OS files
    # the notification into a silent default channel. `priority: high` keeps it
    # out of FCM's deferred bucket for dozing devices.
    payload: dict[str, Any] = {
        "to": t,
        "title": title,
        "body": body,
        "sound": "default",
        "channelId": channel_id or "default",
        "priority": "high",
    }
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

        if item:
            _record_ticket(str(item.get("id") or ""), t, user_id, purpose)
        return True, None
    except (requests.RequestException, ValueError) as e:
        logger.warning("Expo push request failed: %s", e)
        return False, str(e)


# Receipt errors that mean the *sender* is broken, not the device. These are the
# ones that fail silently at scale: Expo accepts the message, Apple/Google reject
# it at the gateway, and nothing upstream ever notices.
FATAL_RECEIPT_ERRORS = frozenset(
    {
        "InvalidCredentials",
        "MismatchSenderId",
        "MessageTooBig",
    }
)


def fetch_expo_receipts(ticket_ids: list[str]) -> tuple[dict[str, Any], str | None]:
    """POST to Expo's getReceipts. Returns ({ticket_id: receipt}, error)."""
    ids = [i for i in (ticket_ids or []) if i]
    if not ids:
        return {}, None
    try:
        r = requests.post(
            _EXPO_RECEIPTS_URL,
            json={"ids": ids},
            headers={
                "Accept": "application/json",
                "Accept-Encoding": "gzip, deflate",
                "Content-Type": "application/json",
            },
            timeout=_TIMEOUT,
        )
        if r.status_code >= 400:
            return {}, f"HTTP {r.status_code}: {r.text[:200]}"
        payload = r.json()
        if isinstance(payload, dict) and payload.get("errors"):
            # Expo can answer 200 with a top-level errors array and no data.
            return {}, str(payload["errors"])[:200]
        data = payload.get("data") if isinstance(payload, dict) else None
        return (data if isinstance(data, dict) else {}), None
    # A non-JSON 200 (proxy interstitial, gateway HTML) raises ValueError, which is
    # not a RequestException — uncaught it would fail the whole sweep task.
    except (requests.RequestException, ValueError) as e:
        return {}, str(e)

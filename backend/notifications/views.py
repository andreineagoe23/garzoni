import hashlib
import hmac
import json
import logging
import secrets

from django.conf import settings
from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from notifications.customer_io import (
    customer_io_cdp_configured,
    customer_io_track_configured,
    identify_person,
)
from notifications.enums import CioEventName
from notifications.service import NotificationService

logger = logging.getLogger(__name__)

# Only allow client-emitted events that are safe to trigger from the browser.
_ALLOWED_CLIENT_EVENTS = frozenset({CioEventName.CHECKOUT_ABANDONED.value})


class ClientTrackEventView(APIView):
    """
    POST /api/notifications/client-track/
    Whitelisted domain events for journeys (e.g. checkout abandoned on web).
    """

    permission_classes = [IsAuthenticated]

    def post(self, request):
        name = (request.data.get("name") or "").strip()
        if name not in _ALLOWED_CLIENT_EVENTS:
            return Response(
                {"detail": "Unknown or disallowed event name."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        raw = request.data.get("properties")
        properties = raw if isinstance(raw, dict) else {}
        event = next((e for e in CioEventName if e.value == name), None)
        if event is None:
            return Response(
                {"detail": "Unknown event."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        NotificationService().publish_domain_event(request.user, event, properties)
        return Response({"ok": True}, status=status.HTTP_200_OK)


_CIO_UNSUB_EVENTS = frozenset({"customer_unsubscribed", "email_unsubscribed"})
_CIO_SUB_EVENTS = frozenset({"customer_subscribed", "email_subscribed"})


def _verify_cio_signature(raw_body: bytes, signature_header: str, timestamp_header: str) -> bool:
    """
    Verify an X-CIO-Signature header. CIO Reporting Webhooks ship in two flavours
    depending on workspace age:
      - new format: header = "v0=<hex>"; signed payload = "v0:<timestamp>:<body>"
      - legacy format: header = "<hex>"; signed payload = "<body>"
    Accept either so the same receiver works regardless of which format the
    workspace emits. Reject if the secret is unset or no scheme matches.
    """
    secret = (getattr(settings, "CIO_WEBHOOK_SIGNING_SECRET", "") or "").strip()
    if not secret or not signature_header:
        return False
    secret_b = secret.encode("utf-8")
    if signature_header.startswith("v0=") and timestamp_header:
        sent_sig = signature_header[3:]
        signed = f"v0:{timestamp_header}:".encode("utf-8") + raw_body
        expected = hmac.new(secret_b, signed, hashlib.sha256).hexdigest()
        if hmac.compare_digest(sent_sig, expected):
            return True
    legacy_expected = hmac.new(secret_b, raw_body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(signature_header, legacy_expected)


class CioWebhookView(APIView):
    """
    POST /api/notifications/cio-webhook/
    Receiver for CIO Reporting Webhooks. Currently handles unsubscribe events
    by flipping UserEmailPreference.marketing (+ reminders + weekly_digest) to
    False so backend-side crons stop reaching the user, matching CIO's view.

    Configure in CIO: Workspace Settings → Reporting Webhooks → add this URL,
    subscribe to customer_unsubscribed + email_unsubscribed, copy the signing
    secret into env var CIO_WEBHOOK_SIGNING_SECRET.
    """

    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request):
        raw_body = request.body or b""
        sig = (request.headers.get("X-CIO-Signature") or "").strip()
        ts = (request.headers.get("X-CIO-Timestamp") or "").strip()
        if not _verify_cio_signature(raw_body, sig, ts):
            return Response(status=status.HTTP_401_UNAUTHORIZED)
        try:
            payload = json.loads(raw_body.decode("utf-8") or "{}")
        except Exception:
            return Response({"detail": "bad json"}, status=status.HTTP_400_BAD_REQUEST)
        event_type = (payload.get("event_type") or "").strip()
        data = payload.get("data") or {}
        if event_type not in _CIO_UNSUB_EVENTS and event_type not in _CIO_SUB_EVENTS:
            # Acknowledge unknown events so CIO does not retry; nothing to do.
            return Response({"ok": True, "ignored": event_type}, status=status.HTTP_200_OK)

        user = self._resolve_user(data)
        if user is None:
            logger.warning("cio_webhook_user_unresolved event=%s data=%s", event_type, data)
            return Response({"ok": True, "user": None}, status=status.HTTP_200_OK)

        from authentication.models import UserEmailPreference

        prefs, _ = UserEmailPreference.objects.get_or_create(user=user)
        if event_type in _CIO_UNSUB_EVENTS:
            updates = {"marketing": False, "reminders": False, "weekly_digest": False}
        else:
            updates = {"marketing": True}
        changed = []
        for field, value in updates.items():
            if getattr(prefs, field, None) != value:
                setattr(prefs, field, value)
                changed.append(field)
        if changed:
            prefs.save(update_fields=changed)
        logger.info("cio_webhook_applied event=%s user=%s changed=%s", event_type, user.pk, changed)
        return Response(
            {"ok": True, "user_id": user.pk, "changed": changed}, status=status.HTTP_200_OK
        )

    @staticmethod
    def _resolve_user(data: dict):
        User = get_user_model()
        cid = (data.get("customer_id") or "").strip()
        if cid and cid.isdigit():
            user = User.objects.filter(pk=int(cid)).first()
            if user:
                return user
        email = (data.get("email_address") or "").strip().lower()
        if email:
            return User.objects.filter(email__iexact=email).first()
        return None


class CioPingView(APIView):
    """
    GET /api/notifications/cio-ping/
    Secured by X-Garzoni-Cio-Ping header matching CIO_PUBLIC_PING_SECRET (set on Railway).
    Runs Customer.io identify (CDP + Track when configured) so you can verify without a shell.

    Example:
      curl -sS -H "X-Garzoni-Cio-Ping: YOUR_SECRET" \\
        "https://YOUR-RAILWAY-HOST/api/notifications/cio-ping/"
    """

    permission_classes = [AllowAny]
    authentication_classes = []

    def get(self, request):
        expected = (getattr(settings, "CIO_PUBLIC_PING_SECRET", "") or "").strip()
        if not expected:
            return Response(status=status.HTTP_404_NOT_FOUND)
        provided = (request.headers.get("X-Garzoni-Cio-Ping") or "").strip()
        if len(provided) != len(expected) or not secrets.compare_digest(provided, expected):
            return Response(status=status.HTTP_404_NOT_FOUND)

        pid = "garzoni-http-ping"
        traits = {
            "name": "Garzoni HTTP ping",
            "email": "cio-http-ping@garzoni.app",
            "workspace": "garzoni",
        }
        try:
            # Tighter per-call timeout + parallel CDP/Track keeps total time under Railway's proxy limit.
            ok, err = identify_person(pid, traits, http_timeout=12)
        except Exception:
            logger.exception("cio_http_ping_identify_failed")
            return Response(
                {
                    "identify_ok": False,
                    "detail": "internal error",
                    "skipped": False,
                    "cdp_configured": customer_io_cdp_configured(),
                    "track_configured": customer_io_track_configured(),
                    "cio_track_profile_upsert": getattr(settings, "CIO_TRACK_PROFILE_UPSERT", True),
                    "cio_track_enabled": getattr(settings, "CIO_TRACK_ENABLED", False),
                    "cio_region": getattr(settings, "CIO_REGION", ""),
                },
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )
        skipped = bool(ok and err and "skipped" in str(err))
        really_ok = ok and not skipped and err is None
        http_status = (
            status.HTTP_200_OK
            if really_ok
            else (status.HTTP_503_SERVICE_UNAVAILABLE if skipped else status.HTTP_502_BAD_GATEWAY)
        )
        return Response(
            {
                "identify_ok": really_ok,
                "detail": err,
                "skipped": skipped,
                "cdp_configured": customer_io_cdp_configured(),
                "track_configured": customer_io_track_configured(),
                "cio_track_profile_upsert": getattr(settings, "CIO_TRACK_PROFILE_UPSERT", True),
                "cio_track_enabled": getattr(settings, "CIO_TRACK_ENABLED", False),
                "cio_region": getattr(settings, "CIO_REGION", ""),
            },
            status=http_status,
        )

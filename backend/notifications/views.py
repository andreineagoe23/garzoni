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
# Hard bounce + spam complaint → permanently stop emailing this address. Apple Private
# Relay "unauthorized sender" rejections surface as email_bounced but never reach CIO's
# ESP suppression list (Mailgun marks them block/policy, not hard bounce), so the same
# inboxes get retried forever unless we suppress them ourselves.
_CIO_BOUNCE_EVENTS = frozenset({"email_bounced", "email_spammed"})


def _cio_event_type(payload: dict) -> str:
    """Reporting-webhook event identifier. Newer CIO payloads carry a flat
    ``event_type`` (e.g. "email_bounced"); older/alternate ones split it into
    ``object_type`` ("email") + ``metric`` ("bounced"). Normalise both to
    "<object>_<metric>" so routing is format-agnostic."""
    et = (payload.get("event_type") or "").strip()
    if et:
        return et
    obj = (payload.get("object_type") or "").strip()
    data = payload.get("data") or {}
    metric = (
        payload.get("metric") or (data.get("metric") if isinstance(data, dict) else "") or ""
    ).strip()
    return f"{obj}_{metric}" if obj and metric else ""


def _extract_identity(data: dict) -> tuple[str, str]:
    """Pull (customer_id, email) from a reporting-webhook ``data`` block, tolerating the
    shapes CIO uses across event types: top-level ``customer_id``/``email_address``, a
    ``recipient`` email (email-metric events like bounced/spammed), or a nested
    ``identifiers`` object. Without this, bounce payloads that omit ``email_address``
    would slip through unsuppressed."""
    data = data or {}
    idents = data.get("identifiers")
    if not isinstance(idents, dict):
        idents = {}
    cid = (data.get("customer_id") or idents.get("id") or idents.get("cio_id") or "").strip()
    email = (
        data.get("email_address") or data.get("recipient") or idents.get("email") or ""
    ).strip()
    return cid, email


def _verify_cio_signature(raw_body: bytes, signature_header: str, timestamp_header: str) -> bool:
    """
    Verify an X-CIO-Signature header. CIO Reporting Webhooks ship in several
    flavours depending on workspace age and the docs disagree with the wire
    format in practice; accept any of:
      A. header = "v0=<hex>"; signed = "v0:<timestamp>:<body>"
      B. header = "<hex>";    signed = "v0:<timestamp>:<body>"  (observed)
      C. header = "<hex>";    signed = "<body>"                  (legacy)
    Reject if secret is unset or none match.
    """
    secret = (getattr(settings, "CIO_WEBHOOK_SIGNING_SECRET", "") or "").strip()
    if not secret or not signature_header:
        return False
    secret_b = secret.encode("utf-8")
    sent = signature_header[3:] if signature_header.startswith("v0=") else signature_header
    if timestamp_header:
        signed_v0 = f"v0:{timestamp_header}:".encode("utf-8") + raw_body
        expected_v0 = hmac.new(secret_b, signed_v0, hashlib.sha256).hexdigest()
        if hmac.compare_digest(sent, expected_v0):
            return True
    expected_legacy = hmac.new(secret_b, raw_body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(sent, expected_legacy)


class CioWebhookView(APIView):
    """
    POST /api/notifications/cio-webhook/
    Receiver for CIO Reporting Webhooks. Handles:
      - unsubscribe/subscribe → flip UserEmailPreference (marketing/reminders/
        weekly_digest) so backend-side crons match CIO's view.
      - hard bounce / spam complaint → permanently suppress the address by setting
        unsubscribed=true on the CIO profile (the only durable fix for Apple Private
        Relay bounces, which never auto-suppress) AND clearing local prefs.

    Configure in CIO: Workspace Settings → Reporting Webhooks → add this URL,
    subscribe to customer_unsubscribed + email_unsubscribed + email_bounced +
    email_spammed, copy the signing secret into env var CIO_WEBHOOK_SIGNING_SECRET.
    """

    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request):
        # IMPORTANT: read body BEFORE any access to request.data — DRF parsers
        # consume the stream and Django's HttpRequest.body raises if accessed
        # after the stream is drained.
        raw_body = request.body or b""
        sig = (request.headers.get("X-CIO-Signature") or "").strip()
        ts = (request.headers.get("X-CIO-Timestamp") or "").strip()
        if not _verify_cio_signature(raw_body, sig, ts):
            secret_len = len((getattr(settings, "CIO_WEBHOOK_SIGNING_SECRET", "") or "").strip())
            logger.warning(
                "cio_webhook_signature_rejected sig_present=%s sig_prefix=%s ts_present=%s "
                "body_len=%s secret_len=%s",
                bool(sig),
                sig[:5] if sig else "",
                bool(ts),
                len(raw_body),
                secret_len,
            )
            return Response(status=status.HTTP_401_UNAUTHORIZED)
        try:
            payload = json.loads(raw_body.decode("utf-8") or "{}")
        except Exception:
            return Response({"detail": "bad json"}, status=status.HTTP_400_BAD_REQUEST)
        event_type = _cio_event_type(payload)
        data = payload.get("data") or {}

        # Hard bounce / spam complaint → permanently suppress the address. Runs even
        # when no Django user matches (Apple relay profiles frequently have no local
        # account): the CIO profile is still suppressed by id/email so journeys,
        # newsletters, and transactional sends all stop.
        if event_type in _CIO_BOUNCE_EVENTS:
            cid, email = _extract_identity(data)
            if cid or email:
                from notifications.tasks import safe_enqueue_suppress_customer_in_cio

                safe_enqueue_suppress_customer_in_cio(cid or email, email or None)
            user = self._resolve_user(data)
            changed = []
            if user is not None:
                from authentication.models import UserEmailPreference

                prefs, _ = UserEmailPreference.objects.get_or_create(user=user)
                for field in ("marketing", "reminders", "weekly_digest"):
                    if getattr(prefs, field, None) is not False:
                        setattr(prefs, field, False)
                        changed.append(field)
                if changed:
                    prefs.save(update_fields=changed)
            logger.info(
                "cio_webhook_bounce_suppressed event=%s cid=%s email=%s user=%s changed=%s",
                event_type,
                cid,
                email,
                getattr(user, "pk", None),
                changed,
            )
            return Response({"ok": True, "suppressed": True}, status=status.HTTP_200_OK)

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
        cid, email = _extract_identity(data)
        if cid and cid.isdigit():
            user = User.objects.filter(pk=int(cid)).first()
            if user:
                return user
        if email:
            return User.objects.filter(email__iexact=email.lower()).first()
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

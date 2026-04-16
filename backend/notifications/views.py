import logging
import secrets

from django.conf import settings
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
                "cio_track_enabled": getattr(settings, "CIO_TRACK_ENABLED", False),
                "cio_region": getattr(settings, "CIO_REGION", ""),
            },
            status=http_status,
        )

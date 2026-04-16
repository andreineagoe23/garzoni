from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from notifications.enums import CioEventName
from notifications.service import NotificationService

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

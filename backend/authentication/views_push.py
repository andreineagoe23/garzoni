"""Register or clear Expo push notification token for the authenticated user."""

import logging

from django.db import transaction

from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework import status

from authentication.throttles import PushTokenRateThrottle

logger = logging.getLogger(__name__)


class ExpoPushTokenView(APIView):
    """
    POST /api/auth/push-token/
    Body: { "expo_push_token": "ExponentPushToken[...]" } or { "push_token": "..." }
    Send empty string to clear.
    """

    permission_classes = [IsAuthenticated]
    throttle_classes = [PushTokenRateThrottle]

    def post(self, request):
        raw = request.data.get("expo_push_token")
        if raw is None:
            raw = request.data.get("push_token")
        if raw is None:
            return Response(
                {"detail": "expo_push_token or push_token is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        token = str(raw).strip()
        if len(token) > 200:
            return Response(
                {"detail": "Token exceeds maximum length."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        profile = request.user.profile
        old_token = profile.expo_push_token
        profile.expo_push_token = token or None
        profile.save(update_fields=["expo_push_token"])
        if old_token != profile.expo_push_token:
            logger.info(
                "push_token.changed user_id=%s cleared=%s",
                request.user.id,
                not bool(token),
            )

        def _sync_cio():
            from notifications.tasks import safe_enqueue_sync_user_to_customer_io

            safe_enqueue_sync_user_to_customer_io(request.user.id)

        transaction.on_commit(_sync_cio)
        return Response({"ok": True}, status=status.HTTP_200_OK)

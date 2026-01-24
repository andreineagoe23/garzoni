from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView
from rest_framework.response import Response

from authentication.entitlements import (
    check_and_consume_entitlement,
    entitlement_usage_snapshot,
    get_entitlements_for_user,
)


class EntitlementsView(APIView):
    """Expose the current user's plan and entitlement limits."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        entitlements = get_entitlements_for_user(request.user)
        entitlements["usage"] = entitlement_usage_snapshot(request.user)
        return Response(entitlements)


class ConsumeEntitlementView(APIView):
    """Consume a unit from an entitlement if the user is allowed to use it."""

    permission_classes = [IsAuthenticated]

    def post(self, request):
        feature = request.data.get("feature")
        if not feature:
            return Response({"error": "Feature is required."}, status=status.HTTP_400_BAD_REQUEST)

        amount = request.data.get("amount", 1)
        allowed, meta = check_and_consume_entitlement(request.user, feature, amount)
        status_code = status.HTTP_200_OK

        if not allowed:
            status_code = (
                status.HTTP_402_PAYMENT_REQUIRED
                if meta.get("reason") == "upgrade"
                else status.HTTP_429_TOO_MANY_REQUESTS
            )

        response_payload = {
            "feature": feature,
            "allowed": allowed,
            **{k: v for k, v in meta.items() if k != "error"},
        }

        if not allowed:
            response_payload["error"] = meta.get("error", "Feature unavailable.")

        return Response(response_payload, status=status_code)

from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView
from rest_framework.response import Response

from authentication.entitlements import check_and_consume_entitlement
from core.http_client import request_with_backoff
from support.services.openrouter import OpenRouterService
from support.throttles import OpenRouterPlanRateThrottle


class OpenRouterProxyView(APIView):
    """Proxy view for OpenRouter AI chatbot integration."""

    permission_classes = [IsAuthenticated]
    throttle_classes = [OpenRouterPlanRateThrottle]

    def post(self, request):
        service = OpenRouterService(
            request,
            request_with_backoff=request_with_backoff,
            check_and_consume_entitlement=check_and_consume_entitlement,
        )
        payload, status_code = service.handle()
        return Response(payload, status=status_code)

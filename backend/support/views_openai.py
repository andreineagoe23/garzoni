from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from authentication.entitlements import check_and_consume_entitlement
from core.http_client import request_with_backoff
from support.services.openai import OpenAIService
from support.throttles import AITutorPlanRateThrottle


class OpenAIProxyView(APIView):
    """Proxy view for OpenAI AI chatbot integration."""

    permission_classes = [IsAuthenticated]
    throttle_classes = [AITutorPlanRateThrottle]

    def post(self, request):
        service = OpenAIService(
            request,
            request_with_backoff=request_with_backoff,
            check_and_consume_entitlement=check_and_consume_entitlement,
        )
        payload, status_code = service.handle()
        return Response(payload, status=status_code)

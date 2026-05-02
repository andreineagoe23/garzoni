from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from authentication.entitlements import check_and_consume_entitlement
from support.services.openai import OpenAIService, get_conversation_history
from support.throttles import AITutorPlanRateThrottle


class OpenAIProxyView(APIView):
    permission_classes = [IsAuthenticated]
    throttle_classes = [AITutorPlanRateThrottle]

    def post(self, request):
        service = OpenAIService(
            request,
            check_and_consume_entitlement=check_and_consume_entitlement,
        )
        payload, status_code = service.handle()
        return Response(payload, status=status_code)


class ConversationHistoryView(APIView):
    """Return recent tutor conversation messages for scrollback UI."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        source = request.query_params.get("source", "chat")
        limit = min(int(request.query_params.get("limit", 50)), 100)
        messages = get_conversation_history(request.user, source=source, limit=limit)
        return Response({"messages": messages})

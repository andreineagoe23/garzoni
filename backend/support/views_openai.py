from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from urllib.parse import quote

from authentication.entitlements import check_and_consume_entitlement
from support.models import Conversation, Message
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


class SessionDebriefView(APIView):
    """Seed the tutor chat with a post-exercise-session debrief prompt."""

    permission_classes = [IsAuthenticated]

    def post(self, request):
        accuracy = request.data.get("accuracy")
        weakest_categories = request.data.get("weakest_categories") or []
        missed_exercise_ids = request.data.get("missed_exercise_ids") or []
        if not isinstance(weakest_categories, list):
            weakest_categories = [str(weakest_categories)]

        categories = ", ".join(str(item) for item in weakest_categories if item) or "mixed topics"
        prompt = (
            "Debrief my last practice session. "
            f"Accuracy: {accuracy if accuracy is not None else 'unknown'}%. "
            f"Weakest categories: {categories}. "
            "Explain the likely pattern, give me one correction rule, and ask one follow-up question."
        )

        conversation = Conversation.objects.filter(user=request.user, source="chat").order_by(
            "-updated_at"
        ).first() or Conversation.objects.create(user=request.user, source="chat")
        Message.objects.create(conversation=conversation, role="user", content=prompt)
        return Response(
            {
                "conversation_id": conversation.id,
                "preseeded_message": prompt,
                "action_route": f"/chat?preseededMessage={quote(prompt)}",
                "exercise_context": {
                    "accuracy": accuracy,
                    "weakest_categories": weakest_categories,
                    "missed_exercise_ids": missed_exercise_ids,
                },
            },
            status=201,
        )

from rest_framework import generics, status
from rest_framework.permissions import AllowAny
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle
from rest_framework.decorators import throttle_classes
from django.db import transaction
from django.db.models import F, Case, When, Value, IntegerField

from support.models import FAQ, FAQFeedback
from support.serializers import FAQSerializer


class FAQListView(generics.ListAPIView):
    queryset = FAQ.objects.filter(is_active=True).order_by("category", "question")
    serializer_class = FAQSerializer
    permission_classes = [AllowAny]
    throttle_classes = [AnonRateThrottle]

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context["request"] = self.request
        return context


@api_view(["POST"])
@permission_classes([AllowAny])
@throttle_classes([AnonRateThrottle])
def vote_faq(request, faq_id):
    """Handle voting on FAQ helpfulness."""
    request_id = getattr(request, "request_id", None)
    vote = request.data.get("vote")
    if vote not in {"helpful", "not_helpful"}:
        return Response({"error": "Invalid vote", "request_id": request_id}, status=400)
    try:
        user = request.user if request.user.is_authenticated else None

        if user is None:
            if vote == "helpful":
                updated = FAQ.objects.filter(id=faq_id).update(helpful_count=F("helpful_count") + 1)
            else:
                updated = FAQ.objects.filter(id=faq_id).update(
                    not_helpful_count=F("not_helpful_count") + 1
                )

            if updated == 0:
                return Response({"error": "FAQ not found", "request_id": request_id}, status=404)
            return Response({"message": "Thanks for your feedback!"})

        with transaction.atomic():
            faq = FAQ.objects.select_for_update().get(id=faq_id)

            existing_feedback = (
                FAQFeedback.objects.select_for_update().filter(faq=faq, user=user).first()
            )

            if existing_feedback:
                if existing_feedback.vote == vote:
                    return Response({"message": "You have already voted this way"}, status=400)

                if existing_feedback.vote == "helpful" and vote == "not_helpful":
                    FAQ.objects.filter(id=faq_id).update(
                        helpful_count=Case(
                            When(helpful_count__gt=0, then=F("helpful_count") - 1),
                            default=Value(0),
                            output_field=IntegerField(),
                        ),
                        not_helpful_count=F("not_helpful_count") + 1,
                    )
                elif existing_feedback.vote == "not_helpful" and vote == "helpful":
                    FAQ.objects.filter(id=faq_id).update(
                        not_helpful_count=Case(
                            When(not_helpful_count__gt=0, then=F("not_helpful_count") - 1),
                            default=Value(0),
                            output_field=IntegerField(),
                        ),
                        helpful_count=F("helpful_count") + 1,
                    )

                existing_feedback.vote = vote
                existing_feedback.save(update_fields=["vote"])
                return Response({"message": "Thanks for your feedback!"})

            FAQFeedback.objects.create(faq=faq, user=user, vote=vote)
            if vote == "helpful":
                FAQ.objects.filter(id=faq_id).update(helpful_count=F("helpful_count") + 1)
            else:
                FAQ.objects.filter(id=faq_id).update(not_helpful_count=F("not_helpful_count") + 1)

            return Response({"message": "Thanks for your feedback!"})
    except FAQ.DoesNotExist:
        return Response({"error": "FAQ not found", "request_id": request_id}, status=404)

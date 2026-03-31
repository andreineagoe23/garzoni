# support/views.py
from rest_framework import generics, status
from rest_framework.permissions import AllowAny
from rest_framework.decorators import api_view, permission_classes, throttle_classes
from rest_framework.response import Response
from django.core.cache import cache
from django.db import transaction
from django.db.models import F, Case, When, Value, IntegerField
import logging
import hashlib
import time

from support.models import SupportEntry, SupportFeedback, ContactMessage
from support.serializers import SupportEntrySerializer
from support.tasks import send_contact_email
from support.throttles import ContactRateThrottle

logger = logging.getLogger(__name__)


class SupportListView(generics.ListAPIView):
    queryset = SupportEntry.objects.filter(is_active=True).order_by("category", "question")
    serializer_class = SupportEntrySerializer
    permission_classes = [AllowAny]

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context["request"] = self.request
        return context


@api_view(["POST"])
@permission_classes([AllowAny])
def vote_support(request, support_id):
    """Handle voting on support entry helpfulness."""
    request_id = getattr(request, "request_id", None)
    vote = request.data.get("vote")
    if vote not in {"helpful", "not_helpful"}:
        return Response({"error": "Invalid vote", "request_id": request_id}, status=400)
    try:
        user = request.user if request.user.is_authenticated else None

        # Anonymous votes: update counters atomically, but do not store per-user feedback.
        if user is None:
            if vote == "helpful":
                updated = SupportEntry.objects.filter(id=support_id).update(
                    helpful_count=F("helpful_count") + 1
                )
            else:
                updated = SupportEntry.objects.filter(id=support_id).update(
                    not_helpful_count=F("not_helpful_count") + 1
                )

            if updated == 0:
                return Response(
                    {"error": "Support entry not found", "request_id": request_id},
                    status=404,
                )
            return Response({"message": "Thanks for your feedback!"})

        with transaction.atomic():
            entry = SupportEntry.objects.select_for_update().get(id=support_id)

            existing_feedback = (
                SupportFeedback.objects.select_for_update()
                .filter(support_entry=entry, user=user)
                .first()
            )

            if existing_feedback:
                if existing_feedback.vote == vote:
                    return Response({"message": "You have already voted this way"}, status=400)

                # Switching vote: decrement previous bucket (clamped at 0), increment new bucket.
                if existing_feedback.vote == "helpful" and vote == "not_helpful":
                    SupportEntry.objects.filter(id=support_id).update(
                        helpful_count=Case(
                            When(helpful_count__gt=0, then=F("helpful_count") - 1),
                            default=Value(0),
                            output_field=IntegerField(),
                        ),
                        not_helpful_count=F("not_helpful_count") + 1,
                    )
                elif existing_feedback.vote == "not_helpful" and vote == "helpful":
                    SupportEntry.objects.filter(id=support_id).update(
                        not_helpful_count=Case(
                            When(
                                not_helpful_count__gt=0,
                                then=F("not_helpful_count") - 1,
                            ),
                            default=Value(0),
                            output_field=IntegerField(),
                        ),
                        helpful_count=F("helpful_count") + 1,
                    )

                existing_feedback.vote = vote
                existing_feedback.save(update_fields=["vote"])
                return Response({"message": "Thanks for your feedback!"})

            # New vote: create feedback + increment the correct counter atomically.
            SupportFeedback.objects.create(support_entry=entry, user=user, vote=vote)
            if vote == "helpful":
                SupportEntry.objects.filter(id=support_id).update(
                    helpful_count=F("helpful_count") + 1
                )
            else:
                SupportEntry.objects.filter(id=support_id).update(
                    not_helpful_count=F("not_helpful_count") + 1
                )

            return Response({"message": "Thanks for your feedback!"})
    except SupportEntry.DoesNotExist:
        return Response(
            {"error": "Support entry not found", "request_id": request_id},
            status=404,
        )


@api_view(["POST"])
@permission_classes([AllowAny])
@throttle_classes([ContactRateThrottle])
def contact_us(request):
    """Handle contact form submissions from users"""
    email = request.data.get("email")
    topic = request.data.get("topic", "General")
    message = request.data.get("message")
    feedback_type = request.data.get("feedback_type")
    context_url = (request.data.get("context_url") or "").strip()

    if not email or not message:
        return Response({"error": "Email and message are required."}, status=400)

    # Optional: prepend feedback context for feedback hub submissions
    if feedback_type or context_url:
        parts = []
        if feedback_type:
            parts.append(f"Type: {feedback_type}")
        if context_url:
            parts.append(f"Where: {context_url}")
        parts.append("")
        parts.append(message)
        message = "\n".join(parts)

    # Dedupe bursts: (email + topic + message hash + minute bucket)
    minute_bucket = int(time.time() // 60)
    dedupe_hash = hashlib.sha256(
        f"{email}|{topic}|{hashlib.sha256(message.encode('utf-8')).hexdigest()}|{minute_bucket}".encode(
            "utf-8"
        )
    ).hexdigest()
    dedupe_key = f"contact:dedupe:{dedupe_hash}"
    if not cache.add(dedupe_key, 1, timeout=120):
        return Response({"message": "Your message has been received!"}, status=202)

    # Save to database (only once per dedupe window)
    ContactMessage.objects.create(email=email, topic=topic, message=message)

    # Send email notification asynchronously (never silently drop)
    try:
        send_contact_email.delay(email=email, topic=topic, message=message)
    except Exception as e:
        request_id = getattr(request, "request_id", None)
        logger.error(
            "contact_email_queue_failed request_id=%s err=%s",
            request_id,
            str(e),
        )
        return Response(
            {
                "error": "We couldn't queue your message right now. Please try again.",
                "request_id": request_id,
            },
            status=503,
        )

    return Response({"message": "Your message has been received!"}, status=202)

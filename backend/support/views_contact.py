import hashlib
import logging
import time

from django.core.cache import cache
from rest_framework.decorators import api_view, permission_classes, throttle_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from support.models import ContactMessage
from support.tasks import send_contact_email
from support.throttles import ContactRateThrottle

logger = logging.getLogger(__name__)


@api_view(["POST"])
@permission_classes([AllowAny])
@throttle_classes([ContactRateThrottle])
def contact_us(request):
    """Handle contact form submissions from users"""
    email = request.data.get("email")
    topic = request.data.get("topic", "General")
    message = request.data.get("message")

    if not email or not message:
        return Response({"error": "Email and message are required."}, status=400)

    minute_bucket = int(time.time() // 60)
    dedupe_hash = hashlib.sha256(
        f"{email}|{topic}|{hashlib.sha256(message.encode('utf-8')).hexdigest()}|{minute_bucket}".encode(
            "utf-8"
        )
    ).hexdigest()
    dedupe_key = f"contact:dedupe:{dedupe_hash}"
    if not cache.add(dedupe_key, 1, timeout=120):
        return Response({"message": "Your message has been received!"}, status=202)

    ContactMessage.objects.create(email=email, topic=topic, message=message)

    try:
        send_contact_email.delay(email=email, topic=topic, message=message)
    except Exception as exc:
        request_id = getattr(request, "request_id", None)
        logger.error(
            "contact_email_queue_failed request_id=%s err=%s",
            request_id,
            str(exc),
        )
        return Response(
            {
                "error": "We couldn't queue your message right now. Please try again.",
                "request_id": request_id,
            },
            status=503,
        )

    return Response({"message": "Your message has been received!"}, status=202)

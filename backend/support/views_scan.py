"""
Receipt / bank statement scan endpoint.
Uses GPT-4o vision to categorise spending and recommend relevant lessons.
Pro-only feature.
"""

from __future__ import annotations

import base64
import logging

from django.conf import settings
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from authentication.entitlements import check_and_consume_entitlement

logger = logging.getLogger(__name__)

_SCAN_SYSTEM = (
    "You are Garzoni, a personal finance tutor. "
    "A user has uploaded a receipt or bank statement. "
    "Analyse the spending shown and return a JSON object with:\n"
    "  categories: [{name, amount, percent, emoji}] — top spending categories\n"
    "  insight: one sentence summary of the spending pattern\n"
    "  lesson_query: a short natural-language query to find the most relevant Garzoni lesson\n"
    "  tip: one actionable money tip based on this spending\n"
    "Output ONLY valid JSON — no markdown fences."
)


class ReceiptScanView(APIView):
    """
    POST /api/scan/

    Multipart form:
        image: image file (jpg, png, webp, gif — max 20 MB)

    Returns:
        { categories, insight, lesson_query, tip, recommended_lessons }
    """

    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request):
        allowed, meta = check_and_consume_entitlement(request.user, "ai_scan")
        if not allowed:
            from rest_framework import status

            code = (
                status.HTTP_402_PAYMENT_REQUIRED
                if meta.get("reason") == "upgrade"
                else status.HTTP_429_TOO_MANY_REQUESTS
            )
            return Response({"error": meta.get("error", "Scan requires Pro."), **meta}, status=code)

        image_file = request.FILES.get("image")
        if not image_file:
            return Response({"error": "image file required."}, status=400)

        if image_file.size > 20 * 1024 * 1024:
            return Response({"error": "Image too large (max 20 MB)."}, status=413)

        content_type = image_file.content_type or "image/jpeg"
        if not content_type.startswith("image/"):
            return Response({"error": "File must be an image."}, status=400)

        try:
            import json
            from openai import OpenAI

            client = OpenAI(api_key=settings.OPENAI_API_KEY)

            image_data = base64.b64encode(image_file.read()).decode("utf-8")
            data_url = f"data:{content_type};base64,{image_data}"

            resp = client.chat.completions.create(
                model="gpt-4o",
                messages=[
                    {"role": "system", "content": _SCAN_SYSTEM},
                    {
                        "role": "user",
                        "content": [
                            {
                                "type": "image_url",
                                "image_url": {"url": data_url, "detail": "low"},
                            },
                            {"type": "text", "text": "Analyse this receipt or statement."},
                        ],
                    },
                ],
                max_tokens=600,
                temperature=0.2,
            )
            raw = (resp.choices[0].message.content or "").strip()

            try:
                analysis = json.loads(raw)
            except json.JSONDecodeError:
                logger.warning("scan_json_parse_failed: %.300s", raw)
                return Response({"error": "Could not parse scan result."}, status=502)

            # Find relevant lessons via RAG
            recommended_lessons = []
            lesson_query = analysis.get("lesson_query", "")
            if lesson_query:
                try:
                    from education.services.retrieval import search

                    hits = search(lesson_query, top_k=2, content_types=["lesson", "course"])
                    recommended_lessons = [
                        {
                            "title": h["title"],
                            "content_id": h["content_id"],
                            "content_type": h["content_type"],
                        }
                        for h in hits
                    ]
                except Exception as exc:
                    logger.debug("scan_rag_error: %s", exc)

            return Response({**analysis, "recommended_lessons": recommended_lessons})

        except Exception:
            logger.error("receipt_scan_error", exc_info=True)
            return Response({"error": "Scan unavailable."}, status=500)

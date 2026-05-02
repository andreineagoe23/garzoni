"""
Voice tutor endpoint: audio → Whisper transcription → GPT answer → TTS audio.
Pro-only feature.
"""

from __future__ import annotations

import base64
import logging
import tempfile

from django.conf import settings
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from authentication.entitlements import check_and_consume_entitlement

logger = logging.getLogger(__name__)

_TTS_VOICE = "nova"
_TTS_MODEL = "tts-1"
_WHISPER_MODEL = "whisper-1"


class VoiceTutorView(APIView):
    """
    POST /api/voice-tutor/

    Multipart form:
        audio: binary audio file (m4a, webm, wav, ogg, mp3 — max ~25 MB)

    Returns:
        { transcript: str, response_text: str, audio_base64: str, mime: str }

    Rate-limits: ai_voice entitlement (Pro only).
    """

    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request):
        allowed, meta = check_and_consume_entitlement(request.user, "ai_voice")
        if not allowed:
            from rest_framework import status

            code = (
                status.HTTP_402_PAYMENT_REQUIRED
                if meta.get("reason") == "upgrade"
                else status.HTTP_429_TOO_MANY_REQUESTS
            )
            return Response(
                {"error": meta.get("error", "Voice tutor requires Pro."), **meta}, status=code
            )

        audio_file = request.FILES.get("audio")
        if not audio_file:
            return Response({"error": "audio file required."}, status=400)

        if audio_file.size > 25 * 1024 * 1024:
            return Response({"error": "Audio file too large (max 25 MB)."}, status=413)

        try:
            from openai import OpenAI

            client = OpenAI(api_key=settings.OPENAI_API_KEY)

            # 1. Transcribe
            suffix = _detect_suffix(audio_file.name or "audio.m4a")
            with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
                for chunk in audio_file.chunks():
                    tmp.write(chunk)
                tmp_path = tmp.name

            with open(tmp_path, "rb") as f:
                transcript_resp = client.audio.transcriptions.create(
                    model=_WHISPER_MODEL,
                    file=f,
                    response_format="text",
                )
            transcript = str(transcript_resp).strip()
            if not transcript:
                return Response({"error": "Could not transcribe audio."}, status=422)

            # 2. GPT answer (use full tutor service for context injection)
            from support.services.openai import OpenAIService
            from authentication.entitlements import check_and_consume_entitlement as _cace

            class _FakeRequest:
                def __init__(self, user, text):
                    self.user = user
                    self.data = {
                        "inputs": text,
                        "source": "voice",
                        "parameters": {"temperature": 0.5},
                    }
                    self.headers = {}

            fake_req = _FakeRequest(request.user, transcript)
            service = OpenAIService(fake_req, check_and_consume_entitlement=_cace)
            # Temporarily mark already consumed so service doesn't double-charge
            payload, status_code = service.handle()
            if status_code != 200:
                return Response(payload, status=status_code)
            response_text = payload.get("response", "")

            # 3. TTS
            tts_resp = client.audio.speech.create(
                model=_TTS_MODEL,
                voice=_TTS_VOICE,
                input=response_text[:4096],
            )
            audio_bytes = tts_resp.content
            audio_b64 = base64.b64encode(audio_bytes).decode("utf-8")

            return Response(
                {
                    "transcript": transcript,
                    "response_text": response_text,
                    "audio_base64": audio_b64,
                    "mime": "audio/mpeg",
                }
            )

        except Exception:
            logger.error("voice_tutor_error", exc_info=True)
            return Response({"error": "Voice tutor unavailable."}, status=500)


def _detect_suffix(filename: str) -> str:
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else "m4a"
    allowed = {"m4a", "mp3", "mp4", "mpeg", "mpga", "wav", "webm", "ogg"}
    return f".{ext}" if ext in allowed else ".m4a"

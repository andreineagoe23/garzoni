"""
Content translation provider layer.

Provides a narrow interface for translating education content to Romanian,
backed by OpenAI (swappable via CONTENT_TRANSLATION_PROVIDER setting).

Usage:
    from education.services.translation import get_translator
    t = get_translator()
    ro_text = t.translate_text("What Is a Budget?", context={"field": "lesson_title"})
    ro_exercise = t.translate_exercise(exercise_data, context={...})
"""

from __future__ import annotations

import hashlib
import json
import logging
import re
import time
from abc import ABC, abstractmethod
from typing import Any, Dict, List, Optional

import requests
from django.conf import settings

logger = logging.getLogger(__name__)

OPENAI_API_URL = "https://api.openai.com/v1/chat/completions"


class OpenAIPaymentRequiredError(Exception):
    """Raised when OpenAI returns 402 Payment Required (credits exhausted or billing limit)."""

    pass


class TranslationProvider(ABC):
    """Narrow interface every translation backend must implement."""

    @abstractmethod
    def translate_text(self, text: str, context: Optional[Dict[str, Any]] = None) -> str: ...

    def translate_exercise(
        self, exercise_data: Dict[str, Any], context: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """Translate exercise payload while preserving structural invariants."""
        question = str(exercise_data.get("question") or "").strip()
        options: List[str] = [str(o) for o in exercise_data.get("options") or []]
        explanation = str(exercise_data.get("explanation") or "").strip()

        if not question or not options:
            return exercise_data

        ctx = {**(context or {}), "content_type": "exercise"}
        ro_q = self.translate_text(question, {**ctx, "field": "exercise_question"})
        ro_opts = [self.translate_text(opt, {**ctx, "field": "exercise_option"}) for opt in options]
        ro_expl = (
            self.translate_text(explanation, {**ctx, "field": "exercise_explanation"})
            if explanation
            else ""
        )

        return {
            **exercise_data,
            "question": ro_q,
            "options": ro_opts,
            "explanation": ro_expl,
        }


class OpenAITranslator(TranslationProvider):
    """Translate content via the OpenAI chat-completions API."""

    DEFAULT_MODEL = "gpt-5-nano"

    def __init__(self):
        self.api_key: str = getattr(settings, "OPENAI_API_KEY", "") or ""
        self.model: str = getattr(settings, "CONTENT_TRANSLATION_MODEL", "") or self.DEFAULT_MODEL
        self.max_retries: int = 3
        self.backoff_base: float = 2.0

    def translate_text(self, text: str, context: Optional[Dict[str, Any]] = None) -> str:
        text = (text or "").strip()
        if not text:
            return ""

        prompt = self._build_prompt(text, context)
        result = self._call_api(prompt)
        if result is None:
            logger.warning("Translation API returned None for text: %s", text[:80])
            return text
        return result.strip()

    def _build_prompt(self, text: str, context: Optional[Dict[str, Any]] = None) -> str:
        ctx = context or {}
        field = ctx.get("field", "")

        if field == "exercise_option":
            instruction = (
                "Translate the following answer option to Romanian. "
                "Keep it concise and natural. Return ONLY the translated text, nothing else."
            )
        elif field == "exercise_question":
            instruction = (
                "Translate the following quiz question to Romanian. "
                "Keep financial terms accurate. Return ONLY the translated text, nothing else."
            )
        elif field == "exercise_explanation":
            instruction = (
                "Translate the following explanation to Romanian in a friendly, conversational tone. "
                "Keep financial terms accurate. Return ONLY the translated text, nothing else."
            )
        elif "title" in field:
            instruction = (
                "Translate the following title to Romanian. "
                "Keep it short and natural. Return ONLY the translated text, nothing else."
            )
        else:
            instruction = (
                "Translate the following text to Romanian in a friendly, conversational, "
                "educational tone suitable for a personal finance learning app. "
                "Keep financial terminology accurate. Return ONLY the translated text, nothing else."
            )

        return f"{instruction}\n\n{text}"

    def _call_api(self, prompt: str) -> Optional[str]:
        if not self.api_key:
            logger.error("OPENAI_API_KEY is not configured; cannot translate.")
            return None

        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

        payload = {
            "model": self.model,
            "messages": [
                {
                    "role": "system",
                    "content": (
                        "You are a professional translator specializing in personal finance "
                        "education content. Translate from English to Romanian. "
                        "Use a friendly, conversational, app-like tone. "
                        "Preserve all numbers, currency symbols, and formatting. "
                        "Return ONLY the translated text with no additional commentary."
                    ),
                },
                {"role": "user", "content": prompt},
            ],
            "temperature": 0.3,
            "max_tokens": 2048,
        }

        for attempt in range(1, self.max_retries + 1):
            try:
                resp = requests.post(
                    OPENAI_API_URL,
                    headers=headers,
                    json=payload,
                    timeout=60,
                )

                if resp.status_code == 429:
                    wait = self.backoff_base**attempt
                    logger.warning(
                        "Rate limited (429). Sleeping %.1fs before retry %d", wait, attempt
                    )
                    time.sleep(wait)
                    continue

                if resp.status_code == 402:
                    logger.error(
                        "OpenAI returned 402 Payment Required. "
                        "Credits exhausted or billing limit reached. "
                        "Add credits in OpenAI billing and re-run to resume."
                    )
                    raise OpenAIPaymentRequiredError(
                        "OpenAI 402 Payment Required – add credits to continue."
                    )

                resp.raise_for_status()
                data = resp.json()
                choices = data.get("choices") or []
                if choices:
                    content = choices[0].get("message", {}).get("content", "")
                    return content.strip()

                logger.warning("Empty choices from OpenAI: %s", data)
                return None

            except requests.Timeout:
                logger.warning("OpenAI timeout on attempt %d", attempt)
                if attempt < self.max_retries:
                    time.sleep(self.backoff_base**attempt)
            except requests.RequestException as exc:
                logger.error("OpenAI request error on attempt %d: %s", attempt, exc)
                if attempt < self.max_retries:
                    time.sleep(self.backoff_base**attempt)

        return None


class NoopTranslator(TranslationProvider):
    """Returns the English text unchanged. Useful for tests and dry runs."""

    def translate_text(self, text: str, context: Optional[Dict[str, Any]] = None) -> str:
        return text or ""


def get_translator() -> TranslationProvider:
    provider = getattr(settings, "CONTENT_TRANSLATION_PROVIDER", "openai")
    if provider == "noop":
        return NoopTranslator()
    return OpenAITranslator()

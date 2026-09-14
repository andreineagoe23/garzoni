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
from typing import Any, Dict, List, Optional, Tuple

import requests
from django.conf import settings

logger = logging.getLogger(__name__)

OPENAI_API_URL = "https://api.openai.com/v1/chat/completions"


def _match_final_period(translated: str, source: str) -> str:
    """A lone full stop on one option gives the answer away; end options as the English does."""
    translated = translated.strip()
    if translated.endswith(".") and not source.strip().endswith("."):
        return translated[:-1].rstrip()
    return translated


def _strip_code_fence(text: str) -> str:
    return re.sub(r"^```[a-zA-Z]*\s*|\s*```$", "", text.strip())


class OpenAIPaymentRequiredError(Exception):
    """Raised when OpenAI credits are exhausted (402, or 429 insufficient_quota)."""

    pass


class TranslationProvider(ABC):
    """Narrow interface every translation backend must implement."""

    @abstractmethod
    def translate_text(self, text: str, context: Optional[Dict[str, Any]] = None) -> str: ...

    def _translate_multiple_choice(
        self, question: str, options: List[str], explanation: str, context: Dict[str, Any]
    ) -> Optional[Tuple[str, List[str], str]]:
        """Translate a whole multiple-choice question in one pass; None to go per string."""
        return None

    def translate_exercise(
        self, exercise_data: Dict[str, Any], context: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """Translate exercise payload while preserving structural invariants."""
        question = str(exercise_data.get("question") or "").strip()
        options: List[str] = [str(o) for o in exercise_data.get("options") or []]
        explanation = str(exercise_data.get("explanation") or "").strip()

        ctx = {**(context or {}), "content_type": "exercise"}

        # Non-multiple-choice shapes (numeric, drag-and-drop) have no options; translate
        # their text fields while preserving ids, numbers, and structure.
        if question and not options:
            items = exercise_data.get("items")
            expected = exercise_data.get("expected_value") or exercise_data.get("correct_answer")
            ro_expl = (
                self.translate_text(explanation, {**ctx, "field": "exercise_explanation"})
                if explanation
                else exercise_data.get("explanation", "")
            )
            if isinstance(items, list) and items:  # drag-and-drop
                ro_items = [
                    (
                        {
                            **it,
                            "label": self.translate_text(
                                str(it.get("label", "")), {**ctx, "field": "exercise_option"}
                            ),
                        }
                        if isinstance(it, dict)
                        else it
                    )
                    for it in items
                ]
                return {
                    **exercise_data,
                    "question": self.translate_text(
                        question, {**ctx, "field": "exercise_question"}
                    ),
                    "items": ro_items,
                    "explanation": ro_expl,
                }
            if expected is not None:  # numeric
                out = {
                    **exercise_data,
                    "question": self.translate_text(
                        question, {**ctx, "field": "exercise_question"}
                    ),
                    "explanation": ro_expl,
                }
                if exercise_data.get("prompt"):
                    out["prompt"] = self.translate_text(str(exercise_data["prompt"]), ctx)
                return out
            return exercise_data

        if not question or not options:
            return exercise_data

        batched = self._translate_multiple_choice(question, options, explanation, ctx)
        if batched:
            ro_q, ro_opts, ro_expl = batched
        else:
            ro_q = self.translate_text(question, {**ctx, "field": "exercise_question"})
            ro_opts = [
                self.translate_text(opt, {**ctx, "field": "exercise_option"}) for opt in options
            ]
            ro_expl = (
                self.translate_text(explanation, {**ctx, "field": "exercise_explanation"})
                if explanation
                else ""
            )
        ro_opts = [_match_final_period(ro, en) for ro, en in zip(ro_opts, options)]

        return {
            **exercise_data,
            "question": ro_q,
            "options": ro_opts,
            "explanation": ro_expl,
        }


class OpenAITranslator(TranslationProvider):
    """Translate content via the OpenAI chat-completions API."""

    DEFAULT_MODEL = "gpt-4.1-mini"

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

    def _translate_multiple_choice(
        self, question: str, options: List[str], explanation: str, context: Dict[str, Any]
    ) -> Optional[Tuple[str, List[str], str]]:
        # One call for the whole question. Options sent one at a time had no question to
        # agree with, so terms drifted and gender agreement broke ("fiecărui liră").
        source = {"question": question, "options": options, "explanation": explanation}
        prompt = (
            "Translate this multiple-choice question from a personal finance learning app to "
            "Romanian, in a friendly, conversational tone. Keep the options in the same order "
            "and the same number. Translate each English term the same way in the question, "
            "options and explanation, and make every option agree grammatically with the "
            "question. Preserve numbers and currency symbols. Return ONLY a JSON object with "
            'the keys "question", "options" (a list of strings) and "explanation".\n\n'
            + json.dumps(source, ensure_ascii=False)
        )
        raw = self._call_api(prompt)
        if not raw:
            return None
        try:
            data = json.loads(_strip_code_fence(raw))
        except ValueError:
            logger.warning("Multiple-choice translation was not JSON; translating per string.")
            return None
        if not isinstance(data, dict):
            return None
        ro_q, ro_opts, ro_expl = data.get("question"), data.get("options"), data.get("explanation")
        valid = (
            isinstance(ro_q, str)
            and ro_q.strip()
            and isinstance(ro_opts, list)
            and len(ro_opts) == len(options)
            and all(isinstance(o, str) and o.strip() for o in ro_opts)
            # Grading is by index, so a reordered list is the failure that matters. Numbers
            # survive translation, which catches a swap between options that carry any.
            and all(
                re.findall(r"\d+", ro) == re.findall(r"\d+", en) for ro, en in zip(ro_opts, options)
            )
        )
        if not valid:
            logger.warning("Multiple-choice translation failed validation; translating per string.")
            return None
        ro_expl = ro_expl.strip() if isinstance(ro_expl, str) and explanation else ""
        return ro_q.strip(), [o.strip() for o in ro_opts], ro_expl

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
        }
        m = str(self.model)
        token_field = (
            "max_completion_tokens" if m.startswith(("gpt-5", "o1", "o3", "o4")) else "max_tokens"
        )
        payload[token_field] = 2048

        for attempt in range(1, self.max_retries + 1):
            try:
                resp = requests.post(
                    OPENAI_API_URL,
                    headers=headers,
                    json=payload,
                    timeout=60,
                )

                if resp.status_code == 429:
                    try:
                        body = resp.json()
                    except ValueError:
                        body = {}
                    error = body.get("error") if isinstance(body, dict) else None
                    code = error.get("code") if isinstance(error, dict) else None
                    if code in {"insufficient_quota", "credit_balance_exhausted"}:
                        # An empty balance also answers 429. Retrying cannot help, and
                        # returning None makes callers store the English source as the
                        # translation, which --only-missing then treats as done.
                        logger.error("OpenAI 429 %s: credits exhausted.", code)
                        raise OpenAIPaymentRequiredError(
                            f"OpenAI 429 {code} – add credits to continue."
                        )
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

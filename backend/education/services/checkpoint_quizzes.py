"""
Materialize short lesson checkpoint quizzes from in-lesson multiple-choice sections.

Reuses the core Quiz + QuizCompletion + /quizzes/complete/ reward path.
"""

from __future__ import annotations

import logging
import re
from typing import Any

from django.db import transaction

from education.models import Lesson, LessonSection, Quiz

logger = logging.getLogger(__name__)

CHECKPOINT_MAX_QUESTIONS = 3
_HTML_TAG_RE = re.compile(r"<[^>]+>")


def _strip_html(text: str) -> str:
    s = _HTML_TAG_RE.sub(" ", text or "")
    return " ".join(s.split()).strip()


def _normalize_option(raw: Any) -> str | None:
    if raw is None:
        return None
    if isinstance(raw, str):
        t = _strip_html(raw)
        return t[:500] if t else None
    if isinstance(raw, dict):
        for key in ("text", "label", "title", "value"):
            v = raw.get(key)
            if isinstance(v, str) and v.strip():
                return _strip_html(v)[:500]
    return None


def _mc_options_from_exercise_data(data: dict[str, Any]) -> list[str]:
    raw = data.get("options") or data.get("choices")
    if not isinstance(raw, list):
        return []
    out: list[str] = []
    for item in raw:
        t = _normalize_option(item)
        if t and t not in out:
            out.append(t)
    return out


def _correct_choice_text(options: list[str], data: dict[str, Any]) -> str | None:
    if not options:
        return None
    ca = data.get("correctAnswer")
    if data.get("correct_answer") is not None and ca is None:
        ca = data.get("correct_answer")
    if isinstance(ca, int) and 0 <= ca < len(options):
        return options[ca]
    if isinstance(ca, str):
        ca_stripped = _strip_html(ca)
        for opt in options:
            if opt == ca_stripped:
                return opt
        if ca_stripped in options:
            return ca_stripped
    return options[0]


def get_or_create_quiz_from_mc_section(section: LessonSection) -> Quiz | None:
    """
    Build a single Quiz row from a lesson section's multiple-choice exercise_data.
    Returns None if the section is not suitable.
    """
    if (
        section.content_type != "exercise"
        or section.exercise_type != "multiple-choice"
    ):
        return None
    data = section.exercise_data if isinstance(section.exercise_data, dict) else {}
    options = _mc_options_from_exercise_data(data)
    if len(options) < 2:
        return None
    question_raw = (
        (data.get("question") if isinstance(data.get("question"), str) else None)
        or section.title
        or ""
    )
    question = _strip_html(str(question_raw))[:2000]
    if not question:
        return None
    correct = _correct_choice_text(options, data)
    if not correct:
        return None
    choices = [{"text": opt} for opt in options]
    lesson = section.lesson
    course = lesson.course

    with transaction.atomic():
        quiz, created = Quiz.objects.select_for_update().get_or_create(
            source_lesson_section=section,
            defaults={
                "course": course,
                "lesson": lesson,
                "title": (section.title or "Checkpoint")[:200],
                "question": question,
                "choices": choices,
                "correct_answer": correct[:200],
            },
        )
        if not created:
            touch = False
            if quiz.lesson_id != lesson.id:
                quiz.lesson = lesson
                touch = True
            if quiz.course_id != course.id:
                quiz.course = course
                touch = True
            if touch:
                quiz.save(update_fields=["lesson", "course"])
    return quiz


def ensure_checkpoint_quizzes_for_lesson(lesson: Lesson) -> list[Quiz]:
    """
    Ensure up to CHECKPOINT_MAX_QUESTIONS checkpoint quizzes exist for this lesson.
    Returns ordered Quiz instances (section order).
    """
    sections = (
        lesson.sections.filter(
            is_published=True,
            content_type="exercise",
            exercise_type="multiple-choice",
        )
        .order_by("order")[:CHECKPOINT_MAX_QUESTIONS]
    )
    out: list[Quiz] = []
    for section in sections:
        try:
            q = get_or_create_quiz_from_mc_section(section)
            if q:
                out.append(q)
        except Exception:
            logger.exception(
                "checkpoint_quiz_materialize_failed",
                extra={"section_id": getattr(section, "id", None)},
            )
    return out

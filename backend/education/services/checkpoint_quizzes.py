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
    if section.content_type != "exercise" or section.exercise_type != "multiple-choice":
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


def resync_quiz_from_section(section: LessonSection) -> str | None:
    """
    Push a section's current multiple-choice content into its checkpoint Quiz.

    ``get_or_create_quiz_from_mc_section`` only fills a Quiz on creation, so any
    later edit to the section — an AI rewrite, an option reshuffle — left the
    checkpoint modal showing the old wording and, worse, an option order that no
    longer matched. Call this after every write to ``exercise_data``.

    Returns a short note when a translation had to be blanked, else None.
    """
    from education.models import LessonSectionTranslation, QuizTranslation

    quiz = Quiz.objects.filter(source_lesson_section=section).first()
    if quiz is None:
        return None

    data = section.exercise_data if isinstance(section.exercise_data, dict) else {}
    options = _mc_options_from_exercise_data(data)
    if section.exercise_type != "multiple-choice" or len(options) < 2:
        # The section was converted to another exercise type after its
        # checkpoint was materialized. ensure_checkpoint_quizzes_for_lesson only
        # looks at multiple-choice sections, so nothing ever revisits this row
        # and the checkpoint keeps asking a question the lesson no longer
        # contains. Not deleted here — that would cascade QuizCompletion rows.
        return (
            f"quiz {quiz.id} orphaned: section is now {section.exercise_type or 'not an exercise'}"
        )
    correct_text = _correct_choice_text(options, data)
    if not correct_text:
        return None

    raw_options = data.get("options") if isinstance(data.get("options"), list) else []
    correct_idx = data.get("correctAnswer")
    if not isinstance(correct_idx, int) or isinstance(correct_idx, bool):
        correct_idx = None

    old_choices = quiz.choices or []
    new_choices = []
    for i, text in enumerate(options):
        if i < len(old_choices) and isinstance(old_choices[i], dict):
            new_choices.append({**old_choices[i], "text": text})
        else:
            new_choices.append({"text": text})

    question_raw = data.get("question") if isinstance(data.get("question"), str) else None
    question = _strip_html(str(question_raw or section.title or ""))[:2000]

    quiz.choices = new_choices
    quiz.correct_answer = correct_text[:200]
    if question:
        quiz.question = question
    quiz.save(update_fields=["question", "choices", "correct_answer"])

    # QuizTranslation.choices is index-aligned to Quiz.choices, so it can only
    # be rebuilt from a section translation with the same option count.
    # Anything else is blanked for the translate command to refill rather than
    # left silently pointing at the wrong option.
    note = None
    for qt in QuizTranslation.objects.filter(quiz=quiz):
        tr = LessonSectionTranslation.objects.filter(section=section, language=qt.language).first()
        tr_data = tr.exercise_data if tr and isinstance(tr.exercise_data, dict) else None
        tr_raw = tr_data.get("options") if tr_data else None
        rebuilt = False
        if (
            correct_idx is not None
            and isinstance(tr_raw, list)
            and len(tr_raw) == len(raw_options)
            and correct_idx < len(tr_raw)
        ):
            tr_options: list[str] = []
            for item in tr_raw:
                text = _normalize_option(item)
                if text and text not in tr_options:
                    tr_options.append(text)
            if len(tr_options) == len(new_choices):
                qt.choices = [{"text": text} for text in tr_options]
                qt.correct_answer = (_normalize_option(tr_raw[correct_idx]) or "")[:200]
                tr_question = tr_data.get("question")
                if isinstance(tr_question, str) and tr_question.strip():
                    qt.question = _strip_html(tr_question)[:2000]
                qt.save(update_fields=["question", "choices", "correct_answer"])
                rebuilt = True
        if not rebuilt:
            qt.choices = []
            qt.correct_answer = ""
            qt.save(update_fields=["choices", "correct_answer"])
            note = f"blanked {qt.language} quiz translation"
    return note


def orphaned_checkpoint_quizzes():
    """
    Checkpoint quizzes whose source section is no longer multiple-choice.

    These keep asking the section's pre-conversion question, so the lesson shows
    (say) a numeric input while the checkpoint modal shows the old options.
    """
    return Quiz.objects.filter(source_lesson_section__isnull=False).exclude(
        source_lesson_section__exercise_type="multiple-choice"
    )


def generate_ai_checkpoint_questions(lesson: Lesson, n: int = 3) -> list[Quiz]:
    """
    Use GPT to generate n novel comprehension questions from a lesson's published text sections.

    Calls ai_tutor.generate_checkpoint_questions() and stores each result as a Quiz row
    (without source_lesson_section so it doesn't collide with MC-materialized rows).
    Returns the Quiz instances created; skips duplicates idempotently.
    Falls back to an empty list if AI is unavailable or the lesson has no text content.
    """
    from education.services.ai_tutor import generate_checkpoint_questions

    text_sections = lesson.sections.filter(is_published=True, content_type="text").order_by("order")

    combined_text = "\n\n".join(
        _strip_html(s.text_content or "") for s in text_sections if s.text_content
    ).strip()

    if not combined_text:
        return []

    raw_questions = generate_checkpoint_questions(
        section_content=combined_text,
        lesson_title=lesson.title or "",
        n=n,
    )

    out: list[Quiz] = []
    for item in raw_questions:
        question = (item.get("question") or "").strip()
        choices_raw = item.get("choices") or []
        correct_answer = (item.get("correct_answer") or "").strip()
        if not question or len(choices_raw) < 2 or not correct_answer:
            continue
        choices = [{"text": str(c)} for c in choices_raw]
        try:
            with transaction.atomic():
                quiz, _ = Quiz.objects.get_or_create(
                    course=lesson.course,
                    lesson=lesson,
                    question=question[:2000],
                    defaults={
                        "title": f"AI Checkpoint: {lesson.title or 'Quiz'}"[:200],
                        "choices": choices,
                        "correct_answer": correct_answer[:200],
                    },
                )
            out.append(quiz)
        except Exception:
            logger.exception(
                "ai_checkpoint_quiz_save_failed",
                extra={"lesson_id": getattr(lesson, "id", None)},
            )

    return out


def ensure_checkpoint_quizzes_for_lesson(lesson: Lesson) -> list[Quiz]:
    """
    Ensure up to CHECKPOINT_MAX_QUESTIONS checkpoint quizzes exist for this lesson.
    Returns ordered Quiz instances (section order).
    """
    sections = lesson.sections.filter(
        is_published=True,
        content_type="exercise",
        exercise_type="multiple-choice",
    ).order_by("order")[:CHECKPOINT_MAX_QUESTIONS]
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

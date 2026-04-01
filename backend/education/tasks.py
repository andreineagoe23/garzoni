# education/tasks.py
from __future__ import annotations

import hashlib
import html
import json
import logging
import re
from typing import Any, Dict, Optional

from celery import shared_task
from django.conf import settings
from django.contrib.auth.models import User
from django.db import transaction
from django.db.models import Max
from django.utils import timezone
from django.utils.html import strip_tags

logger = logging.getLogger(__name__)

LANGUAGE_CODE = "ro"


@shared_task
def reset_inactive_streaks():
    """
    Reset streaks for users who have been inactive for over 24 hours.

    - Checks the last activity date for each user.
    - If a user has been inactive for more than a day, their streak is reset to 0.
    """
    from education.models import UserProgress

    users = User.objects.annotate(
        last_active=Max("userprogress__last_completed_date")
    ).select_related("profile")

    for user in users:
        if user.last_active:
            today = timezone.now().date()
            days_inactive = (today - user.last_active).days
            if days_inactive > 1:
                previous_streak = getattr(getattr(user, "profile", None), "streak", 0)
                UserProgress.objects.filter(user=user).update(streak=0)
                if previous_streak and previous_streak > 3:
                    from authentication.tasks import send_streak_broken_email

                    send_streak_broken_email.delay(user.id, previous_streak)


def _source_hash(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()[:16]


def _clean_html(value: Optional[str]) -> str:
    if not value:
        return ""
    text = strip_tags(str(value))
    text = html.unescape(text)
    return re.sub(r"\s+", " ", text).strip()


@shared_task(bind=True, max_retries=3, default_retry_delay=60)
def translate_path_async(self, path_id: int):
    """Translate a single Path to Romanian in the background."""
    if not getattr(settings, "CONTENT_TRANSLATION_ENABLED", False):
        return

    from education.models import Path, PathTranslation
    from education.services.translation import OpenAIPaymentRequiredError, get_translator

    try:
        path = Path.objects.get(pk=path_id)
    except Path.DoesNotExist:
        return

    current_hash = _source_hash(f"{path.title}|{path.description}")

    existing = PathTranslation.objects.filter(path=path, language=LANGUAGE_CODE).first()
    if existing and existing.source_hash == current_hash:
        return

    try:
        translator = get_translator()
        with transaction.atomic():
            PathTranslation.objects.update_or_create(
                path=path,
                language=LANGUAGE_CODE,
                defaults={
                    "title": translator.translate_text(path.title, {"field": "path_title"}),
                    "description": translator.translate_text(
                        path.description, {"field": "path_description"}
                    ),
                    "source_hash": current_hash,
                },
            )
        logger.info("Translated Path %s (%s) to %s", path.pk, path.title, LANGUAGE_CODE)
    except OpenAIPaymentRequiredError:
        logger.error(
            "OpenAI 402 Payment Required – skipping Path %s. Add credits to resume.", path_id
        )
        return


@shared_task(bind=True, max_retries=3, default_retry_delay=60)
def translate_course_async(self, course_id: int):
    """Translate a single Course to Romanian in the background."""
    if not getattr(settings, "CONTENT_TRANSLATION_ENABLED", False):
        return

    from education.models import Course, CourseTranslation
    from education.services.translation import OpenAIPaymentRequiredError, get_translator

    try:
        course = Course.objects.get(pk=course_id)
    except Course.DoesNotExist:
        return

    current_hash = _source_hash(f"{course.title}|{course.description}")

    existing = CourseTranslation.objects.filter(course=course, language=LANGUAGE_CODE).first()
    if existing and existing.source_hash == current_hash:
        return

    try:
        translator = get_translator()
        with transaction.atomic():
            CourseTranslation.objects.update_or_create(
                course=course,
                language=LANGUAGE_CODE,
                defaults={
                    "title": translator.translate_text(course.title, {"field": "course_title"}),
                    "description": translator.translate_text(
                        course.description, {"field": "course_description"}
                    ),
                    "source_hash": current_hash,
                },
            )
        logger.info("Translated Course %s (%s) to %s", course.pk, course.title, LANGUAGE_CODE)
    except OpenAIPaymentRequiredError:
        logger.error(
            "OpenAI 402 Payment Required – skipping Course %s. Add credits to resume.",
            course_id,
        )
        return


@shared_task(bind=True, max_retries=3, default_retry_delay=60)
def translate_lesson_async(self, lesson_id: int):
    """Translate a single Lesson (+ all its sections) to Romanian in the background."""
    if not getattr(settings, "CONTENT_TRANSLATION_ENABLED", False):
        return

    from education.models import (
        Lesson,
        LessonSection,
        LessonSectionTranslation,
        LessonTranslation,
    )
    from education.services.translation import OpenAIPaymentRequiredError, get_translator

    try:
        lesson = Lesson.objects.select_related("course").get(pk=lesson_id)
    except Lesson.DoesNotExist:
        return

    try:
        translator = get_translator()
        course_title = lesson.course.title if lesson.course else ""
        ctx: Dict[str, Any] = {"course": course_title, "lesson": lesson.title}

        detail_clean = _clean_html(lesson.detailed_content)
        lesson_source = f"{lesson.title}|{lesson.short_description or ''}|{detail_clean}"
        current_hash = _source_hash(lesson_source)

        existing = LessonTranslation.objects.filter(lesson=lesson, language=LANGUAGE_CODE).first()
        if not existing or existing.source_hash != current_hash:
            with transaction.atomic():
                LessonTranslation.objects.update_or_create(
                    lesson=lesson,
                    language=LANGUAGE_CODE,
                    defaults={
                        "title": translator.translate_text(
                            lesson.title, {**ctx, "field": "lesson_title"}
                        ),
                        "short_description": translator.translate_text(
                            lesson.short_description or "",
                            {**ctx, "field": "lesson_short_description"},
                        ),
                        "detailed_content": (
                            translator.translate_text(
                                detail_clean, {**ctx, "field": "lesson_detailed_content"}
                            )
                            if detail_clean
                            else ""
                        ),
                        "source_hash": current_hash,
                    },
                )

        for section in lesson.sections.order_by("order"):
            _translate_section(translator, section, ctx)

        logger.info("Translated Lesson %s (%s) to %s", lesson.pk, lesson.title, LANGUAGE_CODE)
    except OpenAIPaymentRequiredError:
        logger.error(
            "OpenAI 402 Payment Required – skipping Lesson %s. Add credits to resume.",
            lesson_id,
        )
        return


@shared_task(bind=True, max_retries=3, default_retry_delay=60)
def translate_section_async(self, section_id: int):
    """Translate a single LessonSection to Romanian in the background."""
    if not getattr(settings, "CONTENT_TRANSLATION_ENABLED", False):
        return

    from education.models import LessonSection
    from education.services.translation import OpenAIPaymentRequiredError, get_translator

    try:
        section = LessonSection.objects.select_related("lesson", "lesson__course").get(
            pk=section_id
        )
    except LessonSection.DoesNotExist:
        return

    lesson = section.lesson
    ctx: Dict[str, Any] = {
        "course": lesson.course.title if lesson.course else "",
        "lesson": lesson.title,
    }
    try:
        translator = get_translator()
        _translate_section(translator, section, ctx)
        logger.info("Translated LessonSection %s to %s", section.pk, LANGUAGE_CODE)
    except OpenAIPaymentRequiredError:
        logger.error(
            "OpenAI 402 Payment Required – skipping Section %s. Add credits to resume.",
            section_id,
        )
        return


def _translate_section(translator, section, ctx: Dict[str, Any]):
    from education.models import LessonSectionTranslation

    base_ctx = {**ctx, "section_order": section.order, "section_title": section.title}
    source_parts = [section.title or ""]

    if section.content_type == "text":
        text = _clean_html(section.text_content)
        if not text:
            return
        source_parts.append(text)
    elif section.content_type == "exercise":
        data = section.exercise_data
        if isinstance(data, dict):
            source_parts.append(json.dumps(data, sort_keys=True, default=str))
    current_hash = _source_hash("|".join(source_parts))

    existing = LessonSectionTranslation.objects.filter(
        section=section, language=LANGUAGE_CODE
    ).first()
    if existing and existing.source_hash == current_hash:
        return

    payload: Dict[str, Any] = {"source_hash": current_hash}
    payload["title"] = translator.translate_text(
        section.title or "", {**base_ctx, "field": "section_title"}
    )

    if section.content_type == "text":
        text = _clean_html(section.text_content)
        payload["text_content"] = translator.translate_text(
            text, {**base_ctx, "field": "section_text_content"}
        )
    elif section.content_type == "exercise" and isinstance(section.exercise_data, dict):
        payload["exercise_data"] = translator.translate_exercise(section.exercise_data, base_ctx)
        payload["text_content"] = None

    with transaction.atomic():
        LessonSectionTranslation.objects.update_or_create(
            section=section,
            language=LANGUAGE_CODE,
            defaults=payload,
        )

# education/tasks.py
from __future__ import annotations

import hashlib
import html
import json
import logging
import re
from datetime import timedelta
from typing import Any, Dict, Optional

from celery import shared_task
from django.conf import settings
from django.contrib.auth.models import User
from django.core.cache import cache
from django.db import transaction
from django.db.models import Max
from django.utils import timezone
from django.utils.html import strip_tags

logger = logging.getLogger(__name__)

LANGUAGE_CODE = "ro"


def _mastery_floor_for_course(user, course) -> int:
    from education.models import UserProgress

    progress = (
        UserProgress.objects.filter(user=user, course=course)
        .prefetch_related("completed_sections", "completed_lessons")
        .first()
    )
    if not progress:
        return 0
    if progress.completed_lessons.exists():
        return 40
    if progress.completed_sections.exists():
        return 20
    return 0


@shared_task
def decay_course_mastery():
    """Apply gentle daily forgetting decay without erasing completed-content floors."""
    from education.models import Mastery
    from notifications.enums import CioEventName
    from notifications.events import NotificationEvents

    now = timezone.now()
    cutoff = now - timedelta(days=7)
    changed = 0
    nudges = 0
    nudge_users: dict[int, dict[str, Any]] = {}
    for mastery in (
        Mastery.objects.filter(course__isnull=False, legacy=False, last_reviewed__lt=cutoff)
        .select_related("user", "course")
        .iterator()
    ):
        idle_days = max(0, (now - mastery.last_reviewed).days - 7)
        if idle_days <= 0:
            continue
        floor = _mastery_floor_for_course(mastery.user, mastery.course)
        decayed = max(floor, int(round(mastery.proficiency - idle_days * 1.5)))
        if decayed >= mastery.proficiency:
            continue
        mastery.proficiency = decayed
        mastery.due_at = now
        mastery.save(update_fields=["proficiency", "due_at"])
        changed += 1
        current = nudge_users.get(mastery.user_id)
        if current is None or decayed < current["proficiency"]:
            nudge_users[mastery.user_id] = {
                "user": mastery.user,
                "skill": mastery.skill,
                "course_id": mastery.course_id,
                "course_title": mastery.course.title if mastery.course else "",
                "proficiency": decayed,
                "idle_days": idle_days,
            }

    if getattr(settings, "CIO_JOURNEY_EVENTS_ENABLED", False):
        publisher = NotificationEvents()
        today = timezone.localdate().isoformat()
        for user_id, payload in nudge_users.items():
            user = payload.pop("user")
            # Coach Nudge is an email-only journey; firing it for a user with no
            # email creates a bare CIO profile whose {{customer.email}} never
            # renders and the transactional send fails+retries. Skip them.
            if not (getattr(user, "email", "") or "").strip():
                continue
            cache_key = f"coach_nudge:{user_id}:{today}"
            if not cache.add(cache_key, True, timeout=90_000):
                continue
            ok, _ = publisher.track(user, CioEventName.COACH_NUDGE, payload, identify_first=True)
            if ok:
                nudges += 1

    return {"changed": changed, "coach_nudges": nudges}


@shared_task
def emit_streak_about_to_expire():
    """
    Daily evening sweep: emit `streak_about_to_expire` for users whose streak
    is at risk (last lesson was yesterday and no activity today). CIO Journey
    picks this up and sends push-first.
    """
    from authentication.models import UserProfile
    from notifications.enums import CioEventName
    from notifications.events import NotificationEvents

    if not getattr(settings, "CIO_JOURNEY_EVENTS_ENABLED", False):
        return {"sent": 0, "reason": "journey_events_disabled"}

    today = timezone.localdate()
    yesterday = today - timedelta(days=1)
    profiles = (
        UserProfile.objects.filter(
            streak__gt=0,
            last_completed_date=yesterday,
        )
        .select_related("user")
        .only("user", "streak", "last_completed_date")
    )
    publisher = NotificationEvents()
    sent = 0
    for profile in profiles.iterator():
        cache_key = f"streak_expire_emit:{profile.user_id}:{today.isoformat()}"
        if not cache.add(cache_key, True, timeout=90_000):
            continue
        ok, _ = publisher.track(
            profile.user,
            CioEventName.STREAK_ABOUT_TO_EXPIRE,
            {"streak_count": int(profile.streak or 0)},
            identify_first=True,
        )
        if ok:
            sent += 1
    logger.info("streak_about_to_expire_emitted count=%s", sent)
    return {"sent": sent}


@shared_task(
    bind=True,
    autoretry_for=(Exception,),
    retry_backoff=60,
    retry_kwargs={"max_retries": 3},
)
def reset_inactive_streaks(self):
    """
    Reset streaks for users who have been inactive for over 24 hours.

    - Checks the last activity date for each user.
    - If a user has been inactive for more than a day, their streak is reset to 0.
    """
    from authentication.models import UserProfile
    from education.models import UserProgress

    users = User.objects.annotate(
        last_active=Max("user_progress__last_course_activity_date")
    ).select_related("profile")

    today = timezone.localdate()
    for user in users:
        if user.last_active:
            days_inactive = (today - user.last_active).days
            if days_inactive > 1:
                profile = getattr(user, "profile", None)
                if not profile:
                    continue
                previous_streak = int(profile.streak or 0)
                UserProgress.objects.filter(user=user).update(learning_session_count=0)
                UserProfile.objects.filter(pk=profile.pk).update(
                    streak=0,
                    last_completed_date=None,
                )
                if previous_streak > 3:
                    from authentication.tasks import send_streak_broken_email
                    from notifications.enums import CioTemplate
                    from notifications.policy import should_send_push
                    from notifications.transactional import TransactionalMessages

                    send_streak_broken_email.delay(user.id, previous_streak)

                    push_policy = should_send_push(user, "transactional")
                    if push_policy.allowed:
                        name = user.first_name or user.username or "there"
                        TransactionalMessages().send_push(
                            CioTemplate.STREAK_BROKEN,
                            user,
                            {
                                "streak_count": previous_streak,
                                "customer_name": name,
                                "body": f"Your {previous_streak}-day streak has ended, {name}. Start a new one today!",
                            },
                        )


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
    elif section.content_type == "video":
        text = _clean_html(section.text_content or "")
        if text:
            source_parts.append(text)
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
    elif section.content_type == "video":
        text = _clean_html(section.text_content or "")
        if text:
            payload["text_content"] = translator.translate_text(
                text, {**base_ctx, "field": "section_text_content"}
            )
        else:
            payload["text_content"] = None
        payload["exercise_data"] = None

    with transaction.atomic():
        LessonSectionTranslation.objects.update_or_create(
            section=section,
            language=LANGUAGE_CODE,
            defaults=payload,
        )


# ---------------------------------------------------------------------------
# Embedding tasks
# ---------------------------------------------------------------------------


@shared_task(bind=True, max_retries=2, default_retry_delay=30)
def embed_lesson_async(self, lesson_id: int) -> None:
    try:
        from education.services.retrieval import index_lesson

        index_lesson(lesson_id)
    except Exception as exc:
        raise self.retry(exc=exc)


@shared_task(bind=True, max_retries=2, default_retry_delay=30)
def embed_course_async(self, course_id: int) -> None:
    try:
        from education.services.retrieval import index_course

        index_course(course_id)
    except Exception as exc:
        raise self.retry(exc=exc)


@shared_task
def backfill_embeddings_async(batch_size: int = 50) -> dict:
    """Run from a management command or periodic task to embed all unindexed content."""
    from education.services.retrieval import backfill_all

    return backfill_all(batch_size=batch_size)

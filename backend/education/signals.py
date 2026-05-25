"""
Post-save signals that enqueue background translation tasks for education content.

Signals are connected in EducationConfig.ready() (see apps.py).
Translation is only enqueued when CONTENT_TRANSLATION_ENABLED is True.
"""

from __future__ import annotations

import logging

from django.conf import settings
from django.db.models.signals import post_save
from django.dispatch import receiver

logger = logging.getLogger(__name__)


def _safe_delay(task_fn, *args, **kwargs) -> None:
    try:
        task_fn.delay(*args, **kwargs)
    except Exception:
        logger.warning(
            "Failed to queue translation task %s — broker may be unavailable.",
            getattr(task_fn, "name", repr(task_fn)),
            exc_info=True,
        )


@receiver(post_save, sender="education.Path")
def enqueue_path_translation(sender, instance, **kwargs):
    if not getattr(settings, "CONTENT_TRANSLATION_ENABLED", False):
        return
    from education.tasks import translate_path_async

    _safe_delay(translate_path_async, instance.pk)


@receiver(post_save, sender="education.Course")
def enqueue_course_translation(sender, instance, **kwargs):
    if not getattr(settings, "CONTENT_TRANSLATION_ENABLED", False):
        return
    from education.tasks import translate_course_async

    _safe_delay(translate_course_async, instance.pk)


@receiver(post_save, sender="education.Lesson")
def enqueue_lesson_translation(sender, instance, **kwargs):
    if not getattr(settings, "CONTENT_TRANSLATION_ENABLED", False):
        return
    from education.tasks import translate_lesson_async

    _safe_delay(translate_lesson_async, instance.pk)


@receiver(post_save, sender="education.LessonSection")
def enqueue_section_translation(sender, instance, **kwargs):
    if not getattr(settings, "CONTENT_TRANSLATION_ENABLED", False):
        return
    from education.tasks import translate_section_async

    _safe_delay(translate_section_async, instance.pk)


# ---------------------------------------------------------------------------
# Embedding signals
# ---------------------------------------------------------------------------


def _should_embed() -> bool:
    return bool(getattr(settings, "OPENAI_API_KEY", ""))


@receiver(post_save, sender="education.Lesson")
def enqueue_lesson_embedding(sender, instance, **kwargs):
    if not _should_embed():
        return
    try:
        from education.tasks import embed_lesson_async

        _safe_delay(embed_lesson_async, instance.pk)
    except Exception:
        logger.debug("embed_lesson_async not available yet")


@receiver(post_save, sender="education.Course")
def enqueue_course_embedding(sender, instance, **kwargs):
    if not _should_embed():
        return
    try:
        from education.tasks import embed_course_async

        _safe_delay(embed_course_async, instance.pk)
    except Exception:
        logger.debug("embed_course_async not available yet")


# ---------------------------------------------------------------------------
# Mastery snapshot — write one row per user/course/day for delta_7d on dashboard
# ---------------------------------------------------------------------------


@receiver(post_save, sender="education.Mastery")
def record_mastery_snapshot(sender, instance, **kwargs):
    from django.utils import timezone

    from education.models import MasterySnapshot

    today = timezone.localdate()
    lookup = {
        "user_id": instance.user_id,
        "recorded_on": today,
    }
    if instance.course_id:
        lookup["course_id"] = instance.course_id
    else:
        lookup["skill"] = instance.skill

    MasterySnapshot.objects.update_or_create(
        **lookup,
        defaults={
            "skill": instance.skill,
            "course_id": instance.course_id,
            "proficiency": instance.proficiency,
        },
    )

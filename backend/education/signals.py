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

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


@receiver(post_save, sender="education.Path")
def enqueue_path_translation(sender, instance, **kwargs):
    if not getattr(settings, "CONTENT_TRANSLATION_ENABLED", False):
        return
    from education.tasks import translate_path_async

    translate_path_async.delay(instance.pk)


@receiver(post_save, sender="education.Course")
def enqueue_course_translation(sender, instance, **kwargs):
    if not getattr(settings, "CONTENT_TRANSLATION_ENABLED", False):
        return
    from education.tasks import translate_course_async

    translate_course_async.delay(instance.pk)


@receiver(post_save, sender="education.Lesson")
def enqueue_lesson_translation(sender, instance, **kwargs):
    if not getattr(settings, "CONTENT_TRANSLATION_ENABLED", False):
        return
    from education.tasks import translate_lesson_async

    translate_lesson_async.delay(instance.pk)


@receiver(post_save, sender="education.LessonSection")
def enqueue_section_translation(sender, instance, **kwargs):
    if not getattr(settings, "CONTENT_TRANSLATION_ENABLED", False):
        return
    from education.tasks import translate_section_async

    translate_section_async.delay(instance.pk)

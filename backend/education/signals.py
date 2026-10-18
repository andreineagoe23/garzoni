"""
Post-save signals that enqueue background translation tasks for education content.

Signals are connected in EducationConfig.ready() (see apps.py).
Translation is only enqueued when CONTENT_TRANSLATION_ENABLED is True.
"""

from __future__ import annotations

import logging

from django.conf import settings
from django.db.models.signals import post_delete, post_save
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
# Hybrid retrieval chunks — rebuilt per lesson when its content changes
# ---------------------------------------------------------------------------

# Content pipelines save a lesson's sections one by one; the countdown lets them land first so
# the later tasks find an unchanged content hash and skip the embedding call.
_CHUNK_REINDEX_DELAY_SECONDS = 30


def _enqueue_chunk_reindex(lesson_id) -> None:
    if not lesson_id or not getattr(settings, "RAG_HYBRID_ENABLED", False):
        return
    try:
        from education.tasks import index_lesson_chunks_async

        index_lesson_chunks_async.apply_async(
            args=[lesson_id], countdown=_CHUNK_REINDEX_DELAY_SECONDS
        )
    except Exception:
        logger.warning("Failed to queue chunk reindex for lesson %s", lesson_id, exc_info=True)


@receiver(post_save, sender="education.Lesson")
@receiver(post_delete, sender="education.Lesson")
def reindex_chunks_for_lesson(sender, instance, **kwargs):
    _enqueue_chunk_reindex(instance.pk)


@receiver(post_save, sender="education.LessonSection")
@receiver(post_delete, sender="education.LessonSection")
def reindex_chunks_for_section(sender, instance, **kwargs):
    _enqueue_chunk_reindex(instance.lesson_id)


@receiver(post_save, sender="education.LessonTranslation")
def reindex_chunks_for_lesson_translation(sender, instance, **kwargs):
    if instance.language == "en":
        _enqueue_chunk_reindex(instance.lesson_id)


@receiver(post_save, sender="education.LessonSectionTranslation")
def reindex_chunks_for_section_translation(sender, instance, **kwargs):
    if instance.language == "en":
        _enqueue_chunk_reindex(getattr(instance.section, "lesson_id", None))


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

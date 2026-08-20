import logging

from django.contrib.auth.models import User
from django.db.models.signals import post_delete, post_save
from django.dispatch import receiver
from django.utils import timezone

from gamification.models import Mission, MultiStepMission, MultiStepMissionProgress
from gamification.services.mission_cycles import (
    get_or_create_current_mission_completion,
    invalidate_mission_pool_cache,
)

logger = logging.getLogger(__name__)


@receiver(post_save, sender=Mission)
@receiver(post_delete, sender=Mission)
def invalidate_pool_on_mission_change(sender, **kwargs):
    """Keep the cached per-type mission pool fresh for admin edits and
    content loads (lazy assignment selects picks from this cache)."""
    invalidate_mission_pool_cache()


@receiver(post_save, sender=User)
def assign_missions_to_new_user(sender, instance, created, **kwargs):
    """Eager-mode only: pre-create a completion row per pool mission.

    Under MISSIONS_LAZY_ASSIGNMENT the per-cycle picks are computed and rows
    materialize on first touch, so new users need no rows at all."""
    from django.conf import settings

    if not created or getattr(settings, "MISSIONS_LAZY_ASSIGNMENT", False):
        return
    for mission_type in ("daily", "weekly"):
        missions = Mission.objects.filter(mission_type=mission_type)
        for mission in missions:
            get_or_create_current_mission_completion(
                instance,
                mission,
                defaults={"progress": 0, "status": "not_started"},
            )


def _matches_topic(text: str | None, topic: str | None) -> bool:
    if not text or not topic:
        return False
    return topic.lower() in text.lower()


def _advance_multistep_missions(user, event_type: str, **context):
    if not user:
        return
    for mission in MultiStepMission.objects.filter(is_active=True):
        steps = mission.steps or []
        for step in steps:
            if step.get("type") != event_type:
                continue
            step_id = step.get("id")
            if not step_id:
                continue
            if event_type == "lesson":
                course_topic = step.get("course_topic")
                course_title = context.get("course_title")
                lesson_id = step.get("lesson_id")
                if lesson_id and lesson_id != context.get("lesson_id"):
                    continue
                if course_topic and not _matches_topic(course_title, course_topic):
                    continue
            elif event_type == "exercise":
                expected = step.get("exercise_category")
                actual = context.get("exercise_category")
                if expected and not _matches_topic(actual, expected):
                    continue
            elif event_type == "tool":
                expected_tool = step.get("tool_slug")
                if expected_tool and expected_tool != context.get("tool_slug"):
                    continue
            progress, _ = MultiStepMissionProgress.objects.get_or_create(
                user=user,
                mission=mission,
            )
            progress.mark_step_complete(step_id)


try:
    from education.models import ExerciseCompletion, LessonCompletion
    from finance.models import FunnelEvent
except Exception:  # pragma: no cover - app registry/import edge during setup
    ExerciseCompletion = None
    LessonCompletion = None
    FunnelEvent = None


def _emit_lesson_completed(user, lesson, course) -> None:
    """Publish `lesson_completed` to Customer.io. Best-effort, never raises —
    a messaging failure must not break the lesson the user just finished."""
    from django.conf import settings as dj_settings

    if not getattr(dj_settings, "CIO_JOURNEY_EVENTS_ENABLED", False):
        return
    try:
        from notifications.enums import CioEventName
        from notifications.events import NotificationEvents

        NotificationEvents().track(
            user,
            CioEventName.LESSON_COMPLETED,
            {
                "lesson_id": getattr(lesson, "id", None),
                "lesson_title": getattr(lesson, "title", "") or "",
                "course_id": getattr(course, "id", None),
                "course_title": getattr(course, "title", "") or "",
            },
        )
    except Exception:
        logger.warning("lesson_completed CIO publish failed user_id=%s", user.id, exc_info=True)


if LessonCompletion is not None:

    @receiver(post_save, sender=LessonCompletion)
    def advance_multistep_lesson(sender, instance, created, **kwargs):
        if not created:
            return
        lesson = instance.lesson
        course = getattr(lesson, "course", None)
        user = instance.user_progress.user
        _advance_multistep_missions(
            user,
            "lesson",
            lesson_id=lesson.id,
            course_id=getattr(course, "id", None),
            course_title=getattr(course, "title", None),
        )
        # `lesson_completed` is the conversion event every retention journey is
        # scored on, and the exit condition that stops a comeback sequence the
        # moment it works. Emitted here rather than from the mobile SDK so web
        # counts identically — the client-side copy never reached the workspace.
        _emit_lesson_completed(user, lesson, course)
        # Refresh the `lessons_completed` trait on first lesson — the Welcome
        # journey's day-7 branch needs it. Subsequent lessons can wait for the
        # next regular identify; avoid hammering CIO per lesson.
        try:
            if LessonCompletion.objects.filter(user_progress__user=user).count() == 1:
                from authentication.services.profile_analytics import mark_first_lesson
                from notifications.tasks import safe_enqueue_sync_user_to_customer_io

                mark_first_lesson(user, when=timezone.now())
                safe_enqueue_sync_user_to_customer_io(user.id)
        except Exception:
            # Best-effort CIO trait refresh — first-lesson sync can be retried later.
            logger.debug("first_lesson CIO sync failed for user_id=%s", user.id, exc_info=True)


if ExerciseCompletion is not None:

    @receiver(post_save, sender=ExerciseCompletion)
    def advance_multistep_exercise(sender, instance, created, **kwargs):
        if not created:
            return
        _advance_multistep_missions(
            instance.user,
            "exercise",
            exercise_id=instance.exercise_id,
            exercise_category=getattr(instance.exercise, "category", None),
        )


if FunnelEvent is not None:

    @receiver(post_save, sender=FunnelEvent)
    def advance_multistep_tool(sender, instance, created, **kwargs):
        if not created or instance.event_type not in {"tool_open", "tool_opened"}:
            return
        metadata = instance.metadata or {}
        _advance_multistep_missions(
            instance.user,
            "tool",
            tool_slug=metadata.get("tool_slug"),
        )

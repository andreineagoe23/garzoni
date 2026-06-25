"""Deduplicate UserProgress rows and enforce one row per (user, course).

`UserProgress` only had a non-unique index on (user, course), so concurrent
`get_or_create` calls could create duplicate rows for the same learner+course.
This migration merges any existing duplicates (repointing their lesson/section
completions onto a single keeper) and then adds a partial unique constraint.

The constraint excludes NULL users so rows orphaned by account deletion
(`user` FK is `SET_NULL`) remain valid.
"""

from django.db import migrations, models
from django.db.models import Count


def merge_duplicate_progress(apps, schema_editor):
    UserProgress = apps.get_model("education", "UserProgress")
    LessonCompletion = apps.get_model("education", "LessonCompletion")
    SectionCompletion = apps.get_model("education", "SectionCompletion")

    dupe_keys = (
        UserProgress.objects.filter(user__isnull=False)
        .values("user_id", "course_id")
        .annotate(n=Count("id"))
        .filter(n__gt=1)
    )

    for key in dupe_keys:
        rows = list(
            UserProgress.objects.filter(
                user_id=key["user_id"], course_id=key["course_id"]
            ).order_by("id")
        )
        # Keeper: prefer a completed row, then the most recent activity, then lowest pk.
        keeper = max(
            rows,
            key=lambda r: (
                bool(r.is_course_complete),
                r.last_course_activity_date or r.flow_updated_at.date(),
                -r.id,
            ),
        )
        losers = [r for r in rows if r.id != keeper.id]

        kept_lessons = set(
            LessonCompletion.objects.filter(user_progress=keeper).values_list(
                "lesson_id", flat=True
            )
        )
        kept_sections = set(
            SectionCompletion.objects.filter(user_progress=keeper).values_list(
                "section_id", flat=True
            )
        )

        for loser in losers:
            for lc in LessonCompletion.objects.filter(user_progress=loser):
                if lc.lesson_id in kept_lessons:
                    lc.delete()
                else:
                    lc.user_progress = keeper
                    lc.save(update_fields=["user_progress"])
                    kept_lessons.add(lc.lesson_id)
            for sc in SectionCompletion.objects.filter(user_progress=loser):
                if sc.section_id in kept_sections:
                    sc.delete()
                else:
                    sc.user_progress = keeper
                    sc.save(update_fields=["user_progress"])
                    kept_sections.add(sc.section_id)

            # Fold scalar signals onto the keeper so we don't lose engagement data.
            keeper.is_course_complete = keeper.is_course_complete or loser.is_course_complete
            keeper.is_questionnaire_completed = (
                keeper.is_questionnaire_completed or loser.is_questionnaire_completed
            )
            keeper.learning_session_count = max(
                keeper.learning_session_count, loser.learning_session_count
            )
            if loser.last_course_activity_date and (
                not keeper.last_course_activity_date
                or loser.last_course_activity_date > keeper.last_course_activity_date
            ):
                keeper.last_course_activity_date = loser.last_course_activity_date
            if loser.course_completed_at and not keeper.course_completed_at:
                keeper.course_completed_at = loser.course_completed_at
            keeper.flow_current_index = max(
                keeper.flow_current_index, loser.flow_current_index
            )

        keeper.save()
        for loser in losers:
            loser.delete()


def noop(apps, schema_editor):
    # Constraint removal is handled by the schema operation; merges aren't reversible.
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("education", "0041_expand_exercise_types"),
    ]

    operations = [
        migrations.RunPython(merge_duplicate_progress, noop),
        migrations.AddConstraint(
            model_name="userprogress",
            constraint=models.UniqueConstraint(
                condition=models.Q(("user__isnull", False)),
                fields=("user", "course"),
                name="uniq_userprogress_user_course",
            ),
        ),
    ]

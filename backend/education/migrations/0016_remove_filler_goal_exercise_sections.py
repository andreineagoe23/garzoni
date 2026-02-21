# One-time data migration: remove generic filler exercise sections from lessons.
# These are auto-generated "goal recap" / "first practical step" exercises that were
# replaced by proper content. Run once per deployment; idempotent (no-op if already removed).

from django.db import migrations, transaction
from django.db.models import F


def is_filler_goal_exercise(question):
    if not question:
        return False
    q = (question or "").strip()
    if q.startswith("What's the first practical step to apply "):
        return True
    if "best captures the goal of " in q:
        return True
    if "best reflects the main goal of " in q:
        return True
    if "goal of '" in q and "Lesson" in q:
        return True
    return False


def remove_filler_sections(apps, schema_editor):
    LessonSection = apps.get_model("education", "LessonSection")
    candidates = LessonSection.objects.filter(
        content_type="exercise",
        exercise_data__isnull=False,
    )
    to_remove = []
    for section in candidates:
        data = section.exercise_data or {}
        question = data.get("question") or ""
        if is_filler_goal_exercise(question):
            to_remove.append(section)

    if not to_remove:
        return

    to_remove_sorted = sorted(to_remove, key=lambda s: (s.lesson_id, -s.order))
    with transaction.atomic():
        for section in to_remove_sorted:
            lesson_id = section.lesson_id
            order = section.order
            section.delete()
            LessonSection.objects.filter(
                lesson_id=lesson_id,
                order__gt=order,
            ).update(order=F("order") - 1)


def noop(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("education", "0015_alter_path_options"),
    ]

    operations = [
        migrations.RunPython(remove_filler_sections, noop),
    ]

# Remove filler exercise sections that were missed because the filler question
# exists only in LessonSectionTranslation.exercise_data (API returns translation overlay).

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


def get_question_from_data(data):
    if not data or not isinstance(data, dict):
        return ""
    return (data.get("question") or "").strip()


def remove_filler_sections(apps, schema_editor):
    LessonSection = apps.get_model("education", "LessonSection")
    LessonSectionTranslation = apps.get_model("education", "LessonSectionTranslation")

    candidates = LessonSection.objects.filter(content_type="exercise")
    to_remove = []

    for section in candidates:
        question = get_question_from_data(section.exercise_data)
        if is_filler_goal_exercise(question):
            to_remove.append(section)
            continue
        for trans in LessonSectionTranslation.objects.filter(section=section):
            question = get_question_from_data(trans.exercise_data)
            if is_filler_goal_exercise(question):
                to_remove.append(section)
                break

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
        ("education", "0016_remove_filler_goal_exercise_sections"),
    ]

    operations = [
        migrations.RunPython(remove_filler_sections, noop),
    ]

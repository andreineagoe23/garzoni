# Final sweep: remove ANY remaining section whose question (in base or any translation)
# contains "best reflects" + "main goal" (e.g. "Which option best reflects the main goal of 'Lesson X'?").
# Handles all languages and encodings; runs after previous removals.

from django.db import migrations, transaction
from django.db.models import F


def normalize(s):
    if not s:
        return ""
    s = (s or "").strip().lower()
    for old, new in [("\u2018", "'"), ("\u2019", "'"), ("\u201c", '"'), ("\u201d", '"')]:
        s = s.replace(old, new)
    return s


def is_best_reflects_filler(question):
    q = normalize(question)
    if not q:
        return False
    return "best reflects" in q and "main goal" in q


def get_question_from_data(data):
    if not data or not isinstance(data, dict):
        return ""
    return (data.get("question") or "").strip()


def remove_remaining_filler_sections(apps, schema_editor):
    LessonSection = apps.get_model("education", "LessonSection")
    LessonSectionTranslation = apps.get_model("education", "LessonSectionTranslation")

    candidates = list(LessonSection.objects.filter(content_type="exercise"))
    to_remove_ids = set()

    for section in candidates:
        question = get_question_from_data(section.exercise_data)
        if is_best_reflects_filler(question):
            to_remove_ids.add(section.id)
            continue
        for trans in LessonSectionTranslation.objects.filter(section=section):
            question = get_question_from_data(trans.exercise_data)
            if is_best_reflects_filler(question):
                to_remove_ids.add(section.id)
                break

    if not to_remove_ids:
        return

    to_remove = [
        s
        for s in sorted(candidates, key=lambda s: (s.lesson_id, -s.order))
        if s.id in to_remove_ids
    ]

    with transaction.atomic():
        for section in to_remove:
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
        ("education", "0020_replace_allocation_filler_with_apply_exercise"),
    ]

    operations = [
        migrations.RunPython(remove_remaining_filler_sections, noop),
    ]

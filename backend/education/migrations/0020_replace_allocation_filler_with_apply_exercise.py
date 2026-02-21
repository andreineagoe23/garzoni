# Replace "Allocate your £1000 across Needs, Wants, and Savings" sections with a
# simple "apply what you learned" multiple-choice so there are no empty slots.

from django.db import migrations, transaction


def normalize(s):
    if not s:
        return ""
    return (s or "").strip().lower()


def is_allocation_filler(question):
    q = normalize(question)
    if not q:
        return False
    return "allocate your" in q and "needs" in q and "wants" in q and "savings" in q


def get_question_from_data(data):
    if not data or not isinstance(data, dict):
        return ""
    return (data.get("question") or "").strip()


# Replacement exercise: one simple multiple-choice (same for all replaced sections).
REPLACEMENT_EXERCISE = {
    "question": "What's one way to use what you learned in this lesson?",
    "options": [
        "Pick one action from the lesson to try this week",
        "Ignore it and move on",
        "Only reread the material",
        "Wait for someone to remind you",
    ],
    "correctAnswer": 0,
    "explanation": "Applying one concrete step helps you remember and build the habit.",
    "prompt": "Choose the option that best describes how you'll use this lesson.",
}


def replace_allocation_sections(apps, schema_editor):
    LessonSection = apps.get_model("education", "LessonSection")
    LessonSectionTranslation = apps.get_model("education", "LessonSectionTranslation")

    candidates = list(LessonSection.objects.filter(content_type="exercise"))
    to_replace_ids = set()

    for section in candidates:
        question = get_question_from_data(section.exercise_data)
        if is_allocation_filler(question):
            to_replace_ids.add(section.id)
            continue
        for trans in LessonSectionTranslation.objects.filter(section=section):
            question = get_question_from_data(trans.exercise_data)
            if is_allocation_filler(question):
                to_replace_ids.add(section.id)
                break

    if not to_replace_ids:
        return

    with transaction.atomic():
        for section in LessonSection.objects.filter(id__in=to_replace_ids):
            section.exercise_type = "multiple-choice"
            section.exercise_data = REPLACEMENT_EXERCISE
            section.save(update_fields=["exercise_type", "exercise_data"])
        for trans in LessonSectionTranslation.objects.filter(section_id__in=to_replace_ids):
            trans.exercise_data = REPLACEMENT_EXERCISE
            trans.save(update_fields=["exercise_data"])


def noop(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("education", "0019_remove_main_takeaway_filler_sections"),
    ]

    operations = [
        migrations.RunPython(replace_allocation_sections, noop),
    ]

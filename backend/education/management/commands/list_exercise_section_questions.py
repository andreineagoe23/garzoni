# One-off helper: list all lesson-section exercise questions (for debugging filler content).
# Run: python manage.py list_exercise_section_questions
# Remove this file once you've confirmed filler sections are gone.

from django.core.management.base import BaseCommand

from education.models import LessonSection, LessonSectionTranslation


def get_questions(section):
    out = []
    data = section.exercise_data or {}
    q = (data.get("question") or "").strip()
    if q:
        out.append(("base", q))
    for t in LessonSectionTranslation.objects.filter(section=section):
        data = t.exercise_data or {}
        q = (data.get("question") or "").strip()
        if q:
            out.append((f"trans({t.language})", q))
    return out


class Command(BaseCommand):
    help = "List question text for all exercise sections (to verify filler removal)."

    def handle(self, *args, **options):
        sections = LessonSection.objects.filter(content_type="exercise").select_related("lesson")
        for s in sections:
            for source, question in get_questions(s):
                self.stdout.write(
                    f"id={s.id} lesson_id={s.lesson_id} order={s.order} [{source}] "
                    f"{question[:80]}..."
                )
        self.stdout.write(self.style.SUCCESS(f"Total exercise sections: {sections.count()}"))

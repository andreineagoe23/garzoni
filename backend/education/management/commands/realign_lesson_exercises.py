from django.core.management.base import BaseCommand
from django.utils.html import strip_tags
from django.utils.text import Truncator

from education.models import LessonSection, LessonSectionTranslation


def normalize_whitespace(text: str) -> str:
    return " ".join((text or "").split()).strip()


def first_sentence(text: str, max_chars: int = 120) -> str:
    """One sentence from plain text, capped at max_chars."""
    text = normalize_whitespace(text)
    if not text:
        return ""
    if len(text) <= max_chars:
        return text
    chunk = text[: max_chars + 1].rstrip()
    last_stop = max(
        (i + 1 for i, c in enumerate(chunk) if c in ".!?"),
        default=0,
    )
    if last_stop > 0:
        return chunk[:last_stop].strip()
    return Truncator(text).chars(max_chars)


def build_exercise_payload(lesson, section_order: int) -> dict:
    """Build content-based question and options from lesson content (no generic decision-quality framing)."""
    raw = (
        (lesson.short_description or "")
        or strip_tags(lesson.detailed_content or "")
        or lesson.title
    )
    takeaway = first_sentence(normalize_whitespace(raw)) or f"Key ideas from {lesson.title}."
    variant = 2 if section_order >= 6 else 1

    if variant == 1:
        return {
            "question": f"Review: {lesson.title}",
            "options": [
                takeaway,
                "Placeholder – run import_lesson_exercises to populate.",
                "Option C",
                "Option D",
            ],
            "correctAnswer": 0,
        }
    return {
        "question": f"Applied check: {lesson.title}",
        "options": [
            takeaway,
            "Placeholder – run import_lesson_exercises to populate.",
            "Option C",
            "Option D",
        ],
        "correctAnswer": 0,
    }


class Command(BaseCommand):
    help = "Rewrite lesson exercise questions/options so they align with each lesson title."

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Show what would be updated without saving changes.",
        )

    def handle(self, *args, **options):
        dry_run = options["dry_run"]
        sections = (
            LessonSection.objects.select_related("lesson")
            .filter(content_type="exercise")
            .order_by("lesson_id", "order")
        )

        updated = 0
        for section in sections:
            lesson = section.lesson
            if not lesson:
                continue

            payload = build_exercise_payload(lesson, section.order)

            if dry_run:
                self.stdout.write(
                    f"Would update section {section.id} ({lesson.title}): {payload['question'][:80]}..."
                )
            else:
                section.exercise_data = {**(section.exercise_data or {}), **payload}
                section.save(update_fields=["exercise_data"])
                for trans in LessonSectionTranslation.objects.filter(section_id=section.id):
                    trans.exercise_data = {**(trans.exercise_data or {}), **payload}
                    trans.save(update_fields=["exercise_data"])
            updated += 1

        if dry_run:
            self.stdout.write(self.style.SUCCESS(f"Would update {updated} exercise sections."))
        else:
            self.stdout.write(self.style.SUCCESS(f"Updated {updated} exercise sections."))

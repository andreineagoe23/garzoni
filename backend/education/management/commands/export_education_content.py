"""
Export education content (paths, courses, lessons, sections, translations,
quizzes, exercises) as a JSON fixture that can be safely imported into
another database without touching user data.

Usage:
    python manage.py export_education_content
    python manage.py export_education_content -o content_snapshot.json
    python manage.py export_education_content --exclude-translations
"""

from django.core.management import call_command
from django.core.management.base import BaseCommand

CONTENT_MODELS = [
    "education.Path",
    "education.Course",
    "education.Lesson",
    "education.LessonSection",
    "education.PathTranslation",
    "education.CourseTranslation",
    "education.LessonTranslation",
    "education.LessonSectionTranslation",
    "education.Quiz",
    "education.QuizTranslation",
    "education.Exercise",
    "education.ExerciseTranslation",
    "education.MultipleChoiceChoice",
    "education.ContentReleaseState",
]

TRANSLATION_MODELS = {
    "education.PathTranslation",
    "education.CourseTranslation",
    "education.LessonTranslation",
    "education.LessonSectionTranslation",
    "education.QuizTranslation",
    "education.ExerciseTranslation",
}


class Command(BaseCommand):
    help = (
        "Export education content to a JSON fixture (no user data). "
        "Safe to import into production with import_education_content."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "-o",
            "--output",
            default="education_content.json",
            help="Output JSON file path (default: education_content.json)",
        )
        parser.add_argument(
            "--exclude-translations",
            action="store_true",
            help="Exclude all translation models from the export.",
        )

    def handle(self, *args, **options):
        output = options["output"]
        models = list(CONTENT_MODELS)

        if options["exclude_translations"]:
            models = [m for m in models if m not in TRANSLATION_MODELS]

        self.stdout.write(f"Exporting {len(models)} content model(s) to {output} ...")
        for m in models:
            self.stdout.write(f"  - {m}")

        call_command(
            "dumpdata",
            *models,
            "--indent",
            "2",
            "--output",
            output,
        )

        self.stdout.write(self.style.SUCCESS(f"Content exported to {output}"))

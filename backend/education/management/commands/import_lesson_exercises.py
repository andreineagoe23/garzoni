"""
Import exercises from exercises.json into LessonSection exercise slots.

Maps knowledge_check → section order 3, applied_exercise → section order 6.

Run with:
  python manage.py import_lesson_exercises
  python manage.py import_lesson_exercises --dry-run
  python manage.py import_lesson_exercises --path education/content/exercises.json
"""

import json
import re
from pathlib import Path

from django.core.management.base import BaseCommand
from django.db import transaction

from education.models import Lesson, LessonSectionTranslation

EXERCISE_TYPE_TO_ORDER = {
    "knowledge_check": 3,
    "applied_exercise": 6,
}


class Command(BaseCommand):
    help = "Import exercises from JSON into LessonSection exercise slots (order 3 and 6)."

    def add_arguments(self, parser):
        parser.add_argument(
            "--path",
            type=str,
            default="education/content/exercises.json",
            help="Path to exercises JSON file.",
        )
        parser.add_argument("--dry-run", action="store_true")

    def handle(self, *args, **options):
        json_path = Path(options["path"]).resolve()
        dry_run = options["dry_run"]

        if not json_path.exists():
            self.stderr.write(self.style.ERROR(f"File not found: {json_path}"))
            return

        with open(json_path, "r", encoding="utf-8") as f:
            data = json.load(f)

        lessons_data = data.get("lessons", [])
        self.stdout.write(f"Found {len(lessons_data)} lessons in JSON.")

        if dry_run:
            self.stdout.write("DRY RUN - no changes will be saved.")

        updated_sections = 0
        matched_lessons = 0
        not_found = []

        for entry in lessons_data:
            lesson_title = entry["lesson_title"]
            course_title = entry["course_title"]

            lesson = Lesson.objects.filter(
                course__title=course_title,
                title=lesson_title,
            ).first()

            if not lesson:
                not_found.append(f"{course_title} / {lesson_title}")
                continue

            matched_lessons += 1

            with transaction.atomic():
                for exercise in entry.get("exercises", []):
                    ex_type = exercise["exercise_type"]
                    order = EXERCISE_TYPE_TO_ORDER.get(ex_type)
                    if order is None:
                        self.stderr.write(
                            self.style.WARNING(
                                f"  Unknown exercise_type '{ex_type}' for {lesson_title}"
                            )
                        )
                        continue

                    section = lesson.sections.filter(order=order).first()
                    if not section:
                        self.stderr.write(
                            self.style.WARNING(f"  No section order={order} for {lesson_title}")
                        )
                        continue

                    raw_options = exercise["options"]
                    cleaned_options = [re.sub(r"^[A-D]\s+", "", opt).strip() for opt in raw_options]

                    exercise_data = {
                        "question": exercise["question"],
                        "options": cleaned_options,
                        "correctAnswer": exercise["correct_answer_index"],
                        "explanation": exercise["explanation"],
                        "difficulty": exercise["difficulty"],
                    }

                    if not dry_run:
                        section.content_type = "exercise"
                        section.exercise_type = "multiple-choice"
                        section.exercise_data = exercise_data
                        section.save(
                            update_fields=[
                                "content_type",
                                "exercise_type",
                                "exercise_data",
                            ]
                        )
                        LessonSectionTranslation.objects.filter(section=section).update(
                            exercise_data=exercise_data
                        )

                    updated_sections += 1
                    self.stdout.write(
                        self.style.SUCCESS(
                            f"  {'Would update' if dry_run else 'Updated'}: "
                            f"{lesson_title} → section {order} ({ex_type})"
                        )
                    )

        self.stdout.write("")
        self.stdout.write(
            self.style.SUCCESS(
                f"{'Would update' if dry_run else 'Updated'} {updated_sections} "
                f"exercise sections across {matched_lessons} lessons."
            )
        )

        if not_found:
            self.stdout.write("")
            self.stderr.write(self.style.WARNING(f"{len(not_found)} lesson(s) not found in DB:"))
            for nf in not_found:
                self.stderr.write(f"  - {nf}")

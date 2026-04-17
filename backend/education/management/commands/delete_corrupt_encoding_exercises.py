"""
Delete exercises whose question text contains mojibake encoding corruption (e.g. Â£ instead of £).

Dry-run (safe, default):
  docker compose exec backend python manage.py delete_corrupt_encoding_exercises

Apply:
  docker compose exec backend python manage.py delete_corrupt_encoding_exercises --apply
"""

from __future__ import annotations

from django.core.management.base import BaseCommand
from django.db import transaction

from education.models import Exercise

CORRUPT_MARKER = "Â£"


class Command(BaseCommand):
    help = "Delete exercises with mojibake encoding corruption in question text (Â£ etc.)"

    def add_arguments(self, parser):
        parser.add_argument(
            "--apply",
            action="store_true",
            help="Actually delete the exercises (default is dry-run)",
        )

    def handle(self, *args, **options):
        apply_changes: bool = options["apply"]

        qs = Exercise.objects.filter(question__contains=CORRUPT_MARKER).order_by("id")
        exercises = list(
            qs.values("id", "type", "category", "difficulty", "question", "created_at")
        )

        if not exercises:
            self.stdout.write(self.style.SUCCESS("No corrupt exercises found."))
            return

        self.stdout.write(
            self.style.WARNING(
                f"Found {len(exercises)} exercises with '{CORRUPT_MARKER}' in question:\n"
            )
        )
        for ex in exercises:
            preview = (ex["question"] or "")[:120].replace("\n", " ")
            self.stdout.write(
                f"  id={ex['id']} type={ex['type']} cat={ex['category']!r} "
                f"diff={ex['difficulty']} created={ex['created_at']}  |  {preview!r}"
            )

        if not apply_changes:
            self.stdout.write(
                self.style.NOTICE(
                    f"\nDry-run: {len(exercises)} exercises would be deleted "
                    f"(plus cascaded UserExerciseProgress, ExerciseCompletion, ExerciseTranslation).\n"
                    "Re-run with --apply to delete."
                )
            )
            return

        ids = [ex["id"] for ex in exercises]
        with transaction.atomic():
            deleted, breakdown = Exercise.objects.filter(id__in=ids).delete()

        self.stdout.write(self.style.SUCCESS(f"Deleted {deleted} rows: {breakdown}"))

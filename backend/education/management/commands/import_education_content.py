"""
Import education content from a JSON fixture exported by export_education_content.

This command loads content safely into the target database:
  - Updates existing records by PK (update_or_create semantics via loaddata)
  - Inserts new records
  - NEVER flushes user data (progress, accounts, streaks, completions)

The target database is whichever DATABASE_URL the Django process is connected to
(local Docker, Railway, etc.).

Usage:
    python manage.py import_education_content education_content.json
    python manage.py import_education_content education_content.json --dry-run
"""

import json
from pathlib import Path

from django.core.management import call_command
from django.core.management.base import BaseCommand, CommandError
from django.db import connection


class Command(BaseCommand):
    help = (
        "Import education content from a JSON fixture into the current database. "
        "User data is never touched. Uses Django's loaddata (upsert by PK)."
    )

    SAFE_APP_LABELS = {"education"}
    SAFE_MODELS = {
        "education.path",
        "education.course",
        "education.lesson",
        "education.lessonsection",
        "education.pathtranslation",
        "education.coursetranslation",
        "education.lessontranslation",
        "education.lessonsectiontranslation",
        "education.quiz",
        "education.quiztranslation",
        "education.exercise",
        "education.exercisetranslation",
        "education.multiplechoicechoice",
        "education.contentreleasestate",
    }
    BLOCKED_MODELS = {
        "education.userprogress",
        "education.lessoncompletion",
        "education.sectioncompletion",
        "education.userexerciseprogress",
        "education.exercisecompletion",
        "education.questionnaire",
        "education.userresponse",
        "education.pollresponse",
        "education.mastery",
    }

    def add_arguments(self, parser):
        parser.add_argument(
            "fixture",
            help="Path to the JSON fixture file.",
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Validate and preview the fixture without writing to the database.",
        )

    def handle(self, *args, **options):
        fixture_path = Path(options["fixture"])
        dry_run = options["dry_run"]

        if not fixture_path.exists():
            raise CommandError(f"Fixture not found: {fixture_path}")

        data = json.loads(fixture_path.read_text())
        if not isinstance(data, list):
            raise CommandError("Fixture must be a JSON array of serialized objects.")

        model_counts = {}
        for obj in data:
            model = obj.get("model", "").lower()
            if model in self.BLOCKED_MODELS:
                raise CommandError(
                    f"Fixture contains blocked user-data model: {model}. "
                    f"This fixture was not produced by export_education_content."
                )
            app_label = model.split(".")[0] if "." in model else ""
            if app_label not in self.SAFE_APP_LABELS:
                raise CommandError(
                    f"Fixture contains model outside education app: {model}. Aborting."
                )
            if model not in self.SAFE_MODELS:
                raise CommandError(
                    f"Fixture contains unexpected education model: {model}. "
                    f"Add it to SAFE_MODELS if intentional."
                )
            model_counts[model] = model_counts.get(model, 0) + 1

        self.stdout.write(f"Fixture: {fixture_path} ({len(data)} objects)")
        for model, count in sorted(model_counts.items()):
            self.stdout.write(f"  {model}: {count}")

        db = connection.settings_dict
        db_host = db.get("HOST", "localhost")
        db_name = db.get("NAME", "?")
        self.stdout.write(f"\nTarget DB: {db_host} / {db_name}")

        if dry_run:
            self.stdout.write(
                self.style.NOTICE("\nDRY RUN — fixture is valid. No changes written.")
            )
            return

        self.stdout.write("\nLoading fixture (this may take a moment) ...")
        call_command("loaddata", str(fixture_path))
        self.stdout.write(self.style.SUCCESS(f"Successfully imported {len(data)} content objects."))

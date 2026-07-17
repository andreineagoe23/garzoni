"""Apply hand-authored guest-taste sample questions from a JSON file (plan §3.1).

This command does NOTHING automatically — it only applies a mapping the content
team authors later. Pass a JSON file whose keys are lesson slugs or numeric ids
and whose values are sample_question objects:

    {
      "what-is-a-budget": {
        "question": "What is a budget?",
        "options": ["A spending plan", "A loan", "A tax", "A stock"],
        "correct_index": 0,
        "explanation": "A budget is simply a plan for your money."
      },
      "42": { ... }
    }

Usage:
    python manage.py seed_sample_questions path/to/questions.json --dry-run
    python manage.py seed_sample_questions path/to/questions.json
    python manage.py seed_sample_questions path/to/questions.json --overwrite

By default only *public* lessons *without* an existing sample_question are
updated; pass --overwrite to replace ones that already have a teaser.
"""

import json

from django.core.management.base import BaseCommand, CommandError

from education.models import Lesson, validate_sample_question


class Command(BaseCommand):
    help = "Apply hand-authored sample questions to public lessons from a JSON file."

    def add_arguments(self, parser):
        parser.add_argument("json_path", help="Path to the slug/id -> sample_question JSON file.")
        parser.add_argument(
            "--overwrite",
            action="store_true",
            help="Replace sample questions on lessons that already have one.",
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Report what would change without writing to the database.",
        )

    def handle(self, *args, **options):
        json_path = options["json_path"]
        overwrite = options["overwrite"]
        dry_run = options["dry_run"]

        try:
            with open(json_path, encoding="utf-8") as fh:
                mapping = json.load(fh)
        except (OSError, ValueError) as exc:
            raise CommandError(f"Could not read JSON file {json_path!r}: {exc}")

        if not isinstance(mapping, dict):
            raise CommandError("JSON root must be an object mapping slug/id -> sample_question.")

        updated = skipped = missing = invalid = 0
        for key, sample_question in mapping.items():
            lesson = self._resolve_lesson(key)
            if lesson is None:
                self.stderr.write(f"  no public lesson for key {key!r}")
                missing += 1
                continue

            try:
                validate_sample_question(sample_question)
            except Exception as exc:  # ValidationError et al.
                self.stderr.write(f"  invalid sample_question for {key!r}: {exc}")
                invalid += 1
                continue

            if lesson.sample_question and not overwrite:
                skipped += 1
                continue

            self.stdout.write(
                f"  {'would set' if dry_run else 'set'} sample_question on {lesson.slug}"
            )
            if not dry_run:
                lesson.sample_question = sample_question
                lesson.save(update_fields=["sample_question"])
            updated += 1

        self.stdout.write(
            self.style.SUCCESS(
                f"Done. updated={updated} skipped_existing={skipped} "
                f"missing={missing} invalid={invalid} dry_run={dry_run}"
            )
        )

    @staticmethod
    def _resolve_lesson(key):
        """Resolve a mapping key (numeric id or slug) to a public Lesson."""
        key = str(key).strip()
        qs = Lesson.objects.filter(is_public=True)
        if key.isdigit():
            return qs.filter(pk=int(key)).first()
        return qs.filter(slug=key).first()

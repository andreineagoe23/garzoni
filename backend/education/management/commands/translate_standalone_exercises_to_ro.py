"""
Translate published standalone ``Exercise`` rows to Romanian via ``ExerciseTranslation``.

Only processes multiple-choice style payloads that have ``question`` + ``options`` (same
shape as ``translate_exercise`` in ``education.services.translation``).

Usage:
    docker compose exec backend python manage.py translate_standalone_exercises_to_ro
    docker compose exec backend python manage.py translate_standalone_exercises_to_ro --dry-run
    docker compose exec backend python manage.py translate_standalone_exercises_to_ro --only-missing --limit 20
"""

from __future__ import annotations

import logging
from typing import Any, Dict, Optional

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from education.models import Exercise, ExerciseTranslation
from education.services.translation import OpenAIPaymentRequiredError, get_translator

logger = logging.getLogger(__name__)

LANGUAGE_CODE = "ro"


def _multiple_choice_source(ex: Exercise) -> Optional[Dict[str, Any]]:
    """Build a dict ``translate_exercise`` can consume, or None if not applicable."""
    if not isinstance(ex.exercise_data, dict):
        return None
    opts = ex.exercise_data.get("options") or []
    if not opts:
        return None
    q = (ex.question or "").strip()
    if not q:
        return None
    return {**ex.exercise_data, "question": q}


def _exercise_ro_complete(ex: Exercise) -> bool:
    src = _multiple_choice_source(ex)
    if not src:
        return True
    tr = ExerciseTranslation.objects.filter(exercise=ex, language=LANGUAGE_CODE).first()
    if not tr or not (tr.question or "").strip():
        return False
    tr_data = tr.exercise_data if isinstance(tr.exercise_data, dict) else {}
    tr_opts = tr_data.get("options") or []
    src_opts = src.get("options") or []
    return len(src_opts) == len(tr_opts) and len(tr_opts) > 0


class Command(BaseCommand):
    help = "Translate standalone Exercise catalog entries to Romanian (ExerciseTranslation)."

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Print what would run without writing to the database.",
        )
        parser.add_argument(
            "--only-missing",
            action="store_true",
            help="Skip exercises that already have a complete Romanian overlay.",
        )
        parser.add_argument(
            "--limit",
            type=int,
            default=None,
            help="Maximum number of exercises to process.",
        )

    def handle(self, *args, **options):
        dry_run = options["dry_run"]
        only_missing = options["only_missing"]
        limit = options["limit"]

        try:
            translator = get_translator()
        except Exception as exc:
            raise CommandError(f"Translator not available: {exc}") from exc

        qs = Exercise.objects.filter(is_published=True).order_by("id")
        exercises = list(qs)
        if limit is not None and limit > 0:
            exercises = exercises[:limit]

        done = 0
        skipped = 0
        errors = 0

        for ex in exercises:
            src = _multiple_choice_source(ex)
            if not src:
                skipped += 1
                continue
            if only_missing and _exercise_ro_complete(ex):
                skipped += 1
                continue

            ctx = {
                "field": "standalone_exercise",
                "exercise_id": ex.id,
                "category": ex.category or "",
            }
            if dry_run:
                self.stdout.write(f"[dry-run] Would translate exercise #{ex.id} ({ex.type})")
                done += 1
                continue

            try:
                ro_data = translator.translate_exercise(src, ctx)
                ro_question = ro_data.get("question") or ex.question
            except OpenAIPaymentRequiredError:
                raise CommandError(
                    "OpenAI 402 Payment Required — add credits and re-run."
                ) from None
            except Exception as exc:
                logger.exception("translate standalone exercise %s: %s", ex.id, exc)
                errors += 1
                continue

            with transaction.atomic():
                ExerciseTranslation.objects.update_or_create(
                    exercise=ex,
                    language=LANGUAGE_CODE,
                    defaults={
                        "question": ro_question,
                        "exercise_data": ro_data,
                    },
                )
            done += 1
            self.stdout.write(self.style.SUCCESS(f"  ✓ exercise #{ex.id}"))

        self.stdout.write("")
        self.stdout.write(
            self.style.SUCCESS(
                f"Done. Translated: {done}  Skipped (non-MC or complete): {skipped}  Errors: {errors}"
            )
        )

"""
Unpublish exercises that cannot be shown to learners (empty question, no translation text).

  docker compose exec backend python manage.py fix_malformed_exercises
  docker compose exec backend python manage.py fix_malformed_exercises --apply

Pairs with API filtering in `education.exercise_visibility` and Exercise.clean().
"""

from __future__ import annotations

import json

from django.core.management.base import BaseCommand
from django.db.models import Exists, OuterRef, Q
from django.db.models.functions import Trim

from education.models import Exercise, ExerciseTranslation


class Command(BaseCommand):
    help = "List or unpublish exercises with no usable question text"

    def add_arguments(self, parser):
        parser.add_argument(
            "--apply",
            action="store_true",
            help="Set is_published=False on matching rows",
        )

    def handle(self, *args, **options):
        apply_changes: bool = options["apply"]

        tr_nonempty = (
            ExerciseTranslation.objects.filter(exercise_id=OuterRef("pk"))
            .annotate(_tq=Trim("question"))
            .exclude(_tq="")
        )

        qs = (
            Exercise.objects.annotate(_qtrim=Trim("question"))
            .filter(_qtrim="")
            .filter(~Exists(tr_nonempty))
            .order_by("id")
        )
        rows = list(qs)
        self.stdout.write(
            self.style.NOTICE(f"Malformed exercises (empty question, no translation): {len(rows)}")
        )
        for ex in rows[:30]:
            preview = json.dumps(ex.exercise_data)[:120] if ex.exercise_data is not None else ""
            self.stdout.write(
                f"  id={ex.id} type={ex.type} cat={ex.category!r} published={ex.is_published} "
                f"data={preview!r}..."
            )
        if len(rows) > 30:
            self.stdout.write(f"  ... {len(rows) - 30} more")

        if not apply_changes:
            self.stdout.write(self.style.NOTICE("\nDry-run. Re-run with --apply to unpublish."))
            return

        n = qs.update(is_published=False)
        self.stdout.write(self.style.SUCCESS(f"Unpublished {n} exercise(s)."))

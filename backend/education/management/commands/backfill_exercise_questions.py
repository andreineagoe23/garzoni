"""
Fill empty Exercise.question from structured exercise_data (and optionally republish).

Numeric exercises often store the learner-facing line in exercise_data["prompt"] while
question was left blank by importers.

  python manage.py backfill_exercise_questions
  python manage.py backfill_exercise_questions --apply --republish

After backfill, run `retag_general_exercises` on category General if you want taxonomy
updated, then verify in admin.
"""

from __future__ import annotations

from django.core.management.base import BaseCommand
from django.db.models.functions import Trim

from education.models import Exercise


def _infer_question(ex: Exercise) -> str | None:
    data = ex.exercise_data if isinstance(ex.exercise_data, dict) else {}
    prompt = data.get("prompt")
    if isinstance(prompt, str) and prompt.strip():
        return prompt.strip()
    if ex.type == "drag-and-drop":
        return "Match each item to the correct target."
    if ex.type == "budget-allocation":
        return data.get("title") or "Allocate your budget across the categories below."
    return None


class Command(BaseCommand):
    help = "Backfill empty question text from exercise_data"

    def add_arguments(self, parser):
        parser.add_argument(
            "--apply",
            action="store_true",
            help="Write question (and optional republish)",
        )
        parser.add_argument(
            "--republish",
            action="store_true",
            help="Set is_published=True after backfill (use with --apply)",
        )

    def handle(self, *args, **options):
        apply_changes: bool = options["apply"]
        republish: bool = options["republish"]

        qs = Exercise.objects.annotate(_qt=Trim("question")).filter(_qt="").order_by("id")
        rows = list(qs)
        self.stdout.write(self.style.NOTICE(f"Exercises with empty question: {len(rows)}"))

        plan: list[tuple[Exercise, str]] = []
        for ex in rows:
            text = _infer_question(ex)
            if text:
                plan.append((ex, text))
            else:
                self.stdout.write(
                    self.style.WARNING(f"  id={ex.id} type={ex.type}: no heuristic for question")
                )

        for ex, text in plan[:20]:
            self.stdout.write(f"  id={ex.id} -> {text[:100]!r}...")
        if len(plan) > 20:
            self.stdout.write(f"  ... {len(plan) - 20} more")

        if not apply_changes:
            self.stdout.write(self.style.NOTICE("\nDry-run. Re-run with --apply."))
            return

        updated = 0
        for ex, text in plan:
            ex.question = text
            fields = ["question"]
            if republish:
                ex.is_published = True
                fields.append("is_published")
            ex.full_clean()
            ex.save(update_fields=fields)
            updated += 1

        self.stdout.write(self.style.SUCCESS(f"Updated {updated} exercise(s)."))

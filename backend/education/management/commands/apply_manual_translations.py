"""
Apply hand-written Romanian exercise translations from a JSON file.

``translate_lessons_to_ro`` calls OpenAI. This is the offline equivalent: it
takes translations produced any other way and applies them under the checks that
matter for a translated multiple-choice question.

The dangerous failure here is silent misalignment. A translation stores its own
``options`` array and its own ``correctAnswer``; if the order drifts from the
English source, or the index is copied wrong, a Romanian learner is graded
against a different option than the one they read. Every record is checked for
that before anything is written.

Input file: a list of objects

    {"kind": "section"|"exercise", "id": 123, "language": "ro",
     "question": "...", "options": ["...", "...", "...", "..."],
     "explanation": "...", "hints": ["...", "..."]}

``correctAnswer`` is never taken from the file — it is copied from the English
source, so the two cannot disagree.

    python manage.py apply_manual_translations --file ro_batch.json --dry-run
    python manage.py apply_manual_translations --file ro_batch.json
"""

from __future__ import annotations

import json
from pathlib import Path

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from education.exercise_quality import length_problem
from education.models import (
    Exercise,
    ExerciseTranslation,
    LessonSection,
    LessonSectionTranslation,
)


class Command(BaseCommand):
    help = "Apply hand-written Romanian exercise translations from a JSON file."

    def add_arguments(self, parser):
        parser.add_argument("--file", required=True, metavar="PATH")
        parser.add_argument("--dry-run", action="store_true")
        parser.add_argument(
            "--allow-uneven",
            action="store_true",
            help=(
                "Skip the option-length check on the translated options. Romanian runs longer "
                "than English, so a faithful translation can drift; use only after reading the "
                "reported spreads."
            ),
        )

    def handle(self, *args, **options):
        path = Path(options["file"])
        if not path.exists():
            raise CommandError(f"File not found: {path}")
        records = json.loads(path.read_text(encoding="utf-8"))
        if not isinstance(records, list):
            raise CommandError("File must contain a JSON list.")

        sources = self._load_sources(records)
        problems, warnings, ready = [], [], []

        for r in records:
            rid, kind = r.get("id"), r.get("kind")
            label = f"{kind}:{rid}"
            if kind not in ("section", "exercise") or not isinstance(rid, int):
                problems.append(f"{label} — bad kind or id")
                continue
            src = sources.get((kind, rid))
            if src is None:
                problems.append(f"{label} — no such row, or its English source has no options")
                continue

            opts = r.get("options")
            if not isinstance(opts, list) or not all(isinstance(o, str) for o in opts):
                problems.append(f"{label} — options must be a list of strings")
                continue
            opts = [o.strip() for o in opts]
            if len(opts) != len(src["options"]):
                problems.append(
                    f"{label} — {len(opts)} options but the English source has "
                    f"{len(src['options'])}; order must match one-for-one"
                )
                continue
            if any(not o for o in opts):
                problems.append(f"{label} — an option is empty")
                continue
            if len(set(opts)) != len(opts):
                problems.append(f"{label} — options must all be different")
                continue
            if not (r.get("question") or "").strip():
                problems.append(f"{label} — question is empty")
                continue
            # A translation that repeats the English verbatim is a silent no-op.
            if opts == [str(o).strip() for o in src["options"]]:
                problems.append(f"{label} — options are identical to the English source")
                continue

            gate = length_problem(opts, src["correct"])
            if gate:
                if options["allow_uneven"]:
                    warnings.append(f"{label} — {gate}")
                else:
                    problems.append(f"{label} — {gate}")
                    continue

            ready.append((r, src, opts))

        if problems:
            self.stderr.write(self.style.ERROR(f"{len(problems)} record(s) rejected:"))
            for p in problems:
                self.stderr.write(f"  {p}")
            raise CommandError("Nothing applied.")

        for w in warnings:
            self.stdout.write(self.style.WARNING(f"  uneven: {w}"))
        self.stdout.write(
            self.style.SUCCESS(f"All {len(ready)} translation(s) align with their English source.")
        )
        if options["dry_run"]:
            self.stdout.write(self.style.WARNING("Dry run — nothing written."))
            return

        applied = 0
        for r, src, opts in ready:
            payload = {
                "question": r["question"].strip(),
                "options": opts,
                # Copied from English, never taken from the file: the two must
                # not be able to disagree about which option is correct.
                "correctAnswer": src["correct"],
            }
            if (r.get("explanation") or "").strip():
                payload["explanation"] = r["explanation"].strip()
            hints = [h.strip() for h in (r.get("hints") or []) if isinstance(h, str) and h.strip()]
            if hints:
                payload["hints"] = hints[:2]
            if src.get("difficulty"):
                payload["difficulty"] = src["difficulty"]

            language = (r.get("language") or "ro").strip() or "ro"
            with transaction.atomic():
                if r["kind"] == "section":
                    LessonSectionTranslation.objects.update_or_create(
                        section_id=r["id"],
                        language=language,
                        defaults={"exercise_data": payload, "title": src["title"]},
                    )
                else:
                    ExerciseTranslation.objects.update_or_create(
                        exercise_id=r["id"],
                        language=language,
                        defaults={
                            "exercise_data": payload,
                            "question": payload["question"][:2000],
                        },
                    )
            applied += 1

        self.stdout.write(self.style.SUCCESS(f"Applied {applied} translation(s)."))

    # ------------------------------------------------------------------

    def _load_sources(self, records):
        section_ids = [r["id"] for r in records if r.get("kind") == "section"]
        exercise_ids = [r["id"] for r in records if r.get("kind") == "exercise"]
        out = {}
        for s in LessonSection.objects.filter(id__in=section_ids):
            d = s.exercise_data if isinstance(s.exercise_data, dict) else {}
            opts, idx = d.get("options"), d.get("correctAnswer")
            if isinstance(opts, list) and isinstance(idx, int) and 0 <= idx < len(opts):
                out[("section", s.id)] = {
                    "options": opts,
                    "correct": idx,
                    "title": s.title,
                    "difficulty": d.get("difficulty"),
                }
        for e in Exercise.objects.filter(id__in=exercise_ids):
            d = e.exercise_data if isinstance(e.exercise_data, dict) else {}
            opts, idx = d.get("options"), e.correct_answer
            if isinstance(opts, list) and isinstance(idx, int) and 0 <= idx < len(opts):
                out[("exercise", e.id)] = {
                    "options": opts,
                    "correct": idx,
                    "title": e.category,
                    "difficulty": e.difficulty,
                }
        return out

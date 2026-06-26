"""
Surgical content fixes from a JSON file. Updates only the fields provided,
leaving everything else (options, correct answer, explanation, other sections)
untouched. Built for backfilling short_description and widening short exercise
question stems without rewriting whole lessons.

JSON shape: a list of objects, each keyed by lesson id:
  [
    {"id": 103, "short_description": "…", "q3": "…", "q6": "…"},
    {"id": 104, "short_description": "…"}
  ]
Only present keys are applied. "q3"/"q6" replace exercise_data["question"]
on section order 3/6, preserving the rest of exercise_data.

Usage:
  python manage.py apply_lesson_fixes path/to/fixes.json --dry-run
  python manage.py apply_lesson_fixes path/to/fixes.json
"""

import json
from pathlib import Path as FsPath

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from education.models import Lesson

QUESTION_KEY_TO_ORDER = {"q3": 3, "q6": 6}


class Command(BaseCommand):
    help = "Apply surgical lesson fixes (short_description, exercise question stems) from JSON."

    def add_arguments(self, parser):
        parser.add_argument("path", type=str, help="Path to the fixes .json file.")
        parser.add_argument("--dry-run", action="store_true")

    def handle(self, *args, **options):
        fs_path = FsPath(options["path"]).resolve()
        if not fs_path.is_file():
            raise CommandError(f"File not found: {fs_path}")
        dry_run = options["dry_run"]
        fixes = json.loads(fs_path.read_text(encoding="utf-8"))
        if not isinstance(fixes, list):
            raise CommandError("Fixes file must be a JSON list.")

        n_sd = n_q = n_ex = n_lessons = 0
        with transaction.atomic():
            for fix in fixes:
                lesson = Lesson.objects.filter(id=fix["id"]).prefetch_related("sections").first()
                if not lesson:
                    self.stdout.write(self.style.WARNING(f"Lesson {fix['id']} not found, skip."))
                    continue
                changed = []
                if "short_description" in fix and fix["short_description"]:
                    lesson.short_description = fix["short_description"]
                    if not dry_run:
                        lesson.save(update_fields=["short_description"])
                    n_sd += 1
                    changed.append("short_description")
                for qkey, order in QUESTION_KEY_TO_ORDER.items():
                    if not fix.get(qkey):
                        continue
                    section = lesson.sections.filter(order=order).first()
                    if not section or not section.exercise_data:
                        self.stdout.write(
                            self.style.WARNING(
                                f"Lesson {fix['id']} section {order} has no exercise_data, skip."
                            )
                        )
                        continue
                    data = dict(section.exercise_data)
                    data["question"] = fix[qkey]
                    section.exercise_data = data
                    if not dry_run:
                        section.save(update_fields=["exercise_data"])
                    n_q += 1
                    changed.append(qkey)
                for exkey, order in (("ex3", 3), ("ex6", 6)):
                    spec = fix.get(exkey)
                    if not spec:
                        continue
                    section = lesson.sections.filter(order=order, content_type="exercise").first()
                    if not section:
                        self.stdout.write(
                            self.style.WARNING(
                                f"Lesson {fix['id']} has no exercise section {order}, skip."
                            )
                        )
                        continue
                    section.exercise_type = spec["type"]
                    section.exercise_data = spec["data"]
                    if not dry_run:
                        section.save(update_fields=["exercise_type", "exercise_data"])
                    n_ex += 1
                    changed.append(f"{exkey}->{spec['type']}")
                if changed:
                    n_lessons += 1
                    self.stdout.write(f"{lesson.id} {lesson.title}: {', '.join(changed)}")
            if dry_run:
                transaction.set_rollback(True)

        self.stdout.write(
            self.style.SUCCESS(
                f"{'DRY RUN — would update' if dry_run else 'Updated'}: "
                f"{n_lessons} lessons, {n_sd} short_descriptions, {n_q} questions, {n_ex} exercises."
            )
        )

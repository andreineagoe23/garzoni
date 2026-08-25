"""
Spread the correct answer evenly across option slots for the practice catalog
and the course capstone quizzes.

``rebalance_mc_answer_positions`` does the same job for in-lesson knowledge
checks (``LessonSection``). This is its sibling for the two surfaces that
command does not walk:

* ``Exercise`` rows of type multiple-choice — the standalone practice tab.
  Measured 2026-08-25: 81% of answers sat in slot 1 and none past slot 2.
* ``Quiz`` rows with no ``source_lesson_section`` — course capstones. 75% slot 2.
  Checkpoint quizzes are deliberately excluded: they are materialized copies of
  a lesson section and follow it via ``resync_quiz_from_section``.

Deterministic (seeded by row id), so re-running reproduces the same layout
rather than reshuffling.

    python manage.py rebalance_catalog_answer_positions --dry-run
    python manage.py rebalance_catalog_answer_positions
"""

from __future__ import annotations

from collections import Counter
from typing import Any

from django.core.management.base import BaseCommand
from django.db import transaction

from education.exercise_quality import correct_index_of
from education.management.commands.rebalance_mc_answer_positions import (
    assign_targets,
    build_permutation,
)
from education.models import (
    EducationAuditLog,
    Exercise,
    ExerciseTranslation,
    MultipleChoiceChoice,
    Quiz,
    QuizTranslation,
)


def _apply(seq: list[Any], perm: list[int]) -> list[Any]:
    return [seq[i] for i in perm]


def sync_choice_rows(exercise: Exercise) -> bool:
    """
    Rebuild MultipleChoiceChoice from exercise_data.options.

    Nothing serves those rows to learners, but ``ExerciseAdmin.save_related``
    writes exercise_data BACK from them on every admin save. Most of them held
    placeholder text from an old generator, so an admin save replaced real
    content with boilerplate — and would silently undo this rebalance. Keeping
    the mirror faithful makes that write a no-op.
    """
    rows = list(exercise.multiple_choice_choices.all())
    if not rows:
        return False
    options = [str(o) for o in (exercise.exercise_data or {}).get("options") or []]
    if not options:
        return False
    correct = exercise.correct_answer
    MultipleChoiceChoice.objects.filter(exercise=exercise).delete()
    MultipleChoiceChoice.objects.bulk_create(
        [
            MultipleChoiceChoice(exercise=exercise, order=i, text=text, is_correct=(i == correct))
            for i, text in enumerate(options)
        ]
    )
    return True


class Command(BaseCommand):
    help = "Rebalance answer slots for standalone exercises and course capstone quizzes."

    def add_arguments(self, parser):
        parser.add_argument("--dry-run", action="store_true")
        parser.add_argument(
            "--target",
            choices=["exercises", "quizzes", "all"],
            default="all",
        )

    def handle(self, *args, **options):
        dry_run = options["dry_run"]
        target = options["target"]
        if target in ("exercises", "all"):
            self._rebalance_exercises(dry_run)
        if target in ("quizzes", "all"):
            self._rebalance_quizzes(dry_run)

    # ------------------------------------------------------------------

    def _rebalance_exercises(self, dry_run: bool):
        eligible = []
        before = Counter()
        slots = 0
        for ex in Exercise.objects.filter(type="multiple-choice"):
            data = ex.exercise_data if isinstance(ex.exercise_data, dict) else {}
            options = data.get("options")
            if not isinstance(options, list) or len(options) < 2:
                continue
            # Exercise.correct_answer (the model field) is authoritative: it is
            # what the submit endpoint grades against, views.py:2128. Some rows
            # ALSO carry a `correctAnswer` key inside exercise_data, and 11 of
            # them disagree with the field — a vestigial second source of truth.
            # Prefer the field, fall back to the JSON, and strip the JSON copy.
            correct = None
            if isinstance(ex.correct_answer, int) and not isinstance(ex.correct_answer, bool):
                if 0 <= ex.correct_answer < len(options):
                    correct = ex.correct_answer
            if correct is None:
                correct = correct_index_of(data, len(options))
            if correct is None:
                continue
            before[correct] += 1
            slots = max(slots, len(options))
            eligible.append((ex, data, correct))

        if not eligible:
            self.stdout.write("No eligible multiple-choice exercises.")
            return

        targets = assign_targets([e.id for e, _, _ in eligible], slots)
        after = Counter()
        changed = synced = 0

        for ex, data, correct in eligible:
            n = len(data["options"])
            tgt = min(targets[ex.id], n - 1)
            after[tgt] += 1
            moving = not (tgt == correct and n == slots)

            if dry_run:
                changed += int(moving)
                continue

            perm = build_permutation(ex.id, n, correct, tgt) if moving else list(range(n))
            new_data = dict(data)
            new_data["options"] = _apply(data["options"], perm)
            new_data.pop("correctAnswer", None)

            stale_key = any(k in data for k in ("correctAnswer", "correct_answer"))
            with transaction.atomic():
                if moving or stale_key:
                    ex.exercise_data = new_data
                    ex.correct_answer = tgt if moving else correct
                    ex.save(update_fields=["exercise_data", "correct_answer"])

                for tr in ExerciseTranslation.objects.filter(exercise=ex) if moving else []:
                    td = tr.exercise_data if isinstance(tr.exercise_data, dict) else None
                    topts = td.get("options") if td else None
                    if isinstance(topts, list) and len(topts) == n:
                        moved = dict(td)
                        moved["options"] = _apply(topts, perm)
                        moved.pop("correctAnswer", None)
                        tr.exercise_data = moved
                        tr.save(update_fields=["exercise_data"])
                    elif td is not None:
                        tr.exercise_data = None
                        tr.save(update_fields=["exercise_data"])

                # Runs whether or not the slot moved: the placeholder rows
                # are a live hazard on their own, because the admin writes
                # exercise_data back from them.
                if sync_choice_rows(ex):
                    synced += 1

                if moving:
                    EducationAuditLog.objects.create(
                        user=None,
                        action="answer_position_rebalance",
                        target_type="Exercise",
                        target_id=ex.id,
                        metadata={"from_index": correct, "to_index": tgt, "permutation": perm},
                    )
            changed += int(moving)

        total = sum(before.values())
        self.stdout.write("")
        self.stdout.write(f"Practice catalog (Exercise): {total} multiple-choice")
        self.stdout.write("  before: " + self._dist(before, total, slots))
        self.stdout.write("  after:  " + self._dist(after, total, slots))
        verb = "would move" if dry_run else "moved"
        self.stdout.write(self.style.SUCCESS(f"  {verb} {changed}; choice rows resynced {synced}"))

    # ------------------------------------------------------------------

    def _rebalance_quizzes(self, dry_run: bool):
        eligible = []
        before = Counter()
        slots = 0
        for q in Quiz.objects.filter(source_lesson_section__isnull=True):
            texts = [c.get("text") if isinstance(c, dict) else str(c) for c in (q.choices or [])]
            if len(texts) < 2 or q.correct_answer not in texts:
                continue
            correct = texts.index(q.correct_answer)
            before[correct] += 1
            slots = max(slots, len(texts))
            eligible.append((q, texts, correct))

        if not eligible:
            self.stdout.write("\nNo eligible standalone quizzes.")
            return

        targets = assign_targets([q.id for q, _, _ in eligible], slots)
        after = Counter()
        changed = 0

        for q, texts, correct in eligible:
            n = len(texts)
            tgt = min(targets[q.id], n - 1)
            after[tgt] += 1
            if tgt == correct and n == slots:
                continue
            perm = build_permutation(q.id, n, correct, tgt)

            if dry_run:
                changed += 1
                continue

            with transaction.atomic():
                # correct_answer is stored as text, so it stays valid; only the
                # order of `choices` moves.
                q.choices = _apply(list(q.choices or []), perm)
                q.save(update_fields=["choices"])

                for qt in QuizTranslation.objects.filter(quiz=q):
                    tch = list(qt.choices or [])
                    if len(tch) == n:
                        qt.choices = _apply(tch, perm)
                        qt.save(update_fields=["choices"])
                    else:
                        qt.choices = []
                        qt.correct_answer = ""
                        qt.save(update_fields=["choices", "correct_answer"])

                EducationAuditLog.objects.create(
                    user=None,
                    action="answer_position_rebalance",
                    target_type="Quiz",
                    target_id=q.id,
                    metadata={"from_index": correct, "to_index": tgt, "permutation": perm},
                )
            changed += 1

        total = sum(before.values())
        self.stdout.write("")
        self.stdout.write(f"Course capstone quizzes: {total}")
        self.stdout.write("  before: " + self._dist(before, total, slots))
        self.stdout.write("  after:  " + self._dist(after, total, slots))
        verb = "would move" if dry_run else "moved"
        self.stdout.write(self.style.SUCCESS(f"  {verb} {changed}"))

    @staticmethod
    def _dist(counter: Counter, total: int, slots: int) -> str:
        if not total:
            return "(none)"
        return "  ".join(
            f"[{i}] {counter.get(i, 0):>3} ({100 * counter.get(i, 0) / total:>4.1f}%)"
            for i in range(slots)
        )

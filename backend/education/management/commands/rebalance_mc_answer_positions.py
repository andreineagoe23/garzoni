"""
Spread the correct answer evenly across option slots for multiple-choice lesson sections.

The content pipeline (``rewrite_exercise_sections``) locked every rewrite to the
original answer index and was few-shot primed on index 1, so the corpus ended up
with the answer at slot 2 in three quarters of all knowledge checks and never at
slot 4. Mobile hides that by shuffling at render time; web and the lesson
checkpoint modal render stored order, so the tell is live for users.

This command permutes the stored options and rewrites ``correctAnswer`` to a
balanced target slot. It is deterministic (seeded by section id), so re-running
it produces the same layout, and it moves every index-aligned copy of the same
options in lockstep: ``LessonSectionTranslation.exercise_data`` for every
language, plus the ``Quiz``/``QuizTranslation`` rows materialized from the
section for lesson checkpoints.

It does not touch wording. The length tell (the correct option is the longest in
95% of checks) is a content problem — see ``rewrite_exercise_sections``.

    python manage.py rebalance_mc_answer_positions --dry-run
    python manage.py rebalance_mc_answer_positions
    python manage.py rebalance_mc_answer_positions --course-id 12
"""

from __future__ import annotations

import random
from collections import Counter
from typing import Any

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from education.exercise_quality import correct_index_of
from education.models import EducationAuditLog, LessonSection, LessonSectionTranslation
from education.services.checkpoint_quizzes import (
    orphaned_checkpoint_quizzes,
    resync_quiz_from_section,
)

# Fixed so a re-run reproduces the same layout rather than reshuffling users'
# content every time the command is invoked.
SEED = 20260825


def build_permutation(section_id: int, n: int, correct: int, target: int) -> list[int]:
    """
    Old-index-per-new-slot mapping that puts `correct` at `target`.

    The distractors are shuffled too, so re-running does not leave the wrong
    options in their original relative order (which would itself be a tell once
    learners see the same three distractors in the same sequence every time).
    """
    others = [i for i in range(n) if i != correct]
    random.Random(SEED ^ section_id).shuffle(others)
    perm = others[:target] + [correct] + others[target:]
    return perm


def _apply(seq: list[Any], perm: list[int]) -> list[Any]:
    return [seq[i] for i in perm]


def assign_targets(section_ids: list[int], slots: int) -> dict[int, int]:
    """
    Round-robin target slot over a deterministically shuffled id list.

    Round-robin gives exact balance (as opposed to hashing each id
    independently, which leaves a visible skew at this corpus size), and the
    shuffle keeps the slot from correlating with course or lesson order.
    """
    ordered = sorted(section_ids)
    random.Random(SEED).shuffle(ordered)
    return {sid: i % slots for i, sid in enumerate(ordered)}


class Command(BaseCommand):
    help = "Rebalance which slot holds the correct answer in multiple-choice lesson sections."

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Report the before/after distribution without writing.",
        )
        parser.add_argument("--course-id", type=int, default=None, metavar="ID")
        parser.add_argument("--path-id", type=int, default=None, metavar="ID")
        parser.add_argument("--only-ids", type=str, default="", metavar="1,2,3")
        parser.add_argument(
            "--include-unpublished",
            action="store_true",
            help="Also rebalance sections with is_published=False.",
        )
        parser.add_argument(
            "--prune-orphan-checkpoints",
            action="store_true",
            help=(
                "Delete checkpoint quizzes whose source section is no longer "
                "multiple-choice. Destructive: cascades their QuizCompletion rows. "
                "Without this they are only reported."
            ),
        )

    def handle(self, *args, **options):
        dry_run: bool = options["dry_run"]

        qs = LessonSection.objects.filter(content_type="exercise", exercise_type="multiple-choice")
        if not options["include_unpublished"]:
            qs = qs.filter(is_published=True)
        if options["course_id"]:
            qs = qs.filter(lesson__course_id=options["course_id"])
        if options["path_id"]:
            qs = qs.filter(lesson__course__path_id=options["path_id"])
        if options["only_ids"]:
            try:
                ids = [int(x) for x in options["only_ids"].split(",") if x.strip()]
            except ValueError as exc:
                raise CommandError(f"--only-ids must be a comma-separated list of ints: {exc}")
            qs = qs.filter(id__in=ids)

        sections = list(qs.select_related("lesson__course").order_by("id"))
        if not sections:
            self.stdout.write("No matching multiple-choice sections.")
            return

        eligible: list[tuple[LessonSection, dict[str, Any], int]] = []
        skipped: list[tuple[int, str]] = []
        before = Counter()
        slots = 0

        for section in sections:
            data = section.exercise_data if isinstance(section.exercise_data, dict) else {}
            raw_options = data.get("options")
            if not isinstance(raw_options, list) or len(raw_options) < 2:
                skipped.append((section.id, "fewer than 2 options"))
                continue
            correct = correct_index_of(data, len(raw_options))
            if correct is None:
                skipped.append(
                    (section.id, f"unusable correctAnswer {data.get('correctAnswer')!r}")
                )
                continue
            before[correct] += 1
            slots = max(slots, len(raw_options))
            eligible.append((section, data, correct))

        if not eligible:
            self.stdout.write(self.style.WARNING("Nothing eligible to rebalance."))
            for sid, why in skipped:
                self.stdout.write(f"  skip section {sid}: {why}")
            return

        targets = assign_targets([s.id for s, _, _ in eligible], slots)

        after = Counter()
        changed = 0
        notes: list[str] = []

        for section, data, correct in eligible:
            n = len(data["options"])
            target = min(targets[section.id], n - 1)
            after[target] += 1
            if target == correct and n == slots:
                # Already where it should land; still counted above so the
                # reported distribution is the real end state.
                continue

            perm = build_permutation(section.id, n, correct, target)
            new_data = dict(data)
            new_data["options"] = _apply(data["options"], perm)
            new_data["correctAnswer"] = target
            new_data.pop("correct_answer", None)

            if dry_run:
                changed += 1
                continue

            with transaction.atomic():
                section.exercise_data = new_data
                section.save(update_fields=["exercise_data"])

                for tr in LessonSectionTranslation.objects.filter(section=section):
                    tr_data = tr.exercise_data if isinstance(tr.exercise_data, dict) else None
                    tr_options = tr_data.get("options") if tr_data else None
                    if isinstance(tr_options, list) and len(tr_options) == n:
                        moved = dict(tr_data)
                        moved["options"] = _apply(tr_options, perm)
                        moved["correctAnswer"] = target
                        moved.pop("correct_answer", None)
                        tr.exercise_data = moved
                        tr.save(update_fields=["exercise_data"])
                    elif tr_data is not None:
                        # Option count drifted from the English source, so the
                        # permutation is meaningless here. Drop it and let
                        # translate_lessons_to_ro rebuild from the new order.
                        tr.exercise_data = None
                        tr.source_hash = ""
                        tr.save(update_fields=["exercise_data", "source_hash"])
                        notes.append(
                            f"section {section.id}: dropped {tr.language} translation "
                            f"({len(tr_options or [])} options vs {n})"
                        )

                quiz_note = resync_quiz_from_section(section)
                if quiz_note:
                    notes.append(f"section {section.id}: {quiz_note}")

                EducationAuditLog.objects.create(
                    user=None,
                    action="answer_position_rebalance",
                    target_type="LessonSection",
                    target_id=section.id,
                    metadata={
                        "from_index": correct,
                        "to_index": target,
                        "permutation": perm,
                        "seed": SEED,
                    },
                )
            changed += 1

        total = sum(before.values())
        self.stdout.write("")
        self.stdout.write(f"Multiple-choice sections considered: {total}")
        self.stdout.write("  before: " + self._dist(before, total, slots))
        self.stdout.write("  after:  " + self._dist(after, total, slots))
        self.stdout.write("")
        verb = "would move" if dry_run else "moved"
        self.stdout.write(self.style.SUCCESS(f"{verb} {changed} section(s)"))
        for note in notes:
            self.stdout.write(self.style.WARNING(f"  {note}"))
        for sid, why in skipped:
            self.stdout.write(f"  skip section {sid}: {why}")

        orphans = list(orphaned_checkpoint_quizzes().select_related("source_lesson_section"))
        if orphans:
            self.stdout.write("")
            self.stdout.write(
                self.style.WARNING(
                    f"{len(orphans)} checkpoint quiz(zes) source a section that is no longer "
                    "multiple-choice — the modal asks a question the lesson dropped:"
                )
            )
            for quiz in orphans:
                sec = quiz.source_lesson_section
                self.stdout.write(
                    f"  quiz {quiz.id} ← section {sec.id} (now {sec.exercise_type or 'not an exercise'}) "
                    f"— {quiz.question[:70]}"
                )
            if options["prune_orphan_checkpoints"] and not dry_run:
                deleted, _ = orphaned_checkpoint_quizzes().delete()
                self.stdout.write(self.style.SUCCESS(f"  deleted {deleted} row(s)"))
            else:
                self.stdout.write(
                    "  Run with --prune-orphan-checkpoints to delete them "
                    "(also removes their completion records)."
                )

        if dry_run:
            self.stdout.write(self.style.WARNING("Dry run — nothing written."))

    @staticmethod
    def _dist(counter: Counter, total: int, slots: int) -> str:
        if not total:
            return "(none)"
        return "  ".join(
            f"[{i}] {counter.get(i, 0):>3} ({100 * counter.get(i, 0) / total:>4.1f}%)"
            for i in range(slots)
        )

"""
Push all AI-rewritten content from local Docker DB to Railway production DB.
Covers: LessonSection text + exercise data, standalone Exercise, Quiz, and their translations.

Usage:
    docker compose exec -e RAILWAY_DB_URL="<DATABASE_PUBLIC_URL>" backend \
        python manage.py push_rewrites_to_railway

Or via the convenience script:
    bash backend/scripts/push_rewrites_to_railway.sh

Get DATABASE_PUBLIC_URL from: Railway dashboard → your project → PostgreSQL service → Variables.
"""

import json
import os

import psycopg2
import psycopg2.extras
from django.core.management.base import BaseCommand, CommandError

from education.models import (
    EducationAuditLog,
    Exercise,
    ExerciseTranslation,
    LessonSection,
    LessonSectionTranslation,
    Quiz,
    QuizTranslation,
)


# Every audit action that edits published content. "ai_rewrite" was the only
# one until rebalance_mc_answer_positions started moving answer slots; a push
# that ignored it would leave production on the old, index-1-heavy order.
CONTENT_ACTIONS = ["ai_rewrite", "answer_position_rebalance"]


class Command(BaseCommand):
    help = "Push all AI-rewritten content from local DB to Railway production DB."

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Show what would be pushed without writing to Railway.",
        )
        parser.add_argument(
            "--only-ids",
            type=str,
            default="",
            metavar="1,2,3",
            help=(
                "Local LessonSection ids to push regardless of the audit log. For sections that "
                "changed outside a rewrite — an exercise_type conversion, say — which the "
                "audit-log selection would otherwise never carry across."
            ),
        )
        parser.add_argument(
            "--target",
            choices=["sections", "exercises", "quizzes", "all"],
            default="all",
            help="What to push (default: all).",
        )

    def handle(self, *args, **options):
        railway_url = os.environ.get("RAILWAY_DB_URL")
        if not railway_url:
            raise CommandError(
                "RAILWAY_DB_URL env var not set.\n"
                "Run: docker compose exec -e RAILWAY_DB_URL='<url>' backend python manage.py push_rewrites_to_railway\n"
                "Get the URL from: Railway dashboard → PostgreSQL service → Variables → DATABASE_PUBLIC_URL"
            )

        dry_run = options["dry_run"]
        target = options["target"]
        try:
            only_ids = {int(x) for x in options.get("only_ids", "").split(",") if x.strip()}
        except ValueError as exc:
            raise CommandError(f"--only-ids must be a comma-separated list of ints: {exc}")

        if dry_run:
            self.stdout.write(self.style.WARNING("DRY RUN — no writes to Railway."))

        try:
            conn = psycopg2.connect(railway_url, sslmode="require")
        except Exception as exc:
            raise CommandError(f"Could not connect to Railway DB: {exc}")

        total_pushed = 0
        total_failed = 0

        try:
            if target in ("sections", "all"):
                pushed, failed = self._push_sections(conn, dry_run, only_ids)
                total_pushed += pushed
                total_failed += failed

            if target in ("exercises", "all"):
                pushed, failed = self._push_exercises(conn, dry_run)
                total_pushed += pushed
                total_failed += failed

            if target in ("quizzes", "all"):
                pushed, failed = self._push_quizzes(conn, dry_run)
                total_pushed += pushed
                total_failed += failed
        finally:
            conn.close()

        self.stdout.write(
            self.style.SUCCESS(f"\nTotal pushed: {total_pushed}  Failed: {total_failed}")
        )
        if total_failed:
            self.stderr.write(
                self.style.WARNING("Some records failed — check errors above and re-run.")
            )

    # ------------------------------------------------------------------
    # LessonSection text + exercise data
    # ------------------------------------------------------------------

    def _resolve_remote_section_ids(self, conn, sections):
        """
        Map local sections to remote ids by (lesson slug, section order).

        Row ids are NOT stable between environments. On 2026-08-25, 216 section
        ids referred to a different lesson in each database — the ids are offset
        by roughly one lesson — and an id-keyed push wrote 45 sections' content
        into the wrong lesson in production. Slug plus order is the only key that
        means the same thing on both sides.
        """
        keys = {(s.lesson.slug, s.order) for s in sections}
        with conn.cursor() as cur:
            cur.execute(
                'SELECT s.id, s."order", l.slug FROM core_lessonsection s '
                "JOIN core_lesson l ON l.id = s.lesson_id"
            )
            remote = {(slug, order): rid for rid, order, slug in cur.fetchall()}
        return {s.id: remote.get((s.lesson.slug, s.order)) for s in sections}, keys - set(remote)

    def _push_sections(self, conn, dry_run, only_ids=None):
        if only_ids:
            rewritten_ids = sorted(only_ids)
        else:
            rewritten_ids = list(
                EducationAuditLog.objects.filter(
                    action__in=CONTENT_ACTIONS, target_type="LessonSection"
                )
                .order_by()
                .values_list("target_id", flat=True)
                .distinct()
            )

        if not rewritten_ids:
            self.stdout.write("  [sections] No rewritten sections in audit log.")
            return 0, 0

        sections = LessonSection.objects.filter(id__in=rewritten_ids).select_related(
            "lesson__course__path"
        )
        section_map = {s.id: s for s in sections}

        translations = LessonSectionTranslation.objects.filter(section_id__in=rewritten_ids).values(
            "id", "section_id", "language", "text_content", "exercise_data"
        )
        trans_by_section = {}
        for t in translations:
            trans_by_section.setdefault(t["section_id"], []).append(t)

        remote_id_of, unmatched = self._resolve_remote_section_ids(conn, sections)
        resolvable = sum(1 for sid in rewritten_ids if remote_id_of.get(sid))
        shifted = sum(1 for sid in rewritten_ids if remote_id_of.get(sid) not in (None, sid))

        self.stdout.write(f"\n[sections] Found {len(rewritten_ids)} rewritten sections.")
        self.stdout.write(
            f"  matched by lesson slug + order: {resolvable}; "
            f"of those {shifted} land on a DIFFERENT remote id than the local one"
        )
        if unmatched:
            self.stdout.write(
                self.style.WARNING(
                    f"  {len(unmatched)} local section(s) have no remote counterpart"
                )
            )

        if dry_run:
            self.stdout.write(f"  Would push {resolvable} sections.")
            return resolvable, len(rewritten_ids) - resolvable

        pushed = 0
        failed = 0

        with conn.cursor() as cur:
            for sid in rewritten_ids:
                section = section_map.get(sid)
                if not section:
                    self.stderr.write(
                        self.style.WARNING(f"  Section {sid}: not in local DB — skipping.")
                    )
                    failed += 1
                    continue

                remote_id = remote_id_of.get(sid)
                if remote_id is None:
                    self.stderr.write(
                        self.style.WARNING(
                            f"  Section {sid} ({section.lesson.slug} #{section.order}): "
                            "no remote counterpart — skipping."
                        )
                    )
                    failed += 1
                    continue

                try:
                    if section.content_type == "text":
                        cur.execute(
                            "UPDATE core_lessonsection SET text_content = %s WHERE id = %s",
                            (section.text_content, remote_id),
                        )
                        cur.execute(
                            "UPDATE education_lessonsection_translation SET source_hash = '' WHERE section_id = %s",
                            (remote_id,),
                        )
                        for trans in trans_by_section.get(sid, []):
                            # Keyed on (remote section, language), not the local
                            # translation row id — that id is no more stable
                            # across environments than the section id was.
                            cur.execute(
                                "UPDATE education_lessonsection_translation SET text_content = %s "
                                "WHERE section_id = %s AND language = %s",
                                (trans["text_content"], remote_id, trans["language"]),
                            )
                    elif section.content_type == "exercise":
                        # exercise_type travels with exercise_data. Pushing the
                        # data alone left drag-and-drop or numeric payloads in a
                        # section the remote still typed multiple-choice, which
                        # renders as a broken widget rather than an exercise.
                        cur.execute(
                            "UPDATE core_lessonsection "
                            "SET exercise_data = %s, exercise_type = %s WHERE id = %s",
                            (json.dumps(section.exercise_data), section.exercise_type, remote_id),
                        )
                        cur.execute(
                            "UPDATE education_lessonsection_translation SET exercise_data = %s, source_hash = '' WHERE section_id = %s",
                            (json.dumps({}), remote_id),
                        )

                    conn.commit()
                    pushed += 1
                    self.stdout.write(
                        f"  ✓ section #{sid}→{remote_id} — {section.lesson.title} / {section.title}"
                    )

                except Exception as exc:
                    self.stderr.write(self.style.ERROR(f"  ✗ section #{sid}: {exc}"))
                    failed += 1
                    conn.rollback()

        self.stdout.write(self.style.SUCCESS(f"  [sections] Pushed: {pushed}  Failed: {failed}"))
        return pushed, failed

    # ------------------------------------------------------------------
    # Standalone Exercise model
    # ------------------------------------------------------------------

    def _push_exercises(self, conn, dry_run):
        rewritten_ids = list(
            EducationAuditLog.objects.filter(action__in=CONTENT_ACTIONS, target_type="Exercise")
            .order_by()
            .values_list("target_id", flat=True)
            .distinct()
        )

        if not rewritten_ids:
            self.stdout.write("  [exercises] No rewritten exercises in audit log.")
            return 0, 0

        exercises = Exercise.objects.filter(id__in=rewritten_ids)
        exercise_map = {e.id: e for e in exercises}

        self.stdout.write(f"\n[exercises] Found {len(rewritten_ids)} rewritten exercises.")

        if dry_run:
            self.stdout.write(f"  Would push {len(rewritten_ids)} exercises.")
            return len(rewritten_ids), 0

        pushed = 0
        failed = 0

        with conn.cursor() as cur:
            for eid in rewritten_ids:
                exercise = exercise_map.get(eid)
                if not exercise:
                    self.stderr.write(
                        self.style.WARNING(f"  Exercise {eid}: not in local DB — skipping.")
                    )
                    failed += 1
                    continue

                try:
                    cur.execute(
                        "UPDATE core_exercise SET question = %s, exercise_data = %s, correct_answer = %s WHERE id = %s",
                        (
                            exercise.question,
                            json.dumps(exercise.exercise_data),
                            json.dumps(exercise.correct_answer),
                            eid,
                        ),
                    )
                    cur.execute(
                        "UPDATE education_exercise_translation SET question = '', exercise_data = %s WHERE exercise_id = %s",
                        (json.dumps({}), eid),
                    )
                    conn.commit()
                    pushed += 1
                    self.stdout.write(
                        f"  ✓ exercise #{eid} ({exercise.type}) — {exercise.question[:60]}"
                    )

                except Exception as exc:
                    self.stderr.write(self.style.ERROR(f"  ✗ exercise #{eid}: {exc}"))
                    failed += 1
                    conn.rollback()

        self.stdout.write(self.style.SUCCESS(f"  [exercises] Pushed: {pushed}  Failed: {failed}"))
        return pushed, failed

    # ------------------------------------------------------------------
    # Quiz model
    # ------------------------------------------------------------------

    def _push_quizzes(self, conn, dry_run):
        rewritten_ids = set(
            EducationAuditLog.objects.filter(action__in=CONTENT_ACTIONS, target_type="Quiz")
            .order_by()
            .values_list("target_id", flat=True)
            .distinct()
        )

        # Checkpoint quizzes are materialized copies of a lesson section, kept in
        # step by resync_quiz_from_section. They carry no audit row of their
        # own, so pull them in via the sections that do — otherwise production
        # keeps the pre-rebalance option order in the checkpoint modal while the
        # in-lesson check shows the new one.
        touched_sections = EducationAuditLog.objects.filter(
            action__in=CONTENT_ACTIONS, target_type="LessonSection"
        ).values_list("target_id", flat=True)
        rewritten_ids |= set(
            Quiz.objects.filter(source_lesson_section_id__in=touched_sections).values_list(
                "id", flat=True
            )
        )
        rewritten_ids = sorted(rewritten_ids)

        if not rewritten_ids:
            self.stdout.write("  [quizzes] No rewritten quizzes in audit log.")
            return 0, 0

        quizzes = Quiz.objects.filter(id__in=rewritten_ids)
        quiz_map = {q.id: q for q in quizzes}

        self.stdout.write(f"\n[quizzes] Found {len(rewritten_ids)} rewritten quizzes.")

        if dry_run:
            self.stdout.write(f"  Would push {len(rewritten_ids)} quizzes.")
            return len(rewritten_ids), 0

        pushed = 0
        failed = 0

        with conn.cursor() as cur:
            for qid in rewritten_ids:
                quiz = quiz_map.get(qid)
                if not quiz:
                    self.stderr.write(
                        self.style.WARNING(f"  Quiz {qid}: not in local DB — skipping.")
                    )
                    failed += 1
                    continue

                try:
                    cur.execute(
                        "UPDATE core_quiz SET question = %s, choices = %s, correct_answer = %s WHERE id = %s",
                        (
                            quiz.question,
                            json.dumps(quiz.choices),
                            quiz.correct_answer,
                            qid,
                        ),
                    )
                    cur.execute(
                        "UPDATE education_quiz_translation SET question = '', choices = %s, correct_answer = '' WHERE quiz_id = %s",
                        (json.dumps([]), qid),
                    )
                    conn.commit()
                    pushed += 1
                    self.stdout.write(f"  ✓ quiz #{qid} — {quiz.question[:60]}")

                except Exception as exc:
                    self.stderr.write(self.style.ERROR(f"  ✗ quiz #{qid}: {exc}"))
                    failed += 1
                    conn.rollback()

        self.stdout.write(self.style.SUCCESS(f"  [quizzes] Pushed: {pushed}  Failed: {failed}"))
        return pushed, failed

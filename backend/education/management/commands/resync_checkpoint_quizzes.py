"""
Rebuild lesson checkpoint quizzes from the sections they were materialized from.

A checkpoint ``Quiz`` is a denormalized copy of a multiple-choice
``LessonSection``. ``get_or_create_quiz_from_mc_section`` only fills it on
creation, so any later edit to the section — an AI rewrite, an option reshuffle,
a hand fix — left the checkpoint modal asking the old question with the old
option order. ``resync_quiz_from_section`` keeps them in step going forward;
this command repairs whatever drifted before that existed.

It also reports checkpoints whose source section is no longer multiple-choice.
Those are dead: nothing rebuilds them, and the endpoint already filters them out
of what learners see. They are reported rather than deleted, because deleting a
Quiz cascades its ``QuizCompletion`` rows.

    python manage.py resync_checkpoint_quizzes --dry-run
    python manage.py resync_checkpoint_quizzes
    docker compose exec -e RAILWAY_DB_URL="<DATABASE_PUBLIC_URL>" backend \\
        python manage.py resync_checkpoint_quizzes --railway --dry-run
"""

from __future__ import annotations

import json
import os
import re

from django.core.management.base import BaseCommand, CommandError

from education.models import Quiz
from education.services.checkpoint_quizzes import resync_quiz_from_section

_HTML_TAG_RE = re.compile(r"<[^>]+>")


def _strip_html(text: str) -> str:
    return " ".join(_HTML_TAG_RE.sub(" ", text or "").split()).strip()


class Command(BaseCommand):
    help = "Rebuild checkpoint quizzes from their source lesson sections."

    def add_arguments(self, parser):
        parser.add_argument("--dry-run", action="store_true")
        parser.add_argument(
            "--railway",
            action="store_true",
            help="Operate on the Railway DB named by RAILWAY_DB_URL instead of the local one.",
        )

    def handle(self, *args, **options):
        if options["railway"]:
            self._run_railway(options["dry_run"])
        else:
            self._run_local(options["dry_run"])

    # ------------------------------------------------------------------

    def _run_local(self, dry_run: bool):
        rows = Quiz.objects.filter(source_lesson_section__isnull=False).select_related(
            "source_lesson_section"
        )
        resynced = orphans = 0
        for quiz in rows:
            section = quiz.source_lesson_section
            if section.exercise_type != "multiple-choice":
                orphans += 1
                self.stdout.write(
                    self.style.WARNING(
                        f"  quiz {quiz.id}: section {section.id} is now "
                        f"{section.exercise_type or 'not an exercise'} — orphaned"
                    )
                )
                continue
            if dry_run:
                resynced += 1
                continue
            note = resync_quiz_from_section(section)
            if note:
                self.stdout.write(self.style.WARNING(f"  {note}"))
            resynced += 1
        verb = "would resync" if dry_run else "resynced"
        self.stdout.write(self.style.SUCCESS(f"{verb} {resynced} checkpoint quiz(zes)"))
        if orphans:
            self.stdout.write(self.style.WARNING(f"  {orphans} orphaned (left in place)"))

    # ------------------------------------------------------------------

    def _run_railway(self, dry_run: bool):
        import psycopg2
        import psycopg2.extras

        url = os.environ.get("RAILWAY_DB_URL", "").strip()
        if not url:
            raise CommandError("RAILWAY_DB_URL not set.")

        conn = psycopg2.connect(url)
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

        def as_json(value, default):
            if isinstance(value, str):
                try:
                    return json.loads(value)
                except ValueError:
                    return default
            return default if value is None else value

        resynced = orphans = unchanged = 0
        try:
            cur.execute(
                "SELECT q.id AS qid, q.question, q.choices, q.correct_answer, "
                "       s.id AS sid, s.title, s.exercise_type, s.exercise_data "
                "FROM core_quiz q JOIN core_lessonsection s ON s.id = q.source_lesson_section_id"
            )
            for row in cur.fetchall():
                if row["exercise_type"] != "multiple-choice":
                    orphans += 1
                    self.stdout.write(
                        self.style.WARNING(
                            f"  quiz {row['qid']}: section {row['sid']} is now "
                            f"{row['exercise_type'] or 'not an exercise'} — orphaned"
                        )
                    )
                    continue

                data = as_json(row["exercise_data"], {})
                options, seen = [], set()
                for raw in data.get("options") or []:
                    text = _strip_html(str(raw))[:500]
                    if text and text not in seen:
                        seen.add(text)
                        options.append(text)
                idx = data.get("correctAnswer")
                if len(options) < 2 or not isinstance(idx, int) or not 0 <= idx < len(options):
                    self.stdout.write(
                        self.style.WARNING(
                            f"  quiz {row['qid']}: section {row['sid']} has no usable "
                            "options/correctAnswer — skipped"
                        )
                    )
                    continue

                question = _strip_html(str(data.get("question") or row["title"] or ""))[:2000]
                old = as_json(row["choices"], []) or []
                choices = []
                for i, text in enumerate(options):
                    base = old[i] if i < len(old) and isinstance(old[i], dict) else {}
                    choices.append({**base, "text": text})
                correct = options[idx][:200]

                current = [c.get("text") for c in old if isinstance(c, dict)]
                if current == options and row["correct_answer"] == correct:
                    unchanged += 1
                    continue

                self.stdout.write(f"  quiz {row['qid']} <- section {row['sid']}: rebuilt")
                if not dry_run:
                    cur.execute(
                        "UPDATE core_quiz SET question = %s, choices = %s, correct_answer = %s "
                        "WHERE id = %s",
                        (question, json.dumps(choices), correct, row["qid"]),
                    )
                    cur.execute(
                        "UPDATE education_quiz_translation "
                        "SET choices = '[]', correct_answer = '' WHERE quiz_id = %s",
                        (row["qid"],),
                    )
                resynced += 1

            if dry_run:
                conn.rollback()
                self.stdout.write(
                    self.style.WARNING(
                        f"\nDry run — rolled back. {resynced} would rebuild, "
                        f"{unchanged} already in step, {orphans} orphaned."
                    )
                )
            else:
                conn.commit()
                self.stdout.write(
                    self.style.SUCCESS(
                        f"\nRebuilt {resynced} checkpoint quiz(zes) on Railway; "
                        f"{unchanged} already in step, {orphans} orphaned."
                    )
                )
        except Exception:
            conn.rollback()
            raise
        finally:
            conn.close()

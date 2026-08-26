"""
Apply hand-written multiple-choice option rewrites, locally or straight to Railway.

The AI path (``rewrite_standalone_exercises``) needs OpenAI credits. This one
takes the same shape of edit from a JSON file a human wrote and applies it
through the identical gates, so hand-written content is never held to a lower
standard than generated content.

``--railway`` exists because ``push_rewrites_to_railway`` can only UPDATE rows
that also exist locally, and production has drifted: some sections and exercises
live only there. Those rows are unreachable by the normal push and need a
targeted, validated edit rather than ad-hoc SQL.

Input file: a list of objects

    {"kind": "section"|"exercise"|"quiz", "id": 123,
     "question": "...",                 # optional, keeps the existing one if absent
     "options": ["...", "...", "...", "..."],
     "correct": 2}

Every record is validated with ``education.exercise_quality.length_problem``
before anything is written; one bad record aborts the whole run. A row that does
not exist at the target is reported and counted as a failure rather than
silently skipped — the push command's habit of counting no-op UPDATEs as
successes is how four missing sections went unnoticed.

    python manage.py apply_manual_option_rewrites --file rewrites.json --dry-run
    python manage.py apply_manual_option_rewrites --file rewrites.json
    docker compose exec -e RAILWAY_DB_URL="<DATABASE_PUBLIC_URL>" backend \
        python manage.py apply_manual_option_rewrites --file rewrites.json --railway --dry-run
"""

from __future__ import annotations

import json
import os
from pathlib import Path

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from education.exercise_quality import length_problem
from education.models import EducationAuditLog, Exercise, ExerciseTranslation, Quiz, QuizTranslation


class Command(BaseCommand):
    help = "Apply hand-written multiple-choice option rewrites from a JSON file."

    def add_arguments(self, parser):
        parser.add_argument("--file", required=True, metavar="PATH")
        parser.add_argument("--dry-run", action="store_true")
        parser.add_argument(
            "--railway",
            action="store_true",
            help="Write to the Railway DB named by RAILWAY_DB_URL instead of the local one.",
        )

    def handle(self, *args, **options):
        path = Path(options["file"])
        if not path.exists():
            raise CommandError(f"File not found: {path}")
        records = json.loads(path.read_text(encoding="utf-8"))
        if not isinstance(records, list):
            raise CommandError("File must contain a JSON list.")

        # Validate everything first — a half-applied batch is worse than none.
        problems = []
        for r in records:
            rid, kind = r.get("id"), r.get("kind")
            opts = r.get("options")
            correct = r.get("correct")
            if kind not in ("section", "exercise", "quiz") or not isinstance(rid, int):
                problems.append(f"{kind}:{rid} — bad kind or id")
                continue
            if (
                not isinstance(opts, list)
                or len(opts) != 4
                or not all(isinstance(o, str) for o in opts)
            ):
                problems.append(f"{kind}:{rid} — options must be 4 strings")
                continue
            if not isinstance(correct, int) or isinstance(correct, bool) or not 0 <= correct < 4:
                problems.append(f"{kind}:{rid} — correct must be 0-3")
                continue
            stripped = [o.strip() for o in opts]
            if len(set(stripped)) != 4:
                problems.append(f"{kind}:{rid} — options must all be different")
                continue
            gate = length_problem(stripped, correct)
            if gate:
                problems.append(f"{kind}:{rid} — {gate}")

        if problems:
            self.stderr.write(self.style.ERROR(f"{len(problems)} record(s) rejected:"))
            for p in problems:
                self.stderr.write(f"  {p}")
            raise CommandError("Nothing applied.")

        self.stdout.write(self.style.SUCCESS(f"All {len(records)} records pass the gate."))

        if options["railway"]:
            self._apply_railway(records, options["dry_run"])
            return

        if options["dry_run"]:
            self.stdout.write(self.style.WARNING("Dry run — nothing written."))
            return

        applied = collisions = 0
        for r in records:
            with transaction.atomic():
                if r["kind"] == "exercise":
                    applied += self._apply_exercise(r)
                elif r["kind"] == "section":
                    applied += self._apply_section(r)
                else:
                    ok, clash = self._apply_quiz(r)
                    applied += ok
                    collisions += clash
        self.stdout.write(self.style.SUCCESS(f"Applied {applied} record(s)."))
        if collisions:
            self.stdout.write(self.style.WARNING(f"  {collisions} quiz translation(s) blanked."))

    # ------------------------------------------------------------------

    def _apply_section(self, r) -> int:
        from education.models import LessonSection, LessonSectionTranslation
        from education.services.checkpoint_quizzes import resync_quiz_from_section

        section = LessonSection.objects.filter(id=r["id"]).first()
        if section is None:
            self.stderr.write(self.style.WARNING(f"  section {r['id']} not found — skipped"))
            return 0
        data = dict(section.exercise_data or {})
        data["options"] = r["options"]
        data["correctAnswer"] = r["correct"]
        data.pop("correct_answer", None)
        if r.get("question"):
            data["question"] = r["question"]
        if r.get("explanation"):
            data["explanation"] = r["explanation"]
        section.exercise_data = data
        section.save(update_fields=["exercise_data"])
        LessonSectionTranslation.objects.filter(section=section).update(
            exercise_data=None, source_hash=""
        )
        resync_quiz_from_section(section)
        EducationAuditLog.objects.create(
            user=None,
            action="ai_rewrite",
            target_type="LessonSection",
            target_id=section.id,
            metadata={"model": "manual", "content_type": "exercise"},
        )
        return 1

    # ------------------------------------------------------------------

    def _apply_exercise(self, r) -> int:
        from education.management.commands.rebalance_catalog_answer_positions import (
            sync_choice_rows,
        )

        ex = Exercise.objects.filter(id=r["id"]).first()
        if ex is None:
            self.stderr.write(self.style.WARNING(f"  exercise {r['id']} not found — skipped"))
            return 0
        data = dict(ex.exercise_data or {})
        data["options"] = r["options"]
        # Exercise.correct_answer is the field the submit endpoint grades on;
        # the shadow copy inside exercise_data must not come back.
        data.pop("correctAnswer", None)
        data.pop("correct_answer", None)
        if r.get("explanation"):
            data["explanation"] = r["explanation"]
        if r.get("question"):
            ex.question = r["question"]
        ex.exercise_data = data
        ex.correct_answer = r["correct"]
        ex.save(update_fields=["question", "exercise_data", "correct_answer"])
        sync_choice_rows(ex)

        # English changed, so any stored translation is stale.
        ExerciseTranslation.objects.filter(exercise=ex).update(exercise_data=None)

        EducationAuditLog.objects.create(
            user=None,
            action="ai_rewrite",
            target_type="Exercise",
            target_id=ex.id,
            metadata={"model": "manual", "content_type": "multiple-choice"},
        )
        return 1

    def _apply_quiz(self, r) -> tuple[int, int]:
        quiz = Quiz.objects.filter(id=r["id"]).first()
        if quiz is None:
            self.stderr.write(self.style.WARNING(f"  quiz {r['id']} not found — skipped"))
            return 0, 0
        if quiz.source_lesson_section_id is not None:
            self.stderr.write(
                self.style.WARNING(
                    f"  quiz {r['id']} is a lesson checkpoint — skipped "
                    "(it mirrors a section; rewrite the section instead)"
                )
            )
            return 0, 0
        old = quiz.choices or []
        new_choices = []
        for i, text in enumerate(r["options"]):
            base = old[i] if i < len(old) and isinstance(old[i], dict) else {}
            new_choices.append({**base, "text": text})
        quiz.choices = new_choices
        quiz.correct_answer = r["options"][r["correct"]][:200]
        if r.get("question"):
            quiz.question = r["question"]
        quiz.save(update_fields=["question", "choices", "correct_answer"])

        clash = 0
        for qt in QuizTranslation.objects.filter(quiz=quiz):
            qt.choices = []
            qt.correct_answer = ""
            qt.save(update_fields=["choices", "correct_answer"])
            clash += 1

        EducationAuditLog.objects.create(
            user=None,
            action="ai_rewrite",
            target_type="Quiz",
            target_id=quiz.id,
            metadata={"model": "manual", "content_type": "quiz"},
        )
        return 1, clash

    # ------------------------------------------------------------------
    # Railway
    # ------------------------------------------------------------------

    def _apply_railway(self, records, dry_run: bool):
        """
        Apply the same validated records straight to the Railway database.

        Every statement checks how many rows it matched. A row that does not
        exist there is a failure, not a silent success.
        """
        import psycopg2

        url = os.environ.get("RAILWAY_DB_URL", "").strip()
        if not url:
            raise CommandError(
                "RAILWAY_DB_URL not set. Run with:\n"
                '  docker compose exec -e RAILWAY_DB_URL="<DATABASE_PUBLIC_URL>" backend \\\n'
                "      python manage.py apply_manual_option_rewrites --file ... --railway"
            )

        conn = psycopg2.connect(url)
        cur = conn.cursor()

        def as_dict(value):
            if isinstance(value, str):
                try:
                    return json.loads(value)
                except ValueError:
                    return {}
            return value or {}

        applied = missing = 0
        try:
            for r in records:
                rid, kind = r["id"], r["kind"]
                if kind == "section":
                    cur.execute(
                        "SELECT exercise_data FROM core_lessonsection WHERE id = %s", (rid,)
                    )
                    row = cur.fetchone()
                    if row is None:
                        self.stderr.write(
                            self.style.WARNING(f"  section {rid}: not in Railway — skipped")
                        )
                        missing += 1
                        continue
                    data = as_dict(row[0])
                    was = None
                    opts = data.get("options") or []
                    idx = data.get("correctAnswer")
                    if isinstance(idx, int) and 0 <= idx < len(opts):
                        was = str(opts[idx])
                    data["options"] = r["options"]
                    data["correctAnswer"] = r["correct"]
                    data.pop("correct_answer", None)
                    if r.get("question"):
                        data["question"] = r["question"]
                    cur.execute(
                        "UPDATE core_lessonsection SET exercise_data = %s WHERE id = %s",
                        (json.dumps(data), rid),
                    )
                    cur.execute(
                        "UPDATE education_lessonsection_translation "
                        "SET exercise_data = NULL, source_hash = '' WHERE section_id = %s",
                        (rid,),
                    )
                    now = r["options"][r["correct"]]
                    if was is not None and was != now:
                        self.stdout.write(f"  section {rid}: was marking {was!r}")
                        self.stdout.write(f"              now marks {now!r}")
                    else:
                        self.stdout.write(f"  section {rid}: options rebalanced")

                elif kind == "exercise":
                    cur.execute("SELECT exercise_data FROM core_exercise WHERE id = %s", (rid,))
                    row = cur.fetchone()
                    if row is None:
                        self.stderr.write(
                            self.style.WARNING(f"  exercise {rid}: not in Railway — skipped")
                        )
                        missing += 1
                        continue
                    data = as_dict(row[0])
                    data["options"] = r["options"]
                    data.pop("correctAnswer", None)
                    data.pop("correct_answer", None)
                    cur.execute(
                        "UPDATE core_exercise SET exercise_data = %s, correct_answer = %s "
                        "WHERE id = %s",
                        (json.dumps(data), json.dumps(r["correct"]), rid),
                    )
                    # Keep the admin's write-back source faithful, same as locally.
                    cur.execute(
                        "DELETE FROM core_multiplechoicechoice WHERE exercise_id = %s", (rid,)
                    )
                    for i, text in enumerate(r["options"]):
                        cur.execute(
                            "INSERT INTO core_multiplechoicechoice "
                            '(exercise_id, "order", text, is_correct, explanation) '
                            "VALUES (%s, %s, %s, %s, '')",
                            (rid, i, text, i == r["correct"]),
                        )
                    self.stdout.write(f"  exercise {rid}: options rebalanced")

                else:  # quiz
                    cur.execute("SELECT choices FROM core_quiz WHERE id = %s", (rid,))
                    row = cur.fetchone()
                    if row is None:
                        self.stderr.write(
                            self.style.WARNING(f"  quiz {rid}: not in Railway — skipped")
                        )
                        missing += 1
                        continue
                    old = as_dict(row[0]) if isinstance(row[0], dict) else (row[0] or [])
                    if isinstance(old, str):
                        old = json.loads(old)
                    choices = []
                    for i, text in enumerate(r["options"]):
                        base = old[i] if i < len(old) and isinstance(old[i], dict) else {}
                        choices.append({**base, "text": text})
                    cur.execute(
                        "UPDATE core_quiz SET choices = %s, correct_answer = %s WHERE id = %s",
                        (json.dumps(choices), r["options"][r["correct"]][:200], rid),
                    )
                    cur.execute(
                        "UPDATE education_quiz_translation "
                        "SET choices = '[]', correct_answer = '' WHERE quiz_id = %s",
                        (rid,),
                    )
                    self.stdout.write(f"  quiz {rid}: options rebalanced")

                applied += 1

            if dry_run:
                conn.rollback()
                self.stdout.write(
                    self.style.WARNING(
                        f"\nDry run — rolled back. {applied} would apply, {missing} missing."
                    )
                )
            else:
                conn.commit()
                self.stdout.write(self.style.SUCCESS(f"\nApplied {applied} record(s) to Railway."))
                if missing:
                    self.stdout.write(self.style.WARNING(f"  {missing} not present there."))
        except Exception:
            conn.rollback()
            raise
        finally:
            conn.close()

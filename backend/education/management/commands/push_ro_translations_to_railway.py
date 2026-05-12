"""
Push Romanian (ro) curriculum translations from the local Docker DB to Railway PostgreSQL.

Uses natural keys (parent FK + language), not translation row PKs, so local and Railway
translation `id` values may differ.

Pushes: path/course/lesson/lesson-section translations and **standalone** ``ExerciseTranslation``
rows (practice catalog). Does not push ``QuizTranslation`` (course quizzes / checkpoints).

Usage:
    docker compose exec -e RAILWAY_DB_URL="<DATABASE_PUBLIC_URL>" backend \\
        python manage.py push_ro_translations_to_railway [--dry-run] [--target all]

Or: bash backend/scripts/push_ro_translations_to_railway.sh [--dry-run]
"""

from __future__ import annotations

import json
import os
from typing import Any, Tuple

import psycopg2
from django.core.management.base import BaseCommand, CommandError
from django.db.models import QuerySet
from psycopg2.extras import Json

from education.models import (
    CourseTranslation,
    ExerciseTranslation,
    LessonSectionTranslation,
    LessonTranslation,
    PathTranslation,
)

LANGUAGE_CODE = "ro"

PARENT_TABLES = {
    "path": "core_path",
    "course": "core_course",
    "lesson": "core_lesson",
    "section": "core_lessonsection",
    "exercise": "core_exercise",
}


class Command(BaseCommand):
    help = (
        "Push Romanian translation rows from local DB to Railway (upsert by parent id + language)."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Show counts and sample operations without writing to Railway.",
        )
        parser.add_argument(
            "--target",
            choices=[
                "paths",
                "courses",
                "lessons",
                "sections",
                "standalone_exercises",
                "all",
            ],
            default="all",
            help=(
                "Which translation tables to push (default: all). "
                "Order: path→course→lesson→section→standalone_exercises."
            ),
        )

    def handle(self, *args, **options):
        railway_url = os.environ.get("RAILWAY_DB_URL")
        if not railway_url:
            raise CommandError(
                "RAILWAY_DB_URL env var not set.\n"
                "Run: docker compose exec -e RAILWAY_DB_URL='<url>' backend "
                "python manage.py push_ro_translations_to_railway\n"
                "Get the URL from: Railway dashboard → PostgreSQL service → Variables → DATABASE_PUBLIC_URL"
            )

        dry_run = options["dry_run"]
        target = options["target"]

        if dry_run:
            self.stdout.write(self.style.WARNING("DRY RUN — no writes to Railway."))

        try:
            conn = psycopg2.connect(railway_url, sslmode="require")
        except Exception as exc:
            raise CommandError(f"Could not connect to Railway DB: {exc}") from exc

        total_pushed = 0
        total_failed = 0

        try:
            if target in ("paths", "all"):
                p, f = self._push_paths(conn, dry_run)
                total_pushed += p
                total_failed += f
            if target in ("courses", "all"):
                p, f = self._push_courses(conn, dry_run)
                total_pushed += p
                total_failed += f
            if target in ("lessons", "all"):
                p, f = self._push_lessons(conn, dry_run)
                total_pushed += p
                total_failed += f
            if target in ("sections", "all"):
                p, f = self._push_sections(conn, dry_run)
                total_pushed += p
                total_failed += f
            if target in ("standalone_exercises", "all"):
                p, f = self._push_standalone_exercises(conn, dry_run)
                total_pushed += p
                total_failed += f
        finally:
            conn.close()

        self.stdout.write(
            self.style.SUCCESS(f"\nTotal pushed: {total_pushed}  Failed: {total_failed}")
        )
        if total_failed:
            self.stderr.write(
                self.style.WARNING("Some records failed — check errors above and re-run.")
            )

    def _parent_exists(self, cur, kind: str, pk: int) -> bool:
        table = PARENT_TABLES[kind]
        cur.execute(f"SELECT 1 FROM {table} WHERE id = %s", (pk,))
        return cur.fetchone() is not None

    def _push_paths(self, conn, dry_run: bool) -> Tuple[int, int]:
        qs: QuerySet[PathTranslation] = PathTranslation.objects.filter(
            language=LANGUAGE_CODE
        ).order_by("path_id")
        rows = list(qs.values("path_id", "title", "description", "source_hash"))
        self.stdout.write(f"\n[paths] Local ro rows: {len(rows)}")
        if not rows:
            return 0, 0
        if dry_run:
            return len(rows), 0

        pushed, failed = 0, 0
        with conn.cursor() as cur:
            for r in rows:
                pid = r["path_id"]
                try:
                    if not self._parent_exists(cur, "path", pid):
                        self.stderr.write(
                            self.style.WARNING(
                                f"  path translation path_id={pid}: parent missing on Railway — skip"
                            )
                        )
                        failed += 1
                        continue
                    cur.execute(
                        """
                        UPDATE education_path_translation
                        SET title = %s, description = %s, source_hash = %s
                        WHERE path_id = %s AND language = %s
                        """,
                        (r["title"], r["description"], r["source_hash"] or "", pid, LANGUAGE_CODE),
                    )
                    if cur.rowcount == 0:
                        cur.execute(
                            """
                            INSERT INTO education_path_translation
                                (path_id, language, title, description, source_hash)
                            VALUES (%s, %s, %s, %s, %s)
                            """,
                            (
                                pid,
                                LANGUAGE_CODE,
                                r["title"],
                                r["description"],
                                r["source_hash"] or "",
                            ),
                        )
                    conn.commit()
                    pushed += 1
                    self.stdout.write(f"  ✓ path #{pid} — {r['title'][:60]}")
                except Exception as exc:
                    self.stderr.write(self.style.ERROR(f"  ✗ path #{pid}: {exc}"))
                    failed += 1
                    conn.rollback()
        self.stdout.write(self.style.SUCCESS(f"  [paths] Pushed: {pushed}  Failed: {failed}"))
        return pushed, failed

    def _push_courses(self, conn, dry_run: bool) -> Tuple[int, int]:
        qs = CourseTranslation.objects.filter(language=LANGUAGE_CODE).order_by("course_id")
        rows = list(qs.values("course_id", "title", "description", "source_hash"))
        self.stdout.write(f"\n[courses] Local ro rows: {len(rows)}")
        if not rows:
            return 0, 0
        if dry_run:
            return len(rows), 0

        pushed, failed = 0, 0
        with conn.cursor() as cur:
            for r in rows:
                cid = r["course_id"]
                try:
                    if not self._parent_exists(cur, "course", cid):
                        self.stderr.write(
                            self.style.WARNING(
                                f"  course translation course_id={cid}: parent missing on Railway — skip"
                            )
                        )
                        failed += 1
                        continue
                    cur.execute(
                        """
                        UPDATE education_course_translation
                        SET title = %s, description = %s, source_hash = %s
                        WHERE course_id = %s AND language = %s
                        """,
                        (r["title"], r["description"], r["source_hash"] or "", cid, LANGUAGE_CODE),
                    )
                    if cur.rowcount == 0:
                        cur.execute(
                            """
                            INSERT INTO education_course_translation
                                (course_id, language, title, description, source_hash)
                            VALUES (%s, %s, %s, %s, %s)
                            """,
                            (
                                cid,
                                LANGUAGE_CODE,
                                r["title"],
                                r["description"],
                                r["source_hash"] or "",
                            ),
                        )
                    conn.commit()
                    pushed += 1
                    self.stdout.write(f"  ✓ course #{cid} — {r['title'][:60]}")
                except Exception as exc:
                    self.stderr.write(self.style.ERROR(f"  ✗ course #{cid}: {exc}"))
                    failed += 1
                    conn.rollback()
        self.stdout.write(self.style.SUCCESS(f"  [courses] Pushed: {pushed}  Failed: {failed}"))
        return pushed, failed

    def _push_lessons(self, conn, dry_run: bool) -> Tuple[int, int]:
        qs = LessonTranslation.objects.filter(language=LANGUAGE_CODE).order_by("lesson_id")
        rows = list(
            qs.values(
                "lesson_id",
                "title",
                "short_description",
                "detailed_content",
                "source_hash",
            )
        )
        self.stdout.write(f"\n[lessons] Local ro rows: {len(rows)}")
        if not rows:
            return 0, 0
        if dry_run:
            return len(rows), 0

        pushed, failed = 0, 0
        with conn.cursor() as cur:
            for r in rows:
                lid = r["lesson_id"]
                try:
                    if not self._parent_exists(cur, "lesson", lid):
                        self.stderr.write(
                            self.style.WARNING(
                                f"  lesson translation lesson_id={lid}: parent missing on Railway — skip"
                            )
                        )
                        failed += 1
                        continue
                    cur.execute(
                        """
                        UPDATE education_lesson_translation
                        SET title = %s, short_description = %s, detailed_content = %s, source_hash = %s
                        WHERE lesson_id = %s AND language = %s
                        """,
                        (
                            r["title"],
                            r["short_description"] or "",
                            r["detailed_content"] or "",
                            r["source_hash"] or "",
                            lid,
                            LANGUAGE_CODE,
                        ),
                    )
                    if cur.rowcount == 0:
                        cur.execute(
                            """
                            INSERT INTO education_lesson_translation
                                (lesson_id, language, title, short_description, detailed_content, source_hash)
                            VALUES (%s, %s, %s, %s, %s, %s)
                            """,
                            (
                                lid,
                                LANGUAGE_CODE,
                                r["title"],
                                r["short_description"] or "",
                                r["detailed_content"] or "",
                                r["source_hash"] or "",
                            ),
                        )
                    conn.commit()
                    pushed += 1
                    self.stdout.write(f"  ✓ lesson #{lid} — {r['title'][:60]}")
                except Exception as exc:
                    self.stderr.write(self.style.ERROR(f"  ✗ lesson #{lid}: {exc}"))
                    failed += 1
                    conn.rollback()
        self.stdout.write(self.style.SUCCESS(f"  [lessons] Pushed: {pushed}  Failed: {failed}"))
        return pushed, failed

    def _json_or_none(self, value: Any) -> Any:
        if value is None:
            return None
        if isinstance(value, dict):
            return Json(value)
        if isinstance(value, str):
            try:
                parsed = json.loads(value)
                return Json(parsed) if isinstance(parsed, dict) else Json({})
            except json.JSONDecodeError:
                return Json({})
        return Json({})

    def _push_sections(self, conn, dry_run: bool) -> Tuple[int, int]:
        qs = LessonSectionTranslation.objects.filter(language=LANGUAGE_CODE).order_by("section_id")
        rows = list(
            qs.values("section_id", "title", "text_content", "exercise_data", "source_hash")
        )
        self.stdout.write(f"\n[sections] Local ro rows: {len(rows)}")
        if not rows:
            return 0, 0
        if dry_run:
            return len(rows), 0

        pushed, failed = 0, 0
        with conn.cursor() as cur:
            for r in rows:
                sid = r["section_id"]
                try:
                    if not self._parent_exists(cur, "section", sid):
                        self.stderr.write(
                            self.style.WARNING(
                                f"  section translation section_id={sid}: parent missing on Railway — skip"
                            )
                        )
                        failed += 1
                        continue
                    ex = self._json_or_none(r["exercise_data"])
                    cur.execute(
                        """
                        UPDATE education_lessonsection_translation
                        SET title = %s, text_content = %s, exercise_data = %s, source_hash = %s
                        WHERE section_id = %s AND language = %s
                        """,
                        (
                            r["title"],
                            r["text_content"],
                            ex,
                            r["source_hash"] or "",
                            sid,
                            LANGUAGE_CODE,
                        ),
                    )
                    if cur.rowcount == 0:
                        cur.execute(
                            """
                            INSERT INTO education_lessonsection_translation
                                (section_id, language, title, text_content, exercise_data, source_hash)
                            VALUES (%s, %s, %s, %s, %s, %s)
                            """,
                            (
                                sid,
                                LANGUAGE_CODE,
                                r["title"],
                                r["text_content"],
                                ex,
                                r["source_hash"] or "",
                            ),
                        )
                    conn.commit()
                    pushed += 1
                    self.stdout.write(f"  ✓ section #{sid} — {r['title'][:60]}")
                except Exception as exc:
                    self.stderr.write(self.style.ERROR(f"  ✗ section #{sid}: {exc}"))
                    failed += 1
                    conn.rollback()
        self.stdout.write(self.style.SUCCESS(f"  [sections] Pushed: {pushed}  Failed: {failed}"))
        return pushed, failed

    def _push_standalone_exercises(self, conn, dry_run: bool) -> Tuple[int, int]:
        qs = ExerciseTranslation.objects.filter(language=LANGUAGE_CODE).order_by("exercise_id")
        rows = list(qs.values("exercise_id", "question", "exercise_data"))
        self.stdout.write(f"\n[standalone_exercises] Local ro rows: {len(rows)}")
        if not rows:
            return 0, 0
        if dry_run:
            return len(rows), 0

        pushed, failed = 0, 0
        with conn.cursor() as cur:
            for r in rows:
                eid = r["exercise_id"]
                try:
                    if not self._parent_exists(cur, "exercise", eid):
                        self.stderr.write(
                            self.style.WARNING(
                                f"  exercise translation exercise_id={eid}: parent missing on Railway — skip"
                            )
                        )
                        failed += 1
                        continue
                    ex = self._json_or_none(r["exercise_data"])
                    cur.execute(
                        """
                        UPDATE education_exercise_translation
                        SET question = %s, exercise_data = %s
                        WHERE exercise_id = %s AND language = %s
                        """,
                        (r["question"], ex, eid, LANGUAGE_CODE),
                    )
                    if cur.rowcount == 0:
                        cur.execute(
                            """
                            INSERT INTO education_exercise_translation
                                (exercise_id, language, question, exercise_data)
                            VALUES (%s, %s, %s, %s)
                            """,
                            (eid, LANGUAGE_CODE, r["question"], ex),
                        )
                    conn.commit()
                    pushed += 1
                    self.stdout.write(f"  ✓ exercise translation #{eid}")
                except Exception as exc:
                    self.stderr.write(self.style.ERROR(f"  ✗ exercise translation #{eid}: {exc}"))
                    failed += 1
                    conn.rollback()
        self.stdout.write(
            self.style.SUCCESS(f"  [standalone_exercises] Pushed: {pushed}  Failed: {failed}")
        )
        return pushed, failed

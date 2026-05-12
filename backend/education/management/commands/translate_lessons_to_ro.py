"""
Translate backend education content (Paths, Courses, Lessons, LessonSections)
to Romanian using the configured translation provider (OpenAI by default).

Section types follow LessonSection.content_type: ``text``, ``exercise`` (multiple-choice
payload in ``exercise_data``), and ``video`` (intro copy in ``text_content``, URL on the
section). With ``--only-missing``, a section is skipped only when the existing ``ro`` row
fully covers the current English (including exercise option counts), so rows that exist
but were stripped (e.g. after ``push_rewrites_to_railway`` clearing ``exercise_data``) are
re-translated.

Usage examples:
    # Dry run – preview what would be translated
    python manage.py translate_lessons_to_ro --dry-run

    # Translate only missing entries (first backfill)
    python manage.py translate_lessons_to_ro --only-missing

    # Translate a small batch (5 lessons) for cost inspection
    python manage.py translate_lessons_to_ro --limit 5

    # Re-translate everything for a specific course
    python manage.py translate_lessons_to_ro --course-id 12 --force-refresh

    # Translate only paths and courses (skip lessons)
    python manage.py translate_lessons_to_ro --skip-lessons

    # Only backfill missing *text* section bodies (skip path/course/lesson strings; skip
    # exercise/video sections). Already-complete rows (matching source_hash) are not re-sent.
    python manage.py translate_lessons_to_ro --sections-only --section-types text --only-missing

Course quizzes / checkpoints use ``QuizTranslation`` and are not handled by this command.
"""

from __future__ import annotations

import hashlib
import html
import json
import logging
import re
import time
from typing import Any, Dict, List, Optional

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils.html import strip_tags

from education.models import (
    Course,
    CourseTranslation,
    Lesson,
    LessonSection,
    LessonSectionTranslation,
    LessonTranslation,
    Path,
    PathTranslation,
)
from education.services.translation import (
    OpenAIPaymentRequiredError,
    TranslationProvider,
    get_translator,
)

logger = logging.getLogger(__name__)

LANGUAGE_CODE = "ro"
BATCH_SIZE = 5


def _clean_html_to_text(value: Optional[str]) -> str:
    if not value:
        return ""
    text = strip_tags(str(value))
    text = html.unescape(text)
    text = re.sub(r"\s+", " ", text).strip()
    return text


def _source_hash(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()[:16]


class Command(BaseCommand):
    help = (
        "Generate Romanian (ro) translations for paths, courses, lessons, "
        "and lesson sections (text + exercises + video intros) via the configured "
        "translation provider. Use --sections-only and --section-types to limit scope."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Show what would be translated without writing to the database.",
        )
        parser.add_argument(
            "--limit",
            type=int,
            default=None,
            help="Maximum number of lessons to process.",
        )
        parser.add_argument(
            "--only-missing",
            action="store_true",
            help=(
                "Skip work that is already done for the current English source: paths/courses/"
                "lessons skip if any ro row exists; sections skip when the ro row matches "
                "(source_hash + exercise option parity, etc.). Safe to re-run."
            ),
        )
        parser.add_argument(
            "--force-refresh",
            action="store_true",
            help="Re-translate even if a Romanian translation already exists.",
        )
        parser.add_argument(
            "--path-id",
            type=int,
            default=None,
            help="Translate content under this specific path only.",
        )
        parser.add_argument(
            "--course-id",
            type=int,
            default=None,
            help="Translate content under this specific course only.",
        )
        parser.add_argument(
            "--lesson-id",
            type=int,
            default=None,
            help="Translate this specific lesson only.",
        )
        parser.add_argument(
            "--skip-lessons",
            action="store_true",
            help="Skip lesson/section translation (only translate paths & courses).",
        )
        parser.add_argument(
            "--sections-only",
            action="store_true",
            help=(
                "Skip paths, courses, and lesson-level fields; only create/update "
                "LessonSectionTranslation rows."
            ),
        )
        parser.add_argument(
            "--section-types",
            type=str,
            default=None,
            metavar="TYPES",
            help=(
                "Comma-separated section content_type values to translate: text, exercise, video. "
                "Default: all three. Example: --section-types text"
            ),
        )
        parser.add_argument(
            "--batch-size",
            type=int,
            default=BATCH_SIZE,
            help=f"Lessons per transaction batch (default {BATCH_SIZE}).",
        )

    def handle(self, *args, **options):
        self.dry_run: bool = options["dry_run"]
        self.limit: Optional[int] = options["limit"]
        self.only_missing: bool = options["only_missing"]
        self.force_refresh: bool = options["force_refresh"]
        self.path_id: Optional[int] = options["path_id"]
        self.course_id: Optional[int] = options["course_id"]
        self.lesson_id: Optional[int] = options["lesson_id"]
        self.skip_lessons: bool = options["skip_lessons"]
        self.sections_only: bool = options["sections_only"]
        self.section_types: Optional[set[str]] = self._parse_section_types(
            options.get("section_types")
        )
        self.batch_size: int = max(1, options["batch_size"])

        if self.skip_lessons and self.sections_only:
            raise CommandError("Cannot combine --skip-lessons with --sections-only.")

        self.translator: TranslationProvider = get_translator()
        self.stats: Dict[str, int] = {
            "paths_translated": 0,
            "courses_translated": 0,
            "lessons_translated": 0,
            "sections_translated": 0,
            "skipped": 0,
            "errors": 0,
        }

        if self.dry_run:
            self.stdout.write(self.style.NOTICE("DRY RUN – no changes will be saved.\n"))

        try:
            if not self.sections_only:
                self._translate_paths()
                self._translate_courses()

            if not self.skip_lessons:
                self._translate_lessons()
        except OpenAIPaymentRequiredError as e:
            raise CommandError(
                "OpenAI returned 402 Payment Required (credits exhausted or billing limit). "
                "Add credits in OpenAI billing and re-run this command to resume; "
                "already-translated items will be skipped."
            ) from e

        self._print_summary()

    # ------------------------------------------------------------------
    # Paths
    # ------------------------------------------------------------------
    def _translate_paths(self):
        qs = Path.objects.all().order_by("id")
        if self.path_id:
            qs = qs.filter(id=self.path_id)

        for path in qs:
            if self._should_skip(PathTranslation, "path", path):
                continue

            current_hash = _source_hash(f"{path.title}|{path.description}")
            if self._is_fresh(PathTranslation, "path", path, current_hash):
                self.stats["skipped"] += 1
                continue

            title_ro = self._safe_translate(path.title, {"field": "path_title"})
            desc_ro = self._safe_translate(path.description, {"field": "path_description"})

            if self.dry_run:
                self.stdout.write(f"[path] Would translate → {path.title}")
            else:
                PathTranslation.objects.update_or_create(
                    path=path,
                    language=LANGUAGE_CODE,
                    defaults={
                        "title": title_ro,
                        "description": desc_ro,
                        "source_hash": current_hash,
                    },
                )
            self.stats["paths_translated"] += 1

    # ------------------------------------------------------------------
    # Courses
    # ------------------------------------------------------------------
    def _translate_courses(self):
        qs = Course.objects.all().select_related("path").order_by("id")
        if self.path_id:
            qs = qs.filter(path_id=self.path_id)
        if self.course_id:
            qs = qs.filter(id=self.course_id)

        for course in qs:
            if self._should_skip(CourseTranslation, "course", course):
                continue

            current_hash = _source_hash(f"{course.title}|{course.description}")
            if self._is_fresh(CourseTranslation, "course", course, current_hash):
                self.stats["skipped"] += 1
                continue

            title_ro = self._safe_translate(course.title, {"field": "course_title"})
            desc_ro = self._safe_translate(course.description, {"field": "course_description"})

            if self.dry_run:
                self.stdout.write(f"[course] Would translate → {course.title}")
            else:
                CourseTranslation.objects.update_or_create(
                    course=course,
                    language=LANGUAGE_CODE,
                    defaults={
                        "title": title_ro,
                        "description": desc_ro,
                        "source_hash": current_hash,
                    },
                )
            self.stats["courses_translated"] += 1

    # ------------------------------------------------------------------
    # Lessons + sections
    # ------------------------------------------------------------------
    def _translate_lessons(self):
        qs = (
            Lesson.objects.all()
            .select_related("course", "course__path")
            .prefetch_related("sections", "translations", "sections__translations")
            .order_by("id")
        )
        if self.path_id:
            qs = qs.filter(course__path_id=self.path_id)
        if self.course_id:
            qs = qs.filter(course_id=self.course_id)
        if self.lesson_id:
            qs = qs.filter(id=self.lesson_id)
        if self.limit is not None and self.limit > 0:
            qs = qs[: self.limit]

        lessons = list(qs)
        total = len(lessons)
        self.stdout.write(f"Processing {total} lesson(s)...\n")

        for batch_start in range(0, total, self.batch_size):
            batch = lessons[batch_start : batch_start + self.batch_size]
            with transaction.atomic():
                for lesson in batch:
                    self._translate_one_lesson(lesson)

            done = min(batch_start + self.batch_size, total)
            self.stdout.write(f"  ... {done}/{total} lessons processed")

    @staticmethod
    def _parse_section_types(raw: Optional[str]) -> Optional[set[str]]:
        if raw is None or not str(raw).strip():
            return None
        allowed = {"text", "exercise", "video"}
        parts = {p.strip().lower() for p in str(raw).split(",") if p.strip()}
        unknown = parts - allowed
        if unknown:
            raise CommandError(
                f"Unknown --section-types values: {', '.join(sorted(unknown))}. "
                f"Use one or more of: {', '.join(sorted(allowed))}."
            )
        return parts or None

    def _translate_one_lesson(self, lesson: Lesson):
        course_title = lesson.course.title if lesson.course else ""
        lesson_ctx = {"course": course_title, "lesson": lesson.title}

        if not self.sections_only and not self._should_skip(LessonTranslation, "lesson", lesson):
            detail_clean = (
                _clean_html_to_text(lesson.detailed_content) if lesson.detailed_content else ""
            )
            lesson_source = f"{lesson.title}|{lesson.short_description or ''}|{detail_clean}"
            current_hash = _source_hash(lesson_source)

            if not self._is_fresh(LessonTranslation, "lesson", lesson, current_hash):
                payload = self._build_lesson_payload(lesson, lesson_ctx)
                if payload:
                    payload["source_hash"] = current_hash
                    if self.dry_run:
                        self.stdout.write(f"[lesson] Would translate → {lesson.title}")
                    else:
                        LessonTranslation.objects.update_or_create(
                            lesson=lesson,
                            language=LANGUAGE_CODE,
                            defaults=payload,
                        )
                    self.stats["lessons_translated"] += 1

        sections: List[LessonSection] = list(
            lesson.sections.order_by("order").prefetch_related("translations")
        )
        for section in sections:
            if self.section_types is not None and section.content_type not in self.section_types:
                continue
            section_hash = self._section_source_hash(section)
            ro_complete = self._section_translation_ro_complete(section)
            if self.only_missing and ro_complete and not self.force_refresh:
                self.stats["skipped"] += 1
                continue
            # source_hash can still match English even when exercise_data was cleared on the
            # translation row (e.g. push_rewrites_to_railway); do not skip on hash alone then.
            if ro_complete and self._is_fresh(
                LessonSectionTranslation, "section", section, section_hash
            ):
                self.stats["skipped"] += 1
                continue

            payload = self._build_section_payload(section, lesson_ctx)
            if not payload:
                continue

            payload["source_hash"] = section_hash
            if self.dry_run:
                self.stdout.write(
                    f"[section] Would translate → {lesson.title} / "
                    f"order={section.order} ({section.content_type})"
                )
            else:
                LessonSectionTranslation.objects.update_or_create(
                    section=section,
                    language=LANGUAGE_CODE,
                    defaults=payload,
                )
            self.stats["sections_translated"] += 1

    # ------------------------------------------------------------------
    # Payload builders
    # ------------------------------------------------------------------
    def _build_lesson_payload(
        self, lesson: Lesson, ctx: Dict[str, Any]
    ) -> Optional[Dict[str, Any]]:
        title = lesson.title or ""
        short = lesson.short_description or ""
        detail = _clean_html_to_text(lesson.detailed_content) if lesson.detailed_content else ""

        if not (title or short or detail):
            return None

        ro_title = self._safe_translate(title, {**ctx, "field": "lesson_title"})
        ro_short = self._safe_translate(short, {**ctx, "field": "lesson_short_description"})
        ro_detail = (
            self._safe_translate(detail, {**ctx, "field": "lesson_detailed_content"})
            if detail
            else ""
        )

        return {
            "title": ro_title,
            "short_description": ro_short,
            "detailed_content": ro_detail,
        }

    def _build_section_payload(
        self, section: LessonSection, ctx: Dict[str, Any]
    ) -> Optional[Dict[str, Any]]:
        payload: Dict[str, Any] = {}
        base_ctx = {**ctx, "section_order": section.order, "section_title": section.title}

        if section.title:
            payload["title"] = self._safe_translate(
                section.title, {**base_ctx, "field": "section_title"}
            )
        else:
            payload["title"] = ""

        if section.content_type == "text":
            source_text = _clean_html_to_text(section.text_content)
            if not source_text:
                return None
            payload["text_content"] = self._safe_translate(
                source_text, {**base_ctx, "field": "section_text_content"}
            )
            return payload

        if section.content_type == "exercise":
            data = section.exercise_data
            if not isinstance(data, dict):
                return None

            try:
                translated_data = self.translator.translate_exercise(data, base_ctx)
            except OpenAIPaymentRequiredError:
                raise
            except Exception as exc:
                logger.error("Failed to translate exercise section %s: %s", section.id, exc)
                self.stats["errors"] += 1
                return None

            payload["exercise_data"] = translated_data
            payload["text_content"] = None
            return payload

        if section.content_type == "video":
            source_text = _clean_html_to_text(section.text_content or "")
            if source_text:
                payload["text_content"] = self._safe_translate(
                    source_text, {**base_ctx, "field": "section_text_content"}
                )
            else:
                payload["text_content"] = None
            payload["exercise_data"] = None
            return payload

        return payload or None

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------
    def _should_skip(self, translation_model, fk_name: str, instance) -> bool:
        """Return True if this object should be skipped based on --only-missing."""
        if not self.only_missing:
            return False

        has_ro = translation_model.objects.filter(
            **{fk_name: instance, "language": LANGUAGE_CODE}
        ).exists()

        if has_ro:
            self.stats["skipped"] += 1
            return True

        return False

    def _is_fresh(self, translation_model, fk_name: str, instance, current_hash: str) -> bool:
        """Return True when the existing translation already matches the current source."""
        if self.force_refresh:
            return False
        existing = (
            translation_model.objects.filter(**{fk_name: instance, "language": LANGUAGE_CODE})
            .values_list("source_hash", flat=True)
            .first()
        )
        return existing == current_hash and bool(existing)

    def _section_translation_ro_complete(self, section: LessonSection) -> bool:
        """
        True when an ro row exists and its text / exercise_data / video intro matches
        current English structure (option counts, etc.).

        Important: ``source_hash`` alone can still match English after ``exercise_data`` was
        cleared on the row (same English JSON); callers must not treat ``_is_fresh`` as
        sufficient without this check.
        """
        tr = (
            LessonSectionTranslation.objects.filter(section=section, language=LANGUAGE_CODE)
            .only("text_content", "exercise_data", "source_hash")
            .first()
        )
        if not tr:
            return False

        if section.content_type == "text":
            src = _clean_html_to_text(section.text_content or "")
            if not src.strip():
                return True
            expected = self._section_source_hash(section)
            if (tr.source_hash or "") != expected:
                return False
            return bool((tr.text_content or "").strip())

        if section.content_type == "exercise":
            src_data = section.exercise_data if isinstance(section.exercise_data, dict) else {}
            src_opts = src_data.get("options") or []
            if not src_opts:
                return True
            tr_data = tr.exercise_data if isinstance(tr.exercise_data, dict) else {}
            tr_opts = tr_data.get("options") or []
            return len(src_opts) == len(tr_opts) and len(tr_opts) > 0

        if section.content_type == "video":
            src = _clean_html_to_text(section.text_content or "")
            if not src.strip():
                return True
            expected = self._section_source_hash(section)
            if (tr.source_hash or "") != expected:
                return False
            return bool((tr.text_content or "").strip())

        return True

    @staticmethod
    def _section_source_hash(section: LessonSection) -> str:
        parts = [section.title or ""]
        if section.content_type == "text":
            parts.append(_clean_html_to_text(section.text_content))
        elif section.content_type == "exercise" and isinstance(section.exercise_data, dict):
            parts.append(json.dumps(section.exercise_data, sort_keys=True, default=str))
        elif section.content_type == "video":
            parts.append(_clean_html_to_text(section.text_content or ""))
        return _source_hash("|".join(parts))

    def _safe_translate(self, text: str, context: Optional[Dict[str, Any]] = None) -> str:
        """Translate text, catching errors and falling back to the source."""
        text = (text or "").strip()
        if not text:
            return ""
        if self.dry_run:
            return text
        try:
            result = self.translator.translate_text(text, context)
            return result if result else text
        except OpenAIPaymentRequiredError:
            raise
        except Exception as exc:
            logger.error("Translation failed for '%s…': %s", text[:60], exc)
            self.stats["errors"] += 1
            return text

    def _print_summary(self):
        s = self.stats
        prefix = "Would create/update" if self.dry_run else "Created/updated"
        self.stdout.write("")
        self.stdout.write(self.style.SUCCESS(f"=== Translation summary ({LANGUAGE_CODE}) ==="))
        self.stdout.write(f"  {prefix} {s['paths_translated']} path translations")
        self.stdout.write(f"  {prefix} {s['courses_translated']} course translations")
        self.stdout.write(f"  {prefix} {s['lessons_translated']} lesson translations")
        self.stdout.write(f"  {prefix} {s['sections_translated']} section translations")
        self.stdout.write(f"  Skipped: {s['skipped']}")
        if s["errors"]:
            self.stdout.write(self.style.ERROR(f"  Errors: {s['errors']}"))
        self.stdout.write("")

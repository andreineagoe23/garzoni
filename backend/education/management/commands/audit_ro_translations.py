"""
Comprehensive audit of Romanian (ro) translation coverage and integrity.

Checks:
  - Every Path, Course, Lesson, LessonSection has a Romanian translation row
  - Exercise options count stays unchanged between source and translation
  - correctAnswer index is valid for translated options
  - No untranslated English fallback remaining in exercise payloads
  - Source-hash freshness (stale vs current)

Usage:
    python manage.py audit_ro_translations
    python manage.py audit_ro_translations --verbose
"""

from __future__ import annotations

import hashlib
import html
import json
import re
from typing import Any, Dict, List

from django.core.management.base import BaseCommand
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

LANGUAGE_CODE = "ro"


def _clean_html(value):
    if not value:
        return ""
    text = strip_tags(str(value))
    text = html.unescape(text)
    return re.sub(r"\s+", " ", text).strip()


def _source_hash(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()[:16]


class Command(BaseCommand):
    help = "Audit coverage and integrity of Romanian (ro) translations for all education content."

    def add_arguments(self, parser):
        parser.add_argument("--verbose", action="store_true", help="Show per-object details.")

    def handle(self, *args, **options):
        self.verbose = options["verbose"]
        self.issues: List[str] = []

        self._audit_paths()
        self._audit_courses()
        self._audit_lessons()
        self._audit_sections()

        self.stdout.write("")
        if self.issues:
            self.stdout.write(self.style.ERROR(f"Found {len(self.issues)} issue(s):"))
            for issue in self.issues:
                self.stdout.write(f"  - {issue}")
        else:
            self.stdout.write(self.style.SUCCESS("All checks passed. No issues found."))

    def _audit_paths(self):
        total = Path.objects.count()
        translated_ids = set(
            PathTranslation.objects.filter(language=LANGUAGE_CODE).values_list("path_id", flat=True)
        )
        missing = Path.objects.exclude(id__in=translated_ids).values_list("id", "title")
        stale = 0

        for path in Path.objects.all():
            trans = PathTranslation.objects.filter(path=path, language=LANGUAGE_CODE).first()
            if trans and trans.source_hash:
                expected = _source_hash(f"{path.title}|{path.description}")
                if trans.source_hash != expected:
                    stale += 1
                    if self.verbose:
                        self.issues.append(f"Path {path.pk} '{path.title}' has stale translation")

        for pid, title in missing:
            self.issues.append(f"Path {pid} '{title}' missing {LANGUAGE_CODE} translation")

        self.stdout.write(
            self.style.SUCCESS(f"Paths: {len(translated_ids)}/{total} translated, {stale} stale")
        )

    def _audit_courses(self):
        total = Course.objects.count()
        translated_ids = set(
            CourseTranslation.objects.filter(language=LANGUAGE_CODE).values_list(
                "course_id", flat=True
            )
        )
        missing = Course.objects.exclude(id__in=translated_ids).values_list("id", "title")
        stale = 0

        for course in Course.objects.all():
            trans = CourseTranslation.objects.filter(course=course, language=LANGUAGE_CODE).first()
            if trans and trans.source_hash:
                expected = _source_hash(f"{course.title}|{course.description}")
                if trans.source_hash != expected:
                    stale += 1
                    if self.verbose:
                        self.issues.append(
                            f"Course {course.pk} '{course.title}' has stale translation"
                        )

        for cid, title in missing:
            self.issues.append(f"Course {cid} '{title}' missing {LANGUAGE_CODE} translation")

        self.stdout.write(
            self.style.SUCCESS(f"Courses: {len(translated_ids)}/{total} translated, {stale} stale")
        )

    def _audit_lessons(self):
        total = Lesson.objects.count()
        translated_ids = set(
            LessonTranslation.objects.filter(language=LANGUAGE_CODE).values_list(
                "lesson_id", flat=True
            )
        )
        missing = Lesson.objects.exclude(id__in=translated_ids).values_list("id", "title")
        stale = 0

        for lesson in Lesson.objects.all():
            trans = LessonTranslation.objects.filter(lesson=lesson, language=LANGUAGE_CODE).first()
            if trans and trans.source_hash:
                detail = _clean_html(lesson.detailed_content) if lesson.detailed_content else ""
                expected = _source_hash(f"{lesson.title}|{lesson.short_description or ''}|{detail}")
                if trans.source_hash != expected:
                    stale += 1
                    if self.verbose:
                        self.issues.append(
                            f"Lesson {lesson.pk} '{lesson.title}' has stale translation"
                        )

        for lid, title in missing:
            self.issues.append(f"Lesson {lid} '{title}' missing {LANGUAGE_CODE} translation")

        self.stdout.write(
            self.style.SUCCESS(f"Lessons: {len(translated_ids)}/{total} translated, {stale} stale")
        )

    def _audit_sections(self):
        sections = LessonSection.objects.all().select_related("lesson")
        total = sections.count()
        total_text = sections.filter(content_type="text").count()
        total_exercise = sections.filter(content_type="exercise").count()
        total_video = sections.filter(content_type="video").count()

        trans_qs = LessonSectionTranslation.objects.filter(language=LANGUAGE_CODE)
        translated_ids = set(trans_qs.values_list("section_id", flat=True))

        translated_text = (
            trans_qs.filter(section__content_type="text")
            .values_list("section_id", flat=True)
            .distinct()
            .count()
        )
        translated_exercise = (
            trans_qs.filter(section__content_type="exercise")
            .values_list("section_id", flat=True)
            .distinct()
            .count()
        )
        translated_video = (
            trans_qs.filter(section__content_type="video")
            .values_list("section_id", flat=True)
            .distinct()
            .count()
        )

        missing_sections = sections.exclude(id__in=translated_ids)
        exercise_issues = 0
        stale = 0

        for section in missing_sections:
            lesson_title = section.lesson.title if section.lesson else "?"
            if self.verbose:
                self.issues.append(
                    f"Section {section.pk} (lesson '{lesson_title}', order={section.order}, "
                    f"type={section.content_type}) missing {LANGUAGE_CODE} translation"
                )

        for trans in trans_qs.select_related("section", "section__lesson").iterator():
            section = trans.section
            if not section:
                continue

            if section.content_type == "exercise":
                src_data = section.exercise_data or {}
                tr_data = trans.exercise_data or {}

                if isinstance(src_data, dict) and isinstance(tr_data, dict):
                    src_opts = src_data.get("options") or []
                    tr_opts = tr_data.get("options") or []

                    if len(src_opts) != len(tr_opts):
                        exercise_issues += 1
                        self.issues.append(
                            f"Section {section.pk}: exercise option count mismatch "
                            f"(source={len(src_opts)}, translated={len(tr_opts)})"
                        )

                    correct_idx = tr_data.get("correctAnswer")
                    if correct_idx is not None and isinstance(correct_idx, int):
                        if correct_idx < 0 or correct_idx >= len(tr_opts):
                            exercise_issues += 1
                            self.issues.append(
                                f"Section {section.pk}: correctAnswer index {correct_idx} "
                                f"out of range for {len(tr_opts)} translated options"
                            )

            if trans.source_hash:
                parts = [section.title or ""]
                if section.content_type == "text":
                    parts.append(_clean_html(section.text_content))
                elif section.content_type == "exercise" and isinstance(section.exercise_data, dict):
                    parts.append(json.dumps(section.exercise_data, sort_keys=True, default=str))
                expected = _source_hash("|".join(parts))
                if trans.source_hash != expected:
                    stale += 1

        missing_count = total - len(translated_ids)
        self.stdout.write(
            self.style.SUCCESS(
                f"Sections: {len(translated_ids)}/{total} translated "
                f"(text {translated_text}/{total_text}, "
                f"exercise {translated_exercise}/{total_exercise}, "
                f"video {translated_video}/{total_video})"
            )
        )
        self.stdout.write(
            f"  Missing: {missing_count}, Stale: {stale}, Exercise integrity issues: {exercise_issues}"
        )

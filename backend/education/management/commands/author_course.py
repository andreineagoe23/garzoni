"""
One-shot content authoring: build a whole course (path -> course -> lessons ->
9 sections -> 2 exercises) from a single Markdown bundle file.

This is the token-cheap pipeline: author content as a flat .md file on disk,
then let this command create/update the DB. No per-section AI round-trips.

Usage:
  python manage.py author_course path/to/course.md
  python manage.py author_course <file> --dry-run      # parse + validate, no writes
  python manage.py author_course <file> --update       # overwrite existing lessons

Bundle format (one .md file = one course):

  ---
  path: My Path
  path_access_tier: starter            # only used if the path is created
  course: My Course
  course_description: ...
  ---

  # Lesson Title
  short_description: One line shown in lesson lists.
  video: https://www.youtube.com/embed/VIDEO_ID

  ## Overview            (-> text section 1)
  ## Core Concept        (-> text section 2)
  ### Knowledge Check 1   (-> exercise section 3)
  ## Applied Insight     (-> text section 4)
  ## Practical Walkthrough (-> text section 5)
  ### Knowledge Check 2   (-> exercise section 6)
  ## Key Takeaways       (-> text section 7)
  ## Next Steps          (-> text section 8)

Exercise block (multiple choice): a `Q:` line, options one per line with the
correct one marked `*` and distractors `-`, optional `Explanation:` / `Hint:`.
"""

import re
from pathlib import Path as FsPath

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.db.models import Max

from education.models import Path, Course, Lesson, LessonSection
from education.lesson_section_structure import SECTION_TEMPLATE_9
from education.management.commands.load_lesson_from_markdown import (
    parse_frontmatter,
    markdown_paragraphs_to_html,
)

# Markdown ## header (lowercase) -> text section order
TEXT_HEADER_TO_ORDER = {
    "overview": 1,
    "core concept": 2,
    "applied insight": 4,
    "practical walkthrough": 5,
    "key takeaways": 7,
    "next steps": 8,
}
# Markdown ### exercise header (lowercase) -> exercise section order
EXERCISE_HEADER_TO_ORDER = {
    "knowledge check 1": 3,
    "knowledge check 2": 6,
}

MIN_EXERCISE_Q = 80  # authoring standard: ~80 chars of question stem
MIN_TEXT_CHARS = 200  # warn below this (stripped) for the deeper sections


def _strip_html(html: str) -> str:
    return re.sub(r"<[^>]+>", "", html or "").strip()


def parse_exercise_block(body: str) -> dict | None:
    """
    Parse an exercise body of the form:
        Q: <question>
        * <correct option>
        - <distractor>
        - <distractor>
        - <distractor>
        Explanation: <text>
        Hint: <text>        (optional, repeatable)
    Correct option is marked with a leading '*'. Returns exercise_data dict.
    """
    question = ""
    options: list[str] = []
    correct_index = None
    explanation = ""
    hints: list[str] = []

    for raw in body.splitlines():
        line = raw.strip()
        if not line:
            continue
        low = line.lower()
        if low.startswith("q:"):
            question = line[2:].strip()
        elif low.startswith("explanation:"):
            explanation = line.split(":", 1)[1].strip()
        elif low.startswith("hint:"):
            hints.append(line.split(":", 1)[1].strip())
        elif line.startswith("*"):
            correct_index = len(options)
            options.append(line[1:].strip())
        elif line.startswith("-"):
            options.append(line[1:].strip())

    if not question or len(options) < 2 or correct_index is None:
        return None
    data: dict = {
        "question": question,
        "options": options,
        "correctAnswer": correct_index,
    }
    if explanation:
        data["explanation"] = explanation
    if hints:
        data["hints"] = hints
    return data


def parse_lesson_block(block: str) -> dict:
    """
    Parse one lesson block (text after the '# Title' line). Returns
    {title, short_description, video, texts:{order:html}, exercises:{order:data}}.
    """
    first_line, _, rest = block.partition("\n")
    lesson = {
        "title": first_line.strip(),
        "short_description": "",
        "video": "",
        "texts": {},
        "exercises": {},
    }

    # Inline lesson-level fields (short_description:, video:) before first header.
    header_re = re.compile(r"^(##|###)\s+(.+)$", re.MULTILINE)
    first_header = header_re.search(rest)
    preamble = rest[: first_header.start()] if first_header else rest
    for pline in preamble.splitlines():
        pl = pline.strip()
        if pl.lower().startswith("short_description:"):
            lesson["short_description"] = pl.split(":", 1)[1].strip()
        elif pl.lower().startswith("video:"):
            lesson["video"] = pl.split(":", 1)[1].strip()

    # Split remaining body into (level, header, content) chunks.
    parts = header_re.split(rest)
    # parts = [pre, level, header, content, level, header, content, ...]
    for i in range(1, len(parts), 3):
        level = parts[i]
        header = parts[i + 1].strip().lower()
        content = parts[i + 2].strip() if i + 2 < len(parts) else ""
        if level == "##" and header in TEXT_HEADER_TO_ORDER:
            lesson["texts"][TEXT_HEADER_TO_ORDER[header]] = markdown_paragraphs_to_html(content)
        elif level == "###" and header in EXERCISE_HEADER_TO_ORDER:
            data = parse_exercise_block(content)
            if data:
                lesson["exercises"][EXERCISE_HEADER_TO_ORDER[header]] = data
    return lesson


class Command(BaseCommand):
    help = "Build/update a whole course from a single Markdown bundle (see module docstring for format)."

    def add_arguments(self, parser):
        parser.add_argument("path", type=str, help="Path to the .md bundle file.")
        parser.add_argument("--dry-run", action="store_true", help="Parse + validate, no writes.")
        parser.add_argument(
            "--update",
            action="store_true",
            help="Overwrite content of lessons that already exist (default: skip existing).",
        )

    def handle(self, *args, **options):
        fs_path = FsPath(options["path"]).resolve()
        if not fs_path.is_file():
            raise CommandError(f"File not found: {fs_path}")
        dry_run = options["dry_run"]
        update = options["update"]

        text = fs_path.read_text(encoding="utf-8")
        attrs, body = parse_frontmatter(text)
        path_title = (attrs.get("path") or "").strip()
        course_title = (attrs.get("course") or "").strip()
        if not path_title or not course_title:
            raise CommandError("Frontmatter must include 'path' and 'course'.")

        # Split body into '# Lesson Title' blocks.
        blocks = re.split(r"^#\s+(?=\S)", body, flags=re.MULTILINE)
        lessons = [parse_lesson_block(b.strip()) for b in blocks if b.strip()]
        if not lessons:
            raise CommandError("No '# Lesson Title' blocks found in bundle body.")

        warnings = self._validate(lessons)
        for w in warnings:
            self.stdout.write(self.style.WARNING("WARN: " + w))

        if dry_run:
            self.stdout.write(
                f"DRY RUN: path={path_title!r} course={course_title!r} "
                f"lessons={len(lessons)} warnings={len(warnings)}"
            )
            for l in lessons:
                self.stdout.write(
                    f"  - {l['title']}  (texts={sorted(l['texts'])} "
                    f"exercises={sorted(l['exercises'])} video={'y' if l['video'] else 'n'})"
                )
            return

        created_l = updated_l = skipped_l = 0
        with transaction.atomic():
            path, _ = Path.objects.get_or_create(
                title=path_title,
                defaults={
                    "description": attrs.get("path_description", "") or path_title,
                    "access_tier": attrs.get("path_access_tier", "starter"),
                },
            )
            next_order = path.courses.aggregate(m=Max("order"))["m"] or 0
            course, course_created = Course.objects.get_or_create(
                path=path,
                title=course_title,
                defaults={
                    "description": attrs.get("course_description", "") or course_title,
                    "order": next_order + 1,
                    "is_active": True,
                },
            )
            for ldata in lessons:
                lesson = Lesson.objects.filter(course=course, title=ldata["title"]).first()
                if lesson and not update:
                    skipped_l += 1
                    self.stdout.write(self.style.NOTICE(f"Skip existing: {ldata['title']}"))
                    continue
                if lesson:
                    updated_l += 1
                else:
                    lesson = Lesson(course=course, title=ldata["title"])
                    created_l += 1
                lesson.short_description = ldata["short_description"] or lesson.short_description
                if not lesson.detailed_content:
                    lesson.detailed_content = "<p></p>"
                lesson.save()
                self._write_sections(lesson, ldata)
                self.stdout.write(
                    self.style.SUCCESS(f"{'Updated' if update else 'Created'}: {ldata['title']}")
                )

        self.stdout.write(
            self.style.SUCCESS(
                f"Done. course_created={course_created} created={created_l} "
                f"updated={updated_l} skipped={skipped_l} warnings={len(warnings)}"
            )
        )

    def _write_sections(self, lesson: Lesson, ldata: dict) -> None:
        """Ensure 9 canonical sections exist and fill them from parsed data."""
        existing = {s.order: s for s in lesson.sections.all()}
        for order, title, content_type, _ in SECTION_TEMPLATE_9:
            section = existing.get(order) or LessonSection(
                lesson=lesson, order=order, title=title, content_type=content_type
            )
            section.title = title
            section.content_type = content_type
            if content_type == "text":
                html = ldata["texts"].get(order)
                if html:
                    section.text_content = html
                elif not section.text_content:
                    section.text_content = "<p></p>"
            elif content_type == "exercise":
                data = ldata["exercises"].get(order)
                section.exercise_type = "multiple-choice"
                if data:
                    section.exercise_data = data
            elif content_type == "video":
                if ldata["video"]:
                    section.video_url = ldata["video"]
            section.is_published = True
            section.save()

    def _validate(self, lessons: list[dict]) -> list[str]:
        warnings: list[str] = []
        for l in lessons:
            t = l["title"]
            if not l["short_description"]:
                warnings.append(f"[{t}] missing short_description")
            if not l["video"]:
                warnings.append(f"[{t}] missing video")
            for order in (1, 2, 4, 5, 7, 8):
                if order not in l["texts"]:
                    warnings.append(f"[{t}] missing text section {order}")
                elif order in (4, 5) and len(_strip_html(l["texts"][order])) < MIN_TEXT_CHARS:
                    warnings.append(f"[{t}] text section {order} thin (<{MIN_TEXT_CHARS} chars)")
            for order in (3, 6):
                ex = l["exercises"].get(order)
                if not ex:
                    warnings.append(f"[{t}] missing exercise section {order}")
                elif len(ex["question"]) < MIN_EXERCISE_Q:
                    warnings.append(
                        f"[{t}] exercise {order} question short (<{MIN_EXERCISE_Q} chars)"
                    )
        return warnings

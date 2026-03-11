"""
Load lesson text sections from Markdown files.

See backend/education/content/LESSON_CONTENT_FORMAT.md for the expected format.
Updates lesson short_description, video_url, and the six text sections
(Overview, Core Concept, Applied Insight, Practical Walkthrough, Key Takeaways, Next Steps) by matching
course title + lesson title. Does not create sections; the lesson must
already have the 9-section structure (e.g. from rebuild_lessons_professional_flow).
"""

import re
from pathlib import Path

from django.core.management.base import BaseCommand
from django.db import transaction

from education.models import Lesson
from education.lesson_section_structure import TEXT_HEADER_TO_ORDER

# Section headers in the .md file -> (section order, field to update)
SECTION_MAP = {h: (order, "text_content") for h, order in TEXT_HEADER_TO_ORDER.items()}


def parse_frontmatter(content: str) -> tuple[dict, str]:
    """Extract YAML-like frontmatter between --- and return (attrs, rest)."""
    rest = content.strip()
    if not rest.startswith("---"):
        return {}, rest
    parts = rest.split("\n", 1)
    if len(parts) < 2:
        return {}, rest
    after_first = parts[1]
    end = after_first.find("---")
    if end == -1:
        return {}, rest
    fm_text = after_first[:end].strip()
    body = after_first[end + 3 :].lstrip()
    attrs = {}
    for line in fm_text.split("\n"):
        line = line.strip()
        if ":" not in line:
            continue
        key, _, value = line.partition(":")
        key = key.strip().lower().replace(" ", "_")
        value = value.strip().strip('"').strip("'").strip()
        if key and value is not None:
            attrs[key] = value
    return attrs, body


def split_sections(body: str) -> dict[str, str]:
    """Split body by ## Section headers; return dict section_key -> content."""
    sections = {}
    pattern = re.compile(r"^##\s+(.+)$", re.MULTILINE)
    parts = pattern.split(body)
    if len(parts) < 2:
        return sections
    for i in range(1, len(parts), 2):
        if i + 1 >= len(parts):
            break
        header = parts[i].strip().lower()
        content = parts[i + 1].strip()
        if header in SECTION_MAP:
            sections[header] = content
    return sections


def markdown_paragraphs_to_html(text: str) -> str:
    """Convert plain text / simple markdown to HTML paragraphs."""
    if not text or not text.strip():
        return ""
    lines = []
    for para in re.split(r"\n\s*\n", text.strip()):
        para = para.strip()
        if not para:
            continue
        # Simple inline: **bold** -> <strong>, *italic* -> <em>
        para = re.sub(r"\*\*(.+?)\*\*", r"<strong>\1</strong>", para)
        para = re.sub(r"\*(.+?)\*", r"<em>\1</em>", para)
        para = re.sub(r"_(.+?)_", r"<em>\1</em>", para)
        lines.append(f"<p>{para}</p>")
    return "\n".join(lines)


def load_single_file(path: Path) -> list[tuple[dict, dict[str, str]]]:
    """
    Read one .md file and return a list of (frontmatter, sections) per lesson.
    If the file has one lesson, one item; if multiple # Lesson Title blocks, one per lesson.
    """
    text = path.read_text(encoding="utf-8")
    # Check for multiple lessons: # Lesson Title at start of line
    single = re.split(r"^#\s+(?=[A-Za-z])", text, flags=re.MULTILINE)
    if len(single) <= 1:
        # Single lesson: whole file is one lesson
        attrs, body = parse_frontmatter(text)
        if not attrs.get("lesson_title") and body.strip().startswith("# "):
            first_line, _, rest = body.strip().partition("\n")
            attrs["lesson_title"] = first_line.lstrip("# ").strip()
            body = rest.lstrip()
        sections = split_sections(body)
        return [(attrs, sections)] if (attrs or sections) else []

    results = []
    for block in single:
        block = block.strip()
        if not block:
            continue
        # First line after # is the lesson title when using multiple # blocks
        first_line, _, rest_block = block.partition("\n")
        first_line = first_line.strip()
        if not first_line:
            continue
        attrs, body = parse_frontmatter(rest_block)
        if not attrs.get("lesson_title"):
            attrs["lesson_title"] = first_line
        sections = split_sections(body)
        results.append((attrs, sections))
    return results


class Command(BaseCommand):
    help = "Load lesson text sections from Markdown file(s). See education/content/LESSON_CONTENT_FORMAT.md."

    def add_arguments(self, parser):
        parser.add_argument(
            "path",
            type=str,
            help="Path to a .md file or directory (with --directory).",
        )
        parser.add_argument(
            "--directory",
            action="store_true",
            help="Treat path as a directory and load all .md files inside it.",
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Show what would be updated without saving.",
        )

    def handle(self, *args, **options):
        path = Path(options["path"]).resolve()
        dry_run = options["dry_run"]
        if dry_run:
            self.stdout.write("DRY RUN – no changes will be saved.")

        if options["directory"]:
            if not path.is_dir():
                self.stderr.write(self.style.ERROR(f"Not a directory: {path}"))
                return
            files = sorted(path.glob("**/*.md"))
        else:
            if not path.is_file():
                self.stderr.write(self.style.ERROR(f"File not found: {path}"))
                return
            files = [path]

        updated_lessons = 0
        for f in files:
            for attrs, sections in load_single_file(f):
                lesson_title = attrs.get("lesson_title", "").strip()
                course_title = attrs.get("course", "").strip()
                if not lesson_title or not course_title:
                    self.stdout.write(
                        self.style.WARNING(
                            f"Skipping block in {f}: missing lesson_title or course in frontmatter."
                        )
                    )
                    continue
                lesson = (
                    Lesson.objects.filter(
                        course__title=course_title,
                        title=lesson_title,
                    )
                    .select_related("course")
                    .first()
                )
                if not lesson:
                    self.stdout.write(
                        self.style.WARNING(
                            f"Lesson not found: course={course_title!r}, title={lesson_title!r}"
                        )
                    )
                    continue
                if dry_run:
                    self.stdout.write(
                        f"Would update lesson: {lesson_title} (sections: {list(sections.keys())})"
                    )
                    updated_lessons += 1
                    continue
                with transaction.atomic():
                    if attrs.get("short_description"):
                        lesson.short_description = attrs["short_description"]
                        lesson.save(update_fields=["short_description"])
                    if attrs.get("video"):
                        lesson.video_url = attrs["video"]
                        lesson.save(update_fields=["video_url"])
                        video_section = lesson.sections.filter(order=9).first()
                        if video_section:
                            video_section.video_url = attrs["video"]
                            video_section.save(update_fields=["video_url"])
                    for section_key, content in sections.items():
                        if section_key not in SECTION_MAP:
                            continue
                        order, field = SECTION_MAP[section_key]
                        section = lesson.sections.filter(order=order).first()
                        if not section:
                            continue
                        html = markdown_paragraphs_to_html(content)
                        if field == "text_content":
                            section.text_content = html or section.text_content
                            section.save(update_fields=["text_content"])
                    updated_lessons += 1
                    self.stdout.write(self.style.SUCCESS(f"Updated: {lesson_title}"))

        self.stdout.write(
            self.style.SUCCESS(
                f"{'Would update' if dry_run else 'Updated'} {updated_lessons} lesson(s)."
            )
        )

"""
Update lesson text sections from content files in your format.

Drop .md files into education/content/lessons/ and run:
  python manage.py update_lessons_from_content
  python manage.py update_lessons_from_content --path education/content/lessons
  python manage.py update_lessons_from_content --dry-run

File format (paste your lesson content as-is):
  Title: Lesson Name
  Course: Course Name
  (optional metadata like Section count, Last updated - ignored)

  Overview
  [paragraphs...]

  Core Concept
  [paragraphs...]

  Applied Insight
  [paragraphs...]

  Practical Walkthrough
  [paragraphs...]

  Key Takeaways
  [paragraphs...]

  Next Steps
  [paragraphs...]

  Recommended Video:
  Title: Video Title
  Channel: Channel Name
  YouTube Link: https://www.youtube.com/watch?v=XXX or https://www.youtube.com/embed/XXX
  Why it fits: ...
"""

import re
from pathlib import Path

from django.core.management.base import BaseCommand
from django.db import transaction

from education.models import Lesson, LessonSection, LessonSectionTranslation
from education.lesson_section_structure import TEXT_HEADER_TO_ORDER

SECTION_NAMES = [
    "overview",
    "core concept",
    "applied insight",
    "practical walkthrough",
    "key takeaways",
    "next steps",
]


def _paragraphs_to_html(text: str) -> str:
    """Convert plain text to HTML paragraphs."""
    if not text or not text.strip():
        return ""
    lines = []
    for para in re.split(r"\n\s*\n", text.strip()):
        para = para.strip()
        if not para:
            continue
        para = re.sub(r"\*\*(.+?)\*\*", r"<strong>\1</strong>", para)
        para = re.sub(r"\*(.+?)\*", r"<em>\1</em>", para)
        lines.append(f"<p>{para}</p>")
    return "\n".join(lines)


def _extract_youtube_embed(url_or_text: str) -> str | None:
    """Extract YouTube embed URL from watch URL or text."""
    if not url_or_text or not url_or_text.strip():
        return None
    s = url_or_text.strip()
    # Already embed
    if "youtube.com/embed/" in s:
        m = re.search(r"(https?://[^\s]+youtube\.com/embed/[^\s]+)", s)
        return m.group(1) if m else None
    # Watch URL
    m = re.search(r"(?:youtube\.com/watch\?v=|youtu\.be/)([a-zA-Z0-9_-]{11})", s)
    if m:
        return f"https://www.youtube.com/embed/{m.group(1)}"
    return None


def parse_lesson_file(path: Path) -> list[dict]:
    """
    Parse a file in the user's format. Returns list of lessons (one per file typically).
    Supports: Title:, Course: at top, then ## SectionName or SectionName headers.
    """
    text = path.read_text(encoding="utf-8")
    lines = text.split("\n")
    title = None
    course = None
    video_url = None

    # Try frontmatter first (--- ... ---)
    if text.strip().startswith("---"):
        end = text.find("---", 3)
        if end > 0:
            fm = text[4:end].strip()
            for line in fm.split("\n"):
                if ":" in line:
                    k, _, v = line.partition(":")
                    k, v = k.strip().lower(), v.strip().strip("'\"")
                    if k == "lesson_title":
                        title = v
                    elif k == "course":
                        course = v
                    elif k == "video":
                        video_url = _extract_youtube_embed(v) or v
            text = text[end + 3 :].lstrip()
            lines = text.split("\n")

    # Parse Title: and Course: from top lines
    for i, line in enumerate(lines[:25]):
        s = line.strip()
        if s.lower().startswith("title:"):
            title = s[6:].strip()
        elif s.lower().startswith("course:"):
            course = s[7:].strip()
        elif "youtube" in s.lower() and ("http" in s or "youtu.be" in s):
            embed = _extract_youtube_embed(s)
            if embed:
                video_url = embed

    # Find body: from first ## Overview or Overview
    body = text
    for marker in ["## Overview", "## Core Concept", "Overview\n", "Core Concept\n"]:
        idx = text.find(marker)
        if idx >= 0:
            body = text[idx:]
            break

    # Split by section headers
    pattern = re.compile(
        r"^#{0,2}\s*(Overview|Core Concept|Applied Insight|Practical Walkthrough|Key Takeaways|Next Steps)\s*$",
        re.MULTILINE | re.IGNORECASE,
    )
    parts = pattern.split(body)
    sections = {}
    for i in range(1, len(parts), 2):
        if i + 1 >= len(parts):
            break
        header = parts[i].strip().lower()
        content = parts[i + 1].strip()
        if header in [s.lower() for s in SECTION_NAMES]:
            sections[header] = content

    # Extract video from Recommended Video block
    if not video_url and "recommended video" in text.lower():
        m = re.search(
            r"Recommended Video:?\s*(.*?)(?=\n\n[A-Z#]|\Z)",
            text,
            re.DOTALL | re.IGNORECASE,
        )
        if m:
            for line in m.group(1).split("\n"):
                embed = _extract_youtube_embed(line)
                if embed:
                    video_url = embed
                    break

    if title and course:
        return [{"title": title, "course": course, "sections": sections, "video_url": video_url}]
    return []


class Command(BaseCommand):
    help = "Update lesson text sections from .md files in your format. Syncs translations."

    def add_arguments(self, parser):
        parser.add_argument(
            "--path",
            type=str,
            default="education/content/lessons",
            help="Path to folder or single .md file.",
        )
        parser.add_argument("--dry-run", action="store_true")

    def handle(self, *args, **options):
        path = Path(options["path"]).resolve()
        dry_run = options["dry_run"]
        if dry_run:
            self.stdout.write("DRY RUN – no changes will be saved.")

        if path.is_file():
            files = [path]
        elif path.is_dir():
            files = sorted(p for p in path.glob("*.md") if p.name.lower() != "readme.md")
        else:
            self.stderr.write(self.style.ERROR(f"Path not found: {path}"))
            return

        updated = 0
        for f in files:
            try:
                for lesson_data in parse_lesson_file(f):
                    ok = self._apply_lesson(lesson_data, dry_run)
                    if ok:
                        updated += 1
            except Exception as e:
                self.stderr.write(self.style.ERROR(f"Error parsing {f}: {e}"))

        self.stdout.write(
            self.style.SUCCESS(f"{'Would update' if dry_run else 'Updated'} {updated} lesson(s).")
        )

    def _apply_lesson(self, data: dict, dry_run: bool) -> bool:
        lesson = (
            Lesson.objects.filter(
                course__title=data["course"],
                title=data["title"],
            )
            .select_related("course")
            .first()
        )

        if not lesson:
            self.stderr.write(
                self.style.WARNING(
                    f"Lesson not found: course={data['course']!r}, title={data['title']!r}"
                )
            )
            return False

        with transaction.atomic():
            for section_key, content in data["sections"].items():
                order = TEXT_HEADER_TO_ORDER.get(section_key.lower())
                if order is None:
                    continue
                section = lesson.sections.filter(order=order).first()
                if not section or section.content_type != "text":
                    continue
                html = _paragraphs_to_html(content)
                if not dry_run:
                    section.text_content = html
                    section.save(update_fields=["text_content"])
                    LessonSectionTranslation.objects.filter(section=section).update(
                        text_content=html
                    )

            if data.get("video_url"):
                video_section = lesson.sections.filter(content_type="video", order=9).first()
                if video_section and not dry_run:
                    video_section.video_url = data["video_url"]
                    video_section.save(update_fields=["video_url"])

        self.stdout.write(
            self.style.SUCCESS(f"  {'Would update' if dry_run else 'Updated'}: {data['title']}")
        )
        return True

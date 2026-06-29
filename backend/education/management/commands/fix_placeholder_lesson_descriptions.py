"""
Replace placeholder / empty lesson SEO descriptions with real text.

`Lesson.short_description` is the meta description served at /learn/<slug>
(via views_public.public_lesson_detail) and rendered into the prerendered
<head>. Lessons created from templates shipped with a placeholder such as
"Auto-generated lesson to complete the course set. Edit the copy in Admin as
needed.", which is bad for SEO and AI answer engines.

This command derives a clean ~155-char description from each affected lesson's
own content (detailed_content, then the first text section) so every public
lesson gets a unique, relevant meta description.

Usage:
    python manage.py fix_placeholder_lesson_descriptions --dry-run
    python manage.py fix_placeholder_lesson_descriptions
    python manage.py fix_placeholder_lesson_descriptions --all   # not just public

Run it against the database Django is configured for (point DATABASE_URL at
Railway to fix production, or run inside the Railway service).
"""

import html
import re

from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils.html import strip_tags

from education.models import Lesson

MAX_LEN = 155

# Known placeholder prefixes. A short_description matching any of these (or empty)
# is treated as needing a real description.
PLACEHOLDER_PREFIXES = (
    "auto-generated lesson",
    "placeholder",
    "edit the copy in admin",
)


def _is_placeholder(text: str) -> bool:
    t = (text or "").strip().lower()
    if not t:
        return True
    return any(t.startswith(p) for p in PLACEHOLDER_PREFIXES)


def _clean(raw: str) -> str:
    text = html.unescape(strip_tags(raw or ""))
    return re.sub(r"\s+", " ", text).strip()


def _truncate(text: str, limit: int = MAX_LEN) -> str:
    if len(text) <= limit:
        return text
    window = text[: limit + 1]
    # Prefer ending on a sentence boundary within the window.
    m = list(re.finditer(r"[.!?](?:\s|$)", window))
    if m and m[-1].end() - 1 >= 60:
        return window[: m[-1].start() + 1].strip()
    # Otherwise cut on the last word boundary, no trailing partial word.
    cut = window.rfind(" ")
    if cut < 60:
        cut = limit
    return text[:cut].rstrip(" ,;:-") + "…"


def _derive(lesson: Lesson) -> str | None:
    text = _clean(lesson.detailed_content)
    if not text:
        for section in sorted(lesson.sections.all(), key=lambda s: s.order):
            if section.content_type != "text":
                continue
            text = _clean(section.text_content)
            if text:
                break
    if not text:
        return None
    return _truncate(text)


class Command(BaseCommand):
    help = "Replace placeholder/empty Lesson.short_description with real derived text."

    def add_arguments(self, parser):
        parser.add_argument("--dry-run", action="store_true")
        parser.add_argument(
            "--all",
            action="store_true",
            help="Process all lessons, not only is_public=True.",
        )

    def handle(self, *args, **options):
        dry_run = options["dry_run"]
        qs = Lesson.objects.prefetch_related("sections")
        if not options["all"]:
            qs = qs.filter(is_public=True)

        updated = 0
        skipped_no_content = 0

        with transaction.atomic():
            for lesson in qs:
                if not _is_placeholder(lesson.short_description):
                    continue
                new_desc = _derive(lesson)
                if not new_desc:
                    skipped_no_content += 1
                    self.stderr.write(
                        self.style.WARNING(
                            f"  no content to derive from: {lesson.slug or lesson.id}"
                        )
                    )
                    continue
                if not dry_run:
                    lesson.short_description = new_desc
                    lesson.save(update_fields=["short_description"])
                updated += 1
                self.stdout.write(f"  {lesson.slug or lesson.id}: {new_desc!r}")

            if dry_run:
                transaction.set_rollback(True)

        self.stdout.write(
            self.style.SUCCESS(
                f"{'Would update' if dry_run else 'Updated'} {updated} description(s); "
                f"{skipped_no_content} had no content to derive from."
            )
        )

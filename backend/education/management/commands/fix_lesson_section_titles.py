"""
List and fix lesson section titles that duplicate the lesson name.

Section titles like "Lesson 3: Setting Financial Goals: Practice #2" are reduced
to "Practice #2" so the UI does not show two full lesson titles.

Usage:
  python manage.py fix_lesson_section_titles           # list all matching sections
  python manage.py fix_lesson_section_titles --fix     # update titles in DB
  python manage.py fix_lesson_section_titles --fix --dry-run  # show changes only
"""

from django.core.management.base import BaseCommand
from education.models import LessonSection

# Short titles we want. Any section title ending with ": <suffix>" or " - <suffix>" gets replaced by <suffix>.
KNOWN_SUFFIXES = [
    "Practice #1",
    "Practice #2",
    "Overview",
    "Key takeaways",
    "Watch and learn",
    "Video",
    "Exercise",
]


def shorten_section_title(title: str | None) -> str | None:
    """
    If section title ends with ": <known suffix>" or " - <known suffix>", return that suffix.
    Also strip if title starts with lesson-like prefix (e.g. "Lesson 3: ...: Practice #2" -> "Practice #2").
    """
    if not title or not title.strip():
        return None
    title = title.strip()
    for suffix in KNOWN_SUFFIXES:
        for sep in (": ", " - "):
            if title.endswith(sep + suffix):
                return suffix
            if title == suffix:
                return None  # already short
    # If title contains any known suffix preceded by ": " or " - ", use the rightmost one
    last_pos = -1
    result_suffix = None
    for suffix in KNOWN_SUFFIXES:
        for sep in (": ", " - "):
            needle = sep + suffix
            pos = title.rfind(needle)
            if pos > last_pos:
                last_pos = pos
                result_suffix = suffix
    return result_suffix if last_pos >= 0 else None


class Command(BaseCommand):
    help = (
        "List lesson sections whose title repeats the lesson name (e.g. 'Lesson 3: X: Practice #2'). "
        "Use --fix to update them to the subtitle only (e.g. 'Practice #2')."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--fix",
            action="store_true",
            help="Update section titles to remove the lesson name prefix.",
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="With --fix, only print what would be changed; do not save.",
        )

    def handle(self, *args, **options):
        do_fix = options["fix"]
        dry_run = options["dry_run"]

        sections = LessonSection.objects.select_related("lesson", "lesson__course").order_by(
            "lesson__course__title", "lesson__id", "order"
        )
        to_fix = []
        for section in sections:
            new_title = shorten_section_title(section.title)
            if new_title is not None:
                to_fix.append((section, new_title))

        if not to_fix:
            self.stdout.write(self.style.SUCCESS("No sections with duplicate lesson titles found."))
            return

        self.stdout.write(
            self.style.NOTICE(
                f"Found {len(to_fix)} section(s) with lesson title in section title:\n"
            )
        )
        for section, new_title in to_fix:
            course = section.lesson.course.title if section.lesson.course else "?"
            self.stdout.write(
                f"  [{course}] {section.lesson.title} | section order={section.order}\n"
                f"    current: {section.title!r}\n"
                f"    new:     {new_title!r}\n"
            )

        if do_fix:
            if dry_run:
                self.stdout.write(self.style.WARNING("Dry run: no changes written."))
                return
            updated = 0
            for section, new_title in to_fix:
                section.title = new_title
                section.save(update_fields=["title"])
                updated += 1
            self.stdout.write(self.style.SUCCESS(f"Updated {updated} section title(s)."))
        else:
            self.stdout.write(
                self.style.NOTICE(
                    "Run with --fix to apply changes (or --fix --dry-run to preview)."
                )
            )

"""
Strip "Lesson 1: ", "Lesson 2: ", ... "Lesson 5: " prefix from lesson titles.

Other lessons use descriptive names only (e.g. "What is a Budget?" not "Lesson 1: What is a Budget?").
"""

import re
from django.core.management.base import BaseCommand
from django.db import transaction

from education.models import Lesson

# Matches "Lesson 1: ", "Lesson 2: ", ... "Lesson 5: " at the start
PREFIX_PATTERN = re.compile(r"^Lesson [1-5]:\s*", re.IGNORECASE)


class Command(BaseCommand):
    help = "Strip 'Lesson N: ' prefix from lesson titles to match naming style of other lessons."

    def add_arguments(self, parser):
        parser.add_argument("--dry-run", action="store_true")

    def handle(self, *args, **options):
        dry_run = options["dry_run"]
        updated = 0

        with transaction.atomic():
            for lesson in Lesson.objects.select_related("course").all():
                match = PREFIX_PATTERN.match(lesson.title)
                if not match:
                    continue
                new_title = PREFIX_PATTERN.sub("", lesson.title).strip()
                if not new_title:
                    self.stderr.write(
                        self.style.WARNING(
                            f"Lesson {lesson.id} would have empty title after strip, skipping."
                        )
                    )
                    continue
                if lesson.title != new_title:
                    if not dry_run:
                        lesson.title = new_title
                        lesson.save(update_fields=["title"])
                    self.stdout.write(
                        f"  {lesson.course.title} / {lesson.title!r} -> {new_title!r}"
                    )
                    updated += 1
            if dry_run:
                transaction.set_rollback(True)

        self.stdout.write(
            self.style.SUCCESS(
                f"{'Would update' if dry_run else 'Updated'} {updated} lesson title(s)."
            )
        )

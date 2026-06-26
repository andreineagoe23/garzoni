"""
Assign a course-level video to every lesson in a course that is still using the
generic fallback clip. Standards allow a course-level video when a lesson-specific
one is missing (see content/lesson_authoring_standards.md).

Updates section 9 (Watch & Learn) `video_url` and the lesson's `video_url`. By
default only touches lessons whose section-9 video equals --fallback (so genuine
lesson-specific videos are preserved); pass --all-in-course to override every lesson.

JSON map: { "<Course title>": "https://www.youtube.com/embed/<id>", ... }

Usage:
  python manage.py assign_course_videos path/to/course_videos.json --dry-run
  python manage.py assign_course_videos path/to/course_videos.json
"""

import json
from pathlib import Path as FsPath

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from education.models import Course

DEFAULT_FALLBACK = "https://www.youtube.com/embed/Fubj7A9Pu80"


class Command(BaseCommand):
    help = "Assign course-level videos to fallback lessons from a {course: embed_url} JSON map."

    def add_arguments(self, parser):
        parser.add_argument("path", type=str, help="Path to the {course: url} JSON map.")
        parser.add_argument("--dry-run", action="store_true")
        parser.add_argument(
            "--fallback",
            type=str,
            default=DEFAULT_FALLBACK,
            help="Only replace section-9 videos equal to this URL. Default: the generic clip.",
        )
        parser.add_argument(
            "--all-in-course",
            action="store_true",
            help="Replace section-9 video on every lesson in the course, not just fallback ones.",
        )

    def handle(self, *args, **options):
        fs_path = FsPath(options["path"]).resolve()
        if not fs_path.is_file():
            raise CommandError(f"File not found: {fs_path}")
        dry_run = options["dry_run"]
        fallback = options["fallback"]
        all_in_course = options["all_in_course"]
        mapping = json.loads(fs_path.read_text(encoding="utf-8"))

        n_courses = n_lessons = 0
        with transaction.atomic():
            for course_title, url in mapping.items():
                courses = Course.objects.filter(title=course_title).prefetch_related(
                    "lessons__sections"
                )
                if not courses:
                    self.stdout.write(self.style.WARNING(f"Course not found: {course_title!r}"))
                    continue
                touched = 0
                for course in courses:
                    for lesson in course.lessons.all():
                        s9 = lesson.sections.filter(order=9, content_type="video").first()
                        if not s9:
                            continue
                        if not all_in_course and s9.video_url != fallback:
                            continue
                        if not dry_run:
                            s9.video_url = url
                            s9.save(update_fields=["video_url"])
                            lesson.video_url = url
                            lesson.save(update_fields=["video_url"])
                        touched += 1
                if touched:
                    n_courses += 1
                    n_lessons += touched
                    self.stdout.write(f"{course_title}: {touched} lesson(s) -> {url}")

        self.stdout.write(
            self.style.SUCCESS(
                f"{'DRY RUN — would update' if dry_run else 'Updated'}: "
                f"{n_lessons} lesson(s) across {n_courses} course(s)."
            )
        )

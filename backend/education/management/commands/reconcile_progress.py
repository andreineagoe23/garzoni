"""One-time reconciliation of course progress to the section-based source of truth.

Recomputes lesson auto-completion and ``is_course_complete`` from each user's
completed **published** sections (see ``education.progress``). Truthful only:
it never invents section completions, so it unsticks accounts whose sections are
already done but whose flags lagged behind. Accounts with genuinely-skipped
sections unstick by tapping Finish once (the flow's ``complete_course`` call).

    python manage.py reconcile_progress [--dry-run]
"""

from django.core.management.base import BaseCommand
from django.utils import timezone

from education import progress as progress_calc
from education.models import LessonSection, UserProgress


class Command(BaseCommand):
    help = "Reconcile is_course_complete and lesson auto-completion to the section-based rule."

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Report what would change without writing.",
        )

    def handle(self, *args, **options):
        dry_run = options["dry_run"]
        lessons_marked = 0
        courses_marked = 0

        progresses = UserProgress.objects.select_related("course", "course__path").prefetch_related(
            "completed_sections", "completed_lessons"
        )

        for progress in progresses:
            course = progress.course
            if not course:
                continue

            completed_section_ids = {
                s.id for s in progress.completed_sections.all() if s.is_published
            }
            completed_lesson_ids = {l.id for l in progress.completed_lessons.all()}

            published_by_lesson: dict[int, set[int]] = {}
            for row in LessonSection.objects.filter(
                lesson__course=course, is_published=True
            ).values("id", "lesson_id"):
                published_by_lesson.setdefault(row["lesson_id"], set()).add(row["id"])

            # Auto-complete lessons whose published sections are all done.
            for lesson_id, sec_ids in published_by_lesson.items():
                if lesson_id in completed_lesson_ids:
                    continue
                if sec_ids and sec_ids.issubset(completed_section_ids):
                    if not dry_run:
                        progress.completed_lessons.add(lesson_id)
                    lessons_marked += 1

            # Recompute course completion (section-based). Only sets, never revokes.
            total = sum(len(v) for v in published_by_lesson.values())
            completed = len(completed_section_ids)
            if (
                progress_calc.course_is_complete(completed, total)
                and not progress.is_course_complete
            ):
                if not dry_run:
                    progress.is_course_complete = True
                    if not progress.course_completed_at:
                        progress.course_completed_at = timezone.now()
                    progress.save(update_fields=["is_course_complete", "course_completed_at"])
                courses_marked += 1

        prefix = "[dry-run] " if dry_run else ""
        self.stdout.write(
            self.style.SUCCESS(
                f"{prefix}lessons auto-completed: {lessons_marked}, "
                f"courses marked complete: {courses_marked}"
            )
        )

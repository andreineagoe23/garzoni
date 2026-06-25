"""Report and (optionally) delete orphaned UserProgress rows.

``UserProgress.user`` is ``SET_NULL``, so deleting a User account leaves its
progress rows behind with ``user_id = NULL``. Those orphans show as "-" in the
admin and inflate completion/engagement analytics. This command surfaces them
and can purge them on demand.

    python manage.py cleanup_orphan_progress            # report only
    python manage.py cleanup_orphan_progress --delete   # delete orphans
"""

from django.core.management.base import BaseCommand

from education.models import UserProgress


class Command(BaseCommand):
    help = "List orphaned UserProgress rows (user deleted) and optionally delete them."

    def add_arguments(self, parser):
        parser.add_argument(
            "--delete",
            action="store_true",
            help="Delete the orphaned rows (cascades their lesson/section completions).",
        )

    def handle(self, *args, **options):
        orphans = UserProgress.objects.filter(user__isnull=True).select_related("course")
        count = orphans.count()

        if not count:
            self.stdout.write(self.style.SUCCESS("No orphaned UserProgress rows."))
            return

        self.stdout.write(f"Found {count} orphaned UserProgress row(s):")
        for p in orphans[:50]:
            course = p.course.title if p.course else "Unknown course"
            self.stdout.write(
                f"  id={p.id} course={course!r} "
                f"last_activity={p.last_course_activity_date} "
                f"complete={p.is_course_complete}"
            )
        if count > 50:
            self.stdout.write(f"  ... and {count - 50} more")

        if not options["delete"]:
            self.stdout.write(
                self.style.WARNING("Report only. Re-run with --delete to remove them.")
            )
            return

        deleted, _ = orphans.delete()
        self.stdout.write(self.style.SUCCESS(f"Deleted {deleted} object(s)."))

from datetime import date, datetime, time

from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone

from authentication.models import UserProfile


class Command(BaseCommand):
    help = (
        "Backfill subscription_plan_id='starter' for legacy users where it is null. "
        "Use --before YYYY-MM-DD to scope by user join date."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--before",
            help="Only backfill users created before this date (YYYY-MM-DD).",
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Show affected rows without updating.",
        )

    def handle(self, *args, **options):
        before_raw = options.get("before")
        dry_run = bool(options.get("dry_run"))

        qs = UserProfile.objects.filter(subscription_plan_id__isnull=True)

        if before_raw:
            try:
                before_dt = date.fromisoformat(before_raw)
            except ValueError as exc:
                raise CommandError("--before must be in YYYY-MM-DD format.") from exc
            before_aware = timezone.make_aware(
                datetime.combine(before_dt, time.min),
            )
            qs = qs.filter(user__date_joined__lt=before_aware)

        affected = qs.count()
        if dry_run:
            self.stdout.write(
                self.style.WARNING(
                    f"[dry-run] Would backfill {affected} profile rows to starter.",
                ),
            )
            return

        updated = qs.update(subscription_plan_id="starter")
        self.stdout.write(
            self.style.SUCCESS(
                f"Backfilled {updated} profile rows with subscription_plan_id='starter'.",
            ),
        )

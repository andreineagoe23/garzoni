from __future__ import annotations

import time

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError

from notifications.profile_sync import NotificationProfileSync

User = get_user_model()


class Command(BaseCommand):
    help = "Bulk-sync existing users to Customer.io via identify calls."

    def add_arguments(self, parser):
        parser.add_argument(
            "--email",
            type=str,
            default=None,
            help="Sync a single user by email (for testing).",
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            default=False,
            help="Preview without making API calls.",
        )
        parser.add_argument(
            "--skip-staff",
            action="store_true",
            default=False,
            help="Skip is_staff=True accounts.",
        )
        parser.add_argument(
            "--delay",
            type=float,
            default=0.1,
            help="Seconds between calls (default 0.1).",
        )

    def handle(self, *args, **options):
        qs = User.objects.filter(is_active=True).order_by("id")
        if options["email"]:
            qs = qs.filter(email__iexact=options["email"].strip())
            if not qs.exists():
                raise CommandError(f"No active user found: {options['email']}")
        if options["skip_staff"]:
            qs = qs.filter(is_staff=False)

        total = qs.count()
        prefix = "[DRY RUN] " if options["dry_run"] else ""
        self.stdout.write(f"{prefix}Syncing {total} user(s) to Customer.io...")

        if options["dry_run"]:
            for u in qs:
                self.stdout.write(f"  Would sync: {u.email} (id={u.id})")
            self.stdout.write(
                self.style.SUCCESS(f"Dry run complete - {total} user(s) would be synced.")
            )
            return

        syncer = NotificationProfileSync()
        ok_count = 0
        fail_count = 0
        failures: list[str] = []

        for i, user in enumerate(qs.iterator(chunk_size=50), start=1):
            ok, err = syncer.sync_user(user)
            label = user.email or user.username
            if ok:
                ok_count += 1
                self.stdout.write(f"  [{i}/{total}] OK  {label}")
            else:
                fail_count += 1
                failures.append(f"{label}: {err}")
                self.stdout.write(
                    self.style.ERROR(f"  [{i}/{total}] FAIL {label} - {err}")
                )
            if options["delay"] > 0 and i < total:
                time.sleep(options["delay"])

        self.stdout.write(
            self.style.SUCCESS(
                f"\nDone. {ok_count} synced successfully, {fail_count} failed."
            )
        )
        if failures:
            self.stdout.write(self.style.WARNING("Failures:"))
            for f in failures:
                self.stdout.write(f"  - {f}")

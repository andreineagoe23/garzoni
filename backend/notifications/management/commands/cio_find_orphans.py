from __future__ import annotations

import time

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError

from notifications.customer_io import customer_io_track_configured, delete_person

User = get_user_model()


class Command(BaseCommand):
    """Report (and optionally remove) Customer.io profiles with no Django user.

    A profile that outlives its account is not harmless: it still enters every
    journey, still fails each email send with "undefined variable: customer.email",
    and still counts against the workspace profile allowance. On 2026-08-20 the
    workspace held 179 profiles against 92 Django users.

    The backend cannot list Customer.io profiles - the Track API it holds
    credentials for is write-only per person - so the id list comes from the
    Customer.io UI or Fly API. Export the ids of the profiles you suspect, pass
    them here, and this decides which are safe to delete by checking Django.

    Deleting is opt-in and never the default:

        python manage.py cio_find_orphans --ids-file /tmp/ids.txt
        python manage.py cio_find_orphans --ids-file /tmp/ids.txt --delete
    """

    help = "Find Customer.io person ids that no longer have a Django user; optionally delete them."

    def add_arguments(self, parser):
        parser.add_argument(
            "--ids",
            type=str,
            default=None,
            help="Comma-separated Customer.io person ids to check.",
        )
        parser.add_argument(
            "--ids-file",
            type=str,
            default=None,
            help="File with one Customer.io person id per line.",
        )
        parser.add_argument(
            "--delete",
            action="store_true",
            default=False,
            help="Actually delete the orphans from Customer.io. Off by default.",
        )
        parser.add_argument(
            "--delay",
            type=float,
            default=0.1,
            help="Seconds between delete calls (default 0.1).",
        )

    def _load_ids(self, options) -> list[str]:
        raw: list[str] = []
        if options["ids"]:
            raw.extend(options["ids"].split(","))
        if options["ids_file"]:
            try:
                with open(options["ids_file"], encoding="utf-8") as fh:
                    raw.extend(fh.readlines())
            except OSError as exc:
                raise CommandError(f"Could not read --ids-file: {exc}") from exc
        ids = [i.strip() for i in raw if i.strip()]
        if not ids:
            raise CommandError("Pass --ids or --ids-file.")
        # Preserve order, drop duplicates.
        seen: set[str] = set()
        return [i for i in ids if not (i in seen or seen.add(i))]

    def handle(self, *args, **options):
        ids = self._load_ids(options)

        # Only numeric ids can map to a Django pk. Anything else (a raw cio_id,
        # for instance) has no Django row by construction.
        numeric = [i for i in ids if i.isdigit()]
        non_numeric = [i for i in ids if not i.isdigit()]

        live_pks = set(
            str(pk)
            for pk in User.objects.filter(pk__in=[int(i) for i in numeric]).values_list(
                "pk", flat=True
            )
        )

        keep = [i for i in numeric if i in live_pks]
        orphans = [i for i in numeric if i not in live_pks] + non_numeric

        self.stdout.write(f"checked:          {len(ids)}")
        self.stdout.write(f"no external id:   {len(non_numeric)} (cannot be a Django user)")
        self.stdout.write(self.style.SUCCESS(f"live Django users: {len(keep)}"))
        self.stdout.write(self.style.WARNING(f"orphans:           {len(orphans)}"))

        if keep:
            self.stdout.write("\nThese ids ARE live users - they will never be deleted:")
            for row in User.objects.filter(pk__in=[int(i) for i in keep]).values(
                "id", "username", "email", "is_active"
            ):
                self.stdout.write(f"  {row}")

        if not options["delete"]:
            self.stdout.write(
                self.style.NOTICE("\nDry run. Re-run with --delete to remove the orphans.")
            )
            return

        if not customer_io_track_configured():
            raise CommandError(
                "Track credentials missing (CIO_SITE_ID / CIO_TRACK_API_KEY) - cannot delete."
            )

        deleted = 0
        failed: list[str] = []
        total = len(orphans)
        for i, person_id in enumerate(orphans, start=1):
            ok, err = delete_person(person_id)
            if ok:
                deleted += 1
                self.stdout.write(f"  [{i}/{total}] deleted {person_id}")
            else:
                failed.append(f"{person_id}: {err}")
                self.stdout.write(self.style.ERROR(f"  [{i}/{total}] FAILED {person_id} - {err}"))
            if options["delay"] > 0 and i < total:
                time.sleep(options["delay"])

        self.stdout.write(self.style.SUCCESS(f"\nDeleted {deleted} orphan profile(s)."))
        if failed:
            self.stdout.write(self.style.WARNING("Failures:"))
            for f in failed:
                self.stdout.write(f"  - {f}")

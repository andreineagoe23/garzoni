"""
Export current database to JSON for loading into Postgres (e.g. Railway).

Run from local env (SQLite or Postgres):
  python manage.py export_for_postgres -o backup.json

Then load with: DJANGO_ENV=production DATABASE_PUBLIC_URL=<url> python manage.py loaddata backup.json
Uses normal PKs (no natural keys) so all models export reliably.
"""

from django.core.management import call_command
from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = "Export full DB to JSON for importing into Postgres (Railway). Excludes only tables that conflict on load."

    def add_arguments(self, parser):
        parser.add_argument(
            "-o",
            "--output",
            default="backup.json",
            help="Output JSON file path (default: backup.json)",
        )
        parser.add_argument(
            "--exclude-sessions",
            action="store_true",
            default=True,
            help="Exclude sessions (default: True)",
        )
        parser.add_argument(
            "--include-sessions",
            action="store_false",
            dest="exclude_sessions",
            help="Include session data in export",
        )

    def handle(self, *args, **options):
        from django.conf import settings

        db = settings.DATABASES.get("default", {})
        db_backend = db.get("ENGINE", "")
        db_name = db.get("NAME", "")
        self.stdout.write(f"Using DB: {db_backend.split('.')[-1]} / {db_name!r}")
        out = options["output"]
        exclude_sessions = options["exclude_sessions"]
        excludes = [
            "contenttypes",
            "auth.Permission",
            "sessions.Session",
            "admin.LogEntry",
            "education.PathRecommendation",  # may be missing columns on older DBs
        ]
        if not exclude_sessions:
            excludes.remove("sessions.Session")
        self.stdout.write(f"Exporting to {out} (excludes: {', '.join(excludes)}) ...")
        exclude_args = []
        for e in excludes:
            exclude_args.extend(["--exclude", e])
        # No --natural-primary/--natural-foreign: many models don't support it, which can cause incomplete dumps
        call_command(
            "dumpdata",
            "--indent",
            "2",
            "--output",
            out,
            *exclude_args,
        )
        self.stdout.write(self.style.SUCCESS(f"Done. Saved to {out}"))

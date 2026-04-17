"""
Write `education/content/exercises_release.json` for repo + Railway predeploy sync.

After exporting, bump `exercises_version` in `education/content/release_manifest.json`
so the next deploy runs `sync_exercises_release`.

Usage:
    python manage.py export_exercises_release
    python manage.py export_exercises_release -o /tmp/out.json
"""

from pathlib import Path

from django.core.management import call_command
from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = "Export Exercise + translations + MC choices to education/content/exercises_release.json"

    def add_arguments(self, parser):
        parser.add_argument(
            "-o",
            "--output",
            default="",
            help="Output path (default: <app>/education/content/exercises_release.json)",
        )

    def handle(self, *args, **options):
        # parents[2] == backend/education (Django app package), same as sync_exercises_release.
        education_pkg = Path(__file__).resolve().parents[2]
        out = (
            Path(options["output"])
            if options["output"]
            else education_pkg / "content" / "exercises_release.json"
        )
        out.parent.mkdir(parents=True, exist_ok=True)

        self.stdout.write(f"Exporting exercises to {out} ...")
        call_command(
            "dumpdata",
            "education.Exercise",
            "education.ExerciseTranslation",
            "education.MultipleChoiceChoice",
            "--indent",
            "2",
            "--output",
            str(out),
        )
        self.stdout.write(
            self.style.SUCCESS(
                f"Done. Bump exercises_version in education/content/release_manifest.json, "
                f"then commit both files before deploy."
            )
        )

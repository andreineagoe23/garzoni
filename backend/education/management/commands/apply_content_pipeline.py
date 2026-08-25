"""
Run the whole education content pipeline against the current database, in order:

  1. author_course        for every bundle in content/bundles/ (excluding example_*)
  2. assign_course_videos  from content/fixes/course_videos.json
  3. apply_lesson_fixes    for every other content/fixes/*.json
  4. (optional) translate_lessons_to_ro

Idempotent: safe to re-run. Because it is just a sequence of the individual
commands, it produces the same result on any database it is pointed at — run it
against local Docker, or against Railway prod (point DATABASE_URL at prod, e.g.
`docker exec -e DATABASE_URL=<prod-url> garzoni-backend-1 python manage.py
apply_content_pipeline`). That is how local and prod are kept identical.

Usage:
  python manage.py apply_content_pipeline --dry-run
  python manage.py apply_content_pipeline                       # author + videos + fixes
  python manage.py apply_content_pipeline --translate           # + fill missing RO
  python manage.py apply_content_pipeline --translate-force      # + re-translate ALL RO (CONTENT_TRANSLATION_MODEL)
"""

from pathlib import Path as FsPath

from django.core.management import call_command
from django.core.management.base import BaseCommand

CONTENT_DIR = FsPath(__file__).resolve().parents[2] / "content"
BUNDLES_DIR = CONTENT_DIR / "bundles"
FIXES_DIR = CONTENT_DIR / "fixes"
VIDEOS_MAP = FIXES_DIR / "course_videos.json"


class Command(BaseCommand):
    help = "Run author_course + assign_course_videos + apply_lesson_fixes (+ optional translate) in order."

    def add_arguments(self, parser):
        parser.add_argument("--dry-run", action="store_true", help="Preview every step, no writes.")
        parser.add_argument(
            "--translate",
            action="store_true",
            help="After applying content, fill missing Romanian translations (--only-missing).",
        )
        parser.add_argument(
            "--translate-force",
            action="store_true",
            help="Re-translate the entire Romanian corpus (translate_lessons_to_ro --force-refresh).",
        )

    def _hr(self, label):
        self.stdout.write(self.style.MIGRATE_HEADING(f"\n=== {label} ==="))

    def handle(self, *args, **options):
        dry = options["dry_run"]

        # 1. Author every course bundle (skip the example/sample file).
        bundles = sorted(b for b in BUNDLES_DIR.glob("*.md") if not b.name.startswith("example"))
        for b in bundles:
            self._hr(f"author_course {b.name}")
            call_command("author_course", str(b), update=True, dry_run=dry)

        # 2. Course-level videos.
        if VIDEOS_MAP.is_file():
            self._hr("assign_course_videos course_videos.json")
            call_command("assign_course_videos", str(VIDEOS_MAP), dry_run=dry)

        # 3. Every other fixes file.
        fixes = sorted(f for f in FIXES_DIR.glob("*.json") if f != VIDEOS_MAP)
        for f in fixes:
            self._hr(f"apply_lesson_fixes {f.name}")
            call_command("apply_lesson_fixes", str(f), dry_run=dry)

        # 4. Translations.
        if options["translate_force"]:
            self._hr("translate_lessons_to_ro --force-refresh")
            call_command("translate_lessons_to_ro", force_refresh=True, dry_run=dry)
        elif options["translate"]:
            self._hr("translate_lessons_to_ro --only-missing")
            call_command("translate_lessons_to_ro", only_missing=True, dry_run=dry)

        self.stdout.write(
            self.style.SUCCESS(
                f"\nPipeline {'(dry run) ' if dry else ''}complete: "
                f"{len(bundles)} bundle(s), {len(fixes)} fix file(s)."
            )
        )

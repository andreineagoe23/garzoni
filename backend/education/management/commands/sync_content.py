from __future__ import annotations

from django.core.management import call_command
from django.core.management.base import BaseCommand, CommandError

ALIASES = {
    "lessons": "lessons",
    "lesson": "lessons",
    "courses": "lessons",
    "course": "lessons",
    "paths": "lessons",
    "path": "lessons",
    "sections": "lessons",
    "section": "lessons",
    "exercises": "exercises",
    "exercise": "exercises",
}


class Command(BaseCommand):
    help = (
        "Unified content pipeline entry point. "
        "Runs versioned, idempotent sync commands for lessons/content and exercises."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--from",
            dest="source_dir",
            default="backend/education/content",
            help=(
                "Reserved for future bundle sources. Current sync uses the repo-bundled "
                "education/content fixtures and manifest."
            ),
        )
        parser.add_argument(
            "--only",
            default="lessons,exercises",
            help=(
                "Comma-separated scopes to run. Supported: lessons, exercises "
                "(aliases: path(s), course(s), section(s), exercise(s))."
            ),
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Preview actions without database writes.",
        )
        parser.add_argument(
            "--force",
            action="store_true",
            help="Re-apply even when release version already matches.",
        )
        parser.add_argument(
            "--noinput",
            action="store_true",
            help="Compatibility flag for non-interactive deploy hooks.",
        )

    def handle(self, *args, **options):
        dry_run = options["dry_run"]
        force = options["force"]
        raw_scopes = [s.strip().lower() for s in (options["only"] or "").split(",") if s.strip()]
        if not raw_scopes:
            raise CommandError("--only cannot be empty.")

        scopes = {ALIASES.get(scope, scope) for scope in raw_scopes}
        unsupported = sorted(scope for scope in scopes if scope not in {"lessons", "exercises"})
        if unsupported:
            raise CommandError(
                f"Unsupported --only scope(s): {', '.join(unsupported)}. "
                "Supported scopes: lessons, exercises."
            )

        if options.get("source_dir") != "backend/education/content":
            self.stdout.write(
                self.style.WARNING(
                    f"--from={options['source_dir']} is currently informational only; "
                    "using repo fixtures under backend/education/content."
                )
            )

        self.stdout.write(
            f"Syncing content scopes: {', '.join(sorted(scopes))} "
            f"(dry_run={dry_run}, force={force})"
        )

        if "lessons" in scopes:
            call_command("sync_content_release", dry_run=dry_run, force=force)

        if "exercises" in scopes:
            call_command("sync_exercises_release", dry_run=dry_run, force=force)

        self.stdout.write(self.style.SUCCESS("sync_content finished successfully."))

"""
Idempotent exercise catalog sync from a repo-bundled fixture (Railway-safe).

Reads `education/content/release_manifest.json` → `exercises_version` and applies
`education/content/exercises_release.json` when the DB state is behind.
Uses Django deserializers so existing primary keys are updated in place (stable IDs
for UserExerciseProgress / completions).

Run automatically from `scripts/railway_predeploy.sh` after `sync_content_release`.
No Railway shell required.

Bump `exercises_version` in the manifest whenever you change the JSON fixture.
"""

from __future__ import annotations

import json
from pathlib import Path

from django.core import serializers
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from education.models import ContentReleaseState

MANIFEST_PATH = Path(__file__).resolve().parents[2] / "content" / "release_manifest.json"
FIXTURE_PATH = Path(__file__).resolve().parents[2] / "content" / "exercises_release.json"
STATE_KEY = "education_exercises"

# Foreign keys: choices and translations depend on Exercise.
MODEL_LOAD_ORDER = [
    "education.exercise",
    "education.exercisetranslation",
    "education.multiplechoicechoice",
]


class Command(BaseCommand):
    help = "Apply versioned exercise fixture from education/content/ (idempotent)."

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Parse fixture and report counts without writing.",
        )
        parser.add_argument(
            "--force",
            action="store_true",
            help="Re-apply fixture even if version already matches.",
        )

    def handle(self, *args, **options):
        dry_run: bool = options["dry_run"]
        force: bool = options["force"]

        if not MANIFEST_PATH.exists():
            raise CommandError(f"Release manifest missing: {MANIFEST_PATH}")

        manifest = json.loads(MANIFEST_PATH.read_text())
        target_version = manifest.get("exercises_version")
        if not target_version:
            self.stdout.write(
                self.style.NOTICE(
                    "No exercises_version in release_manifest.json — skipping exercise sync."
                )
            )
            return

        if not FIXTURE_PATH.exists():
            raise CommandError(
                f"exercises_version is {target_version!r} but fixture file is missing: {FIXTURE_PATH}"
            )

        raw = json.loads(FIXTURE_PATH.read_text())
        if not isinstance(raw, list):
            raise CommandError("exercises_release.json must be a JSON array.")
        if not raw:
            raise CommandError(
                "exercises_release.json is empty but exercises_version is set; "
                "remove exercises_version or populate the fixture."
            )

        allowed = set(MODEL_LOAD_ORDER)
        present = {o.get("model") for o in raw}
        extra = present - allowed
        if extra:
            raise CommandError(
                f"Fixture contains unsupported model(s): {extra}. " f"Allowed: {sorted(allowed)}"
            )

        state = ContentReleaseState.objects.filter(key=STATE_KEY).first()
        if state and state.version == target_version and not force:
            self.stdout.write(
                self.style.SUCCESS(
                    f"Exercise content {target_version!r} already applied ({STATE_KEY})."
                )
            )
            return

        ordered: list[dict] = []
        for model in MODEL_LOAD_ORDER:
            chunk = [o for o in raw if o.get("model") == model]
            chunk.sort(key=lambda o: o.get("pk", 0))
            ordered.extend(chunk)

        self.stdout.write(
            f"Exercise release {target_version}: {len(ordered)} object(s) "
            f"from {FIXTURE_PATH.name}"
        )

        if dry_run:
            self.stdout.write(self.style.NOTICE("Dry run — no database writes."))
            return

        payload = json.dumps(ordered)
        updated = 0

        with transaction.atomic():
            for item in serializers.deserialize("json", payload):
                item.save()
                updated += 1

        ContentReleaseState.objects.update_or_create(
            key=STATE_KEY,
            defaults={"version": target_version},
        )
        self.stdout.write(
            self.style.SUCCESS(
                f"Applied exercise release {target_version}: saved {updated} object(s)."
            )
        )

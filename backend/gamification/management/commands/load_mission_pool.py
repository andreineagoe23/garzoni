"""
Load mission pool from JSON fixture into the database.
Creates missions if they don't exist (matched by name + mission_type); skips if already present.
Run with: python manage.py load_mission_pool [path/to/mission_pool.json]
Default path: gamification/fixtures/mission_pool.json
"""

import json
from pathlib import Path

from django.core.management.base import BaseCommand

from gamification.models import Mission


class Command(BaseCommand):
    help = "Load mission pool from JSON fixture (default: gamification/fixtures/mission_pool.json)"

    def add_arguments(self, parser):
        parser.add_argument(
            "file_path",
            nargs="?",
            default=None,
            help="Path to JSON file (default: gamification/fixtures/mission_pool.json)",
        )

    def handle(self, *args, **options):
        file_path = options.get("file_path")
        if file_path is None:
            base = Path(__file__).resolve().parent.parent.parent
            file_path = base / "fixtures" / "mission_pool.json"
        else:
            file_path = Path(file_path)

        if not file_path.exists():
            self.stderr.write(self.style.ERROR(f"File not found: {file_path}"))
            return

        with open(file_path, "r", encoding="utf-8") as f:
            data = json.load(f)

        if not isinstance(data, list):
            self.stderr.write(self.style.ERROR("JSON root must be an array of mission objects."))
            return

        created = 0
        updated = 0
        for item in data:
            name = item.get("name")
            mission_type = item.get("mission_type", "daily")
            if not name:
                self.stderr.write(self.style.WARNING("Skipping mission with missing name."))
                continue
            if mission_type not in ("daily", "weekly"):
                self.stderr.write(
                    self.style.WARNING(f"Skipping mission '{name}': invalid mission_type.")
                )
                continue
            goal_type = item.get("goal_type", "complete_lesson")
            if goal_type not in [c[0] for c in Mission.GOAL_TYPES]:
                self.stderr.write(
                    self.style.WARNING(f"Skipping mission '{name}': invalid goal_type.")
                )
                continue

            defaults = {
                "description": item.get("description", ""),
                "purpose_statement": item.get("purpose_statement", ""),
                "goal_type": goal_type,
                "goal_reference": item.get("goal_reference") or {},
                "points_reward": int(item.get("points_reward", 20)),
                "is_template": False,
            }
            mission, was_created = Mission.objects.update_or_create(
                name=name,
                mission_type=mission_type,
                defaults=defaults,
            )
            if was_created:
                created += 1
                self.stdout.write(f"Created: {mission.name} ({mission_type})")
            else:
                updated += 1
                self.stdout.write(f"Updated: {mission.name} ({mission_type})")

        self.stdout.write(self.style.SUCCESS(f"Done. Created: {created}, Updated: {updated}"))

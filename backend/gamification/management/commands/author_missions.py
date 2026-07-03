"""
Deterministic sanity-check gate for hand-authored mission content.

This is the missions counterpart to ``education.author_course``: author the
content as a flat JSON bundle on disk, then let this command validate it against
the *real* schema before anything touches the database. No AI round-trips — the
validator is fully deterministic, so the same input always passes or fails the
same way.

Usage:
  python manage.py author_missions                      # validate default pool
  python manage.py author_missions <pool.json>          # validate a specific pool
  python manage.py author_missions <pool.json> --load   # validate, then load if clean
  python manage.py author_missions --quests <quests.json>

Exit status is non-zero when any ERROR is found, so it is safe to gate CI or a
deploy step on it. WARN lines never fail the build.

Pool schema (one object per mission), matching gamification.models.Mission:
  {
    "name": str (<=100 chars, unique per mission_type),
    "description": str (non-empty),
    "purpose_statement": str (recommended),
    "mission_type": "daily" | "weekly",
    "goal_type": one of Mission.GOAL_TYPES,
    "goal_reference": {...}  (keys validated per goal_type),
    "points_reward": int (1..500)
  }

Quests schema (MultiStepMission): validated only for structural sanity and for
"dead steps" — step types that no signal receiver can auto-advance today.
"""

import json
from pathlib import Path

from django.core.management.base import BaseCommand, CommandError

from gamification.models import Mission

# Valid single-goal types come straight from the model so this can never drift.
VALID_GOAL_TYPES = {c[0] for c in Mission.GOAL_TYPES}
VALID_MISSION_TYPES = {"daily", "weekly"}

# Quest step `type` values that a signal receiver actually auto-completes today
# (see gamification/signals.py). Anything else renders but never advances.
AUTO_ADVANCING_STEP_TYPES = {"lesson", "exercise", "tool"}

POINTS_MIN, POINTS_MAX = 1, 500
NAME_MAX = 100

# Known top-level keys — anything else is flagged as a likely typo (WARN).
KNOWN_POOL_KEYS = {
    "name",
    "description",
    "purpose_statement",
    "mission_type",
    "goal_type",
    "goal_reference",
    "points_reward",
}


class Command(BaseCommand):
    help = "Validate a hand-authored mission pool (and optionally quests) before loading."

    def add_arguments(self, parser):
        parser.add_argument(
            "file_path",
            nargs="?",
            default=None,
            help="Path to pool JSON (default: gamification/fixtures/mission_pool.json).",
        )
        parser.add_argument(
            "--quests",
            dest="quests_path",
            default=None,
            help="Path to a MultiStepMission quests JSON to validate.",
        )
        parser.add_argument(
            "--load",
            action="store_true",
            help="If validation passes with zero errors, run load_mission_pool on the pool file.",
        )

    def handle(self, *args, **options):
        errors: list[str] = []
        warnings: list[str] = []

        pool_path = self._resolve_pool_path(options.get("file_path"))
        pool = self._read_json(pool_path)
        if not isinstance(pool, list):
            raise CommandError(f"{pool_path}: JSON root must be an array of mission objects.")
        self._validate_pool(pool, errors, warnings)

        quests_path = options.get("quests_path")
        if quests_path:
            quests = self._read_json(Path(quests_path))
            if not isinstance(quests, list):
                raise CommandError(f"{quests_path}: quests JSON root must be an array.")
            self._validate_quests(quests, errors, warnings)

        for w in warnings:
            self.stdout.write(self.style.WARNING("WARN: " + w))
        for e in errors:
            self.stdout.write(self.style.ERROR("ERROR: " + e))

        self.stdout.write(
            f"Checked {len(pool)} missions: {len(errors)} error(s), {len(warnings)} warning(s)."
        )

        if errors:
            raise CommandError(f"Validation failed with {len(errors)} error(s). Nothing loaded.")

        self.stdout.write(self.style.SUCCESS("Validation passed."))

        if options.get("load"):
            self.stdout.write("Loading validated pool via load_mission_pool ...")
            from django.core.management import call_command

            call_command("load_mission_pool", str(pool_path))

    # ── helpers ──────────────────────────────────────────────────────────

    def _resolve_pool_path(self, raw: str | None) -> Path:
        if raw:
            return Path(raw)
        base = Path(__file__).resolve().parent.parent.parent
        return base / "fixtures" / "mission_pool.json"

    def _read_json(self, path: Path):
        if not path.exists():
            raise CommandError(f"File not found: {path}")
        try:
            return json.loads(path.read_text(encoding="utf-8"))
        except json.JSONDecodeError as exc:
            raise CommandError(f"{path}: invalid JSON — {exc}")

    def _validate_pool(self, pool: list, errors: list[str], warnings: list[str]) -> None:
        seen: set[tuple[str, str]] = set()
        for i, item in enumerate(pool):
            tag = f"mission[{i}]"
            if not isinstance(item, dict):
                errors.append(f"{tag}: not an object.")
                continue

            name = item.get("name")
            if not name or not isinstance(name, str):
                errors.append(f"{tag}: missing or non-string 'name'.")
                name = name or f"<index {i}>"
            elif len(name) > NAME_MAX:
                errors.append(f"{tag} '{name}': name exceeds {NAME_MAX} chars.")
            tag = f"mission '{name}'"

            for unknown in set(item) - KNOWN_POOL_KEYS:
                warnings.append(f"{tag}: unknown key '{unknown}' (typo?).")

            desc = item.get("description")
            if not desc or not isinstance(desc, str) or not desc.strip():
                errors.append(f"{tag}: missing or empty 'description'.")
            if not (item.get("purpose_statement") or "").strip():
                warnings.append(f"{tag}: missing 'purpose_statement' (falls back to generic copy).")

            mission_type = item.get("mission_type")
            if mission_type not in VALID_MISSION_TYPES:
                errors.append(
                    f"{tag}: mission_type {mission_type!r} not in {sorted(VALID_MISSION_TYPES)}."
                )

            points = item.get("points_reward")
            if not isinstance(points, int) or isinstance(points, bool):
                errors.append(f"{tag}: points_reward must be an int, got {points!r}.")
            elif not (POINTS_MIN <= points <= POINTS_MAX):
                errors.append(
                    f"{tag}: points_reward {points} out of range [{POINTS_MIN},{POINTS_MAX}]."
                )

            goal_type = item.get("goal_type")
            if goal_type not in VALID_GOAL_TYPES:
                errors.append(
                    f"{tag}: goal_type {goal_type!r} not in {sorted(VALID_GOAL_TYPES)} "
                    f"(load_mission_pool would silently skip this)."
                )
            else:
                self._validate_goal_reference(tag, goal_type, item.get("goal_reference"), errors)

            if isinstance(name, str) and mission_type in VALID_MISSION_TYPES:
                key = (name, mission_type)
                if key in seen:
                    errors.append(f"{tag}: duplicate (name, mission_type) — collides on load.")
                seen.add(key)

    def _validate_goal_reference(self, tag: str, goal_type: str, ref, errors: list[str]) -> None:
        """Mirror Mission.clean() so bad references are caught before the DB rejects them."""
        if ref is None:
            ref = {}
        if not isinstance(ref, dict):
            errors.append(f"{tag}: goal_reference must be an object.")
            return

        if goal_type == "complete_lesson":
            n = ref.get("required_lessons", 1)
            if not isinstance(n, int) or isinstance(n, bool) or n < 1:
                errors.append(f"{tag}: required_lessons must be an int >= 1, got {n!r}.")
        elif goal_type == "add_savings":
            target = ref.get("target", 100)
            if isinstance(target, bool) or not isinstance(target, (int, float)) or target <= 0:
                errors.append(f"{tag}: target must be a positive number, got {target!r}.")
        elif goal_type == "clear_review_queue":
            n = ref.get("target_count", 5)
            if not isinstance(n, int) or isinstance(n, bool) or n < 1:
                errors.append(f"{tag}: target_count must be an int >= 1, got {n!r}.")
        # read_fact / complete_path / streak_rescue take no required keys.

    def _validate_quests(self, quests: list, errors: list[str], warnings: list[str]) -> None:
        seen_slugs: set[str] = set()
        seen_step_ids: set[str] = set()
        for i, q in enumerate(quests):
            tag = f"quest[{i}]"
            if not isinstance(q, dict):
                errors.append(f"{tag}: not an object.")
                continue
            name = q.get("name") or f"<index {i}>"
            tag = f"quest '{name}'"

            slug = q.get("slug")
            if not slug or not isinstance(slug, str):
                errors.append(f"{tag}: missing 'slug' (unique key).")
            elif slug in seen_slugs:
                errors.append(f"{tag}: duplicate slug '{slug}'.")
            else:
                seen_slugs.add(slug)

            steps = q.get("steps")
            if not isinstance(steps, list) or not steps:
                errors.append(f"{tag}: 'steps' must be a non-empty array.")
                continue
            for j, step in enumerate(steps):
                stag = f"{tag} step[{j}]"
                if not isinstance(step, dict):
                    errors.append(f"{stag}: not an object.")
                    continue
                sid = step.get("id")
                if not sid:
                    errors.append(f"{stag}: missing 'id' (needed for completion tracking).")
                elif sid in seen_step_ids:
                    warnings.append(f"{stag}: step id '{sid}' reused across quests.")
                else:
                    seen_step_ids.add(sid)
                stype = step.get("type")
                if stype not in AUTO_ADVANCING_STEP_TYPES:
                    warnings.append(
                        f"{stag}: type {stype!r} has no auto-advance signal — "
                        f"DEAD STEP (never completes). Use one of "
                        f"{sorted(AUTO_ADVANCING_STEP_TYPES)}."
                    )

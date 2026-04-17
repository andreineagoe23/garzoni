"""
Mission cycle identifiers for periodized MissionCompletion rows.

Daily missions use ISO calendar date; weekly missions use ISO year-week.
Legacy rows use cycle_id="" (empty) until the next scheduled rotation archives them.
"""

from __future__ import annotations

from django.utils import timezone
from django.db.models import QuerySet

from gamification.models import Mission, MissionCompletion


def local_cycle_date(dt=None):
    """Resolve the local calendar date used for mission cycles."""
    if dt is None:
        return timezone.localdate()
    if hasattr(dt, "date") and hasattr(dt, "tzinfo"):
        return timezone.localtime(dt).date() if dt.tzinfo else dt.date()
    return dt


def daily_cycle_id(dt=None) -> str:
    return local_cycle_date(dt).isoformat()


def weekly_cycle_id(dt=None) -> str:
    d = local_cycle_date(dt)
    y, w, _ = d.isocalendar()
    return f"{y}-W{w:02d}"


def cycle_id_for_mission(mission: Mission, dt=None) -> str:
    if mission.mission_type == "daily":
        return daily_cycle_id(dt)
    if mission.mission_type == "weekly":
        return weekly_cycle_id(dt)
    return ""


def get_current_mission_completion(
    user, mission_id: int, *, select_for_update: bool = False
) -> MissionCompletion | None:
    mission = Mission.objects.filter(pk=mission_id).first()
    if not mission:
        return None
    cid = cycle_id_for_mission(mission)
    qs = MissionCompletion.objects.filter(user=user, mission_id=mission_id, cycle_id=cid)
    if select_for_update:
        qs = qs.select_for_update()
    return qs.first()


def get_or_create_current_mission_completion(
    user, mission: Mission, defaults: dict | None = None
) -> tuple[MissionCompletion, bool]:
    cid = cycle_id_for_mission(mission)
    return MissionCompletion.objects.get_or_create(
        user=user,
        mission=mission,
        cycle_id=cid,
        defaults=defaults or {"progress": 0, "status": "not_started"},
    )


def ensure_current_cycle_mission_completions(
    user,
    mission_type: str,
    defaults: dict | None = None,
) -> int:
    """
    Ensure the user has a current-cycle MissionCompletion row for all missions
    of the given type. Returns number of rows created.
    """
    missions: QuerySet[Mission] = Mission.objects.filter(mission_type=mission_type)
    created_count = 0
    for mission in missions.iterator(chunk_size=200):
        _, created = get_or_create_current_mission_completion(
            user,
            mission,
            defaults=defaults,
        )
        if created:
            created_count += 1
    return created_count

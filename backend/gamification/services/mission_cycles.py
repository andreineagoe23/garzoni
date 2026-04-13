"""
Mission cycle identifiers for periodized MissionCompletion rows.

Daily missions use ISO calendar date; weekly missions use ISO year-week.
Legacy rows use cycle_id="" (empty) until the next scheduled rotation archives them.
"""

from __future__ import annotations

from django.utils import timezone

from gamification.models import Mission, MissionCompletion


def daily_cycle_id(dt=None) -> str:
    dt = dt or timezone.now()
    return dt.date().isoformat()


def weekly_cycle_id(dt=None) -> str:
    dt = dt or timezone.now()
    y, w, _ = dt.isocalendar()
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

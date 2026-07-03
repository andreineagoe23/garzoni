"""
Mission cycle identifiers and per-cycle mission selection.

Daily missions use ISO calendar date; weekly missions use ISO year-week.
Legacy rows use cycle_id="" (empty) until the next scheduled rotation archives them.

Under MISSIONS_LAZY_ASSIGNMENT the set of missions a user sees each cycle is
*computed* (deterministic seeded pick from the pool), not stored — a
MissionCompletion row is only materialized when the mission is actually
touched (progress, swap, manual completion).
"""

from __future__ import annotations

import hashlib
import random

from django.core.cache import cache
from django.utils import timezone
from django.db.models import QuerySet

from gamification.models import Mission, MissionCompletion

MISSION_POOL_CACHE_TTL = 300
# Key includes the database name: dev and test share one Redis in the docker
# stack, and a pool cached from one database must never serve the other.
_MISSION_POOL_CACHE_KEY = "mission_pool:v1:{db}:{mission_type}"

# Plain dicts (not pickled model instances) so cached entries survive model
# changes across deploys. Everything the display payload and the progress
# triggers need.
_POOL_FIELDS = (
    "id",
    "name",
    "description",
    "points_reward",
    "mission_type",
    "goal_type",
    "goal_reference",
    "purpose_statement",
)


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

    Legacy (eager) path only — under MISSIONS_LAZY_ASSIGNMENT rows are
    materialized per-pick by :func:`touch_assigned_completions` instead.
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


def _pool_cache_key(mission_type: str) -> str:
    from django.db import connection

    return _MISSION_POOL_CACHE_KEY.format(
        db=connection.settings_dict.get("NAME", "default"), mission_type=mission_type
    )


def _pool_query(mission_type: str) -> list[dict]:
    return list(
        Mission.objects.filter(mission_type=mission_type, is_template=False)
        .order_by("id")
        .values(*_POOL_FIELDS)
    )


def get_mission_pool(mission_type: str) -> list[dict]:
    """Non-template mission pool for a type as id-ordered dicts, cached
    briefly — the pool changes only on content deploys. Empty pools are not
    cached so a fresh database can't poison the key. Test databases bypass
    the cache entirely: test transactions roll back without firing the
    invalidation signals, so cached entries would leak across tests."""
    from django.db import connection

    if str(connection.settings_dict.get("NAME") or "").startswith("test_"):
        return _pool_query(mission_type)
    key = _pool_cache_key(mission_type)
    pool = cache.get(key)
    if pool is None:
        pool = _pool_query(mission_type)
        if pool:
            cache.set(key, pool, MISSION_POOL_CACHE_TTL)
    return pool


def invalidate_mission_pool_cache() -> None:
    for mission_type in ("daily", "weekly"):
        cache.delete(_pool_cache_key(mission_type))


def _stable_seed(seed_str: str) -> int:
    """Process-independent RNG seed (builtin ``hash`` is randomized per
    process, which made per-worker picks disagree)."""
    return int(hashlib.md5(seed_str.encode()).hexdigest()[:8], 16)


def _diverse_pick(missions: list[dict], n: int) -> list[dict]:
    """Pick n missions prioritising goal_type diversity: one per type first,
    then backfill in shuffled order."""
    first_pass: list[dict] = []
    second_pass: list[dict] = []
    seen_types: set[str] = set()
    for m in missions:
        if m["goal_type"] not in seen_types:
            seen_types.add(m["goal_type"])
            first_pass.append(m)
        else:
            second_pass.append(m)
    result = first_pass[:n]
    if len(result) < n:
        result += second_pass[: n - len(result)]
    return result


def select_cycle_missions(
    user_id: int,
    mission_type: str,
    cycle_id: str | None = None,
    count: int = 4,
    exclude_ids: frozenset[int] | set[int] = frozenset(),
) -> list[dict]:
    """Deterministic per-user, per-cycle mission picks (as pool dicts).

    Same (user, cycle) always yields the same picks with zero writes, so the
    display set, the progress triggers, and the swap flow all agree without a
    stored assignment."""
    cid = cycle_id or (daily_cycle_id() if mission_type == "daily" else weekly_cycle_id())
    items = [m for m in get_mission_pool(mission_type) if m["id"] not in exclude_ids]
    rng = random.Random(_stable_seed(f"{user_id}-{mission_type}-{cid}"))
    rng.shuffle(items)
    return _diverse_pick(items, count)

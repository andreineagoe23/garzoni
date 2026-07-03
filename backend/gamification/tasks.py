"""Celery tasks for gamification (mission cycles + retention behind GAMIFICATION_RETENTION_V2)."""

from __future__ import annotations

import logging

from celery import shared_task
from django.conf import settings
from django.utils import timezone

from gamification.models import MissionCompletion

logger = logging.getLogger(__name__)


def _archive_legacy_rows(mission_type: str) -> int:
    """Retire pre-cycle rows (cycle_id="") in one bulk UPDATE. Dated rows from
    prior cycles need no archiving — reads filter on the current cycle id."""
    from django.db.models import CharField, Value
    from django.db.models.functions import Cast, Concat

    return MissionCompletion.objects.filter(mission__mission_type=mission_type, cycle_id="").update(
        cycle_id=Concat(Value("x"), Cast("id", output_field=CharField()))
    )


def _rotate_cycle_eager(mission_type: str, current_cycle_id: str) -> None:
    """Legacy eager rotation: archive prior rows, re-open the full pool per
    user. O(users × pool) — only runs with MISSIONS_LAZY_ASSIGNMENT off."""
    rows = (
        MissionCompletion.objects.filter(mission__mission_type=mission_type)
        .exclude(cycle_id=current_cycle_id)
        .exclude(cycle_id__startswith="x")
    )
    for mc in rows.iterator(chunk_size=500):
        archive_id = f"x{mc.pk}"[:40]
        MissionCompletion.objects.filter(pk=mc.pk).update(cycle_id=archive_id)
        MissionCompletion.objects.get_or_create(
            user_id=mc.user_id,
            mission_id=mc.mission_id,
            cycle_id=current_cycle_id,
            defaults={
                "progress": 0,
                "status": "not_started",
                "completed_at": None,
                "completion_idempotency_key": None,
                "xp_awarded": 0,
            },
        )


@shared_task(name="gamification.models.reset_daily_missions")
def reset_daily_missions():
    """
    Rotate daily mission cycles. Lazy mode: one bulk archive of legacy rows —
    new-cycle rows materialize on first touch. Eager mode keeps the historical
    per-user re-open loop.

    Registered as ``gamification.models.reset_daily_missions`` so Beat schedules and
    django_celery_beat PeriodicTask rows keep a stable task name after the move from models.py.
    """
    from gamification.services.mission_cycles import daily_cycle_id

    if getattr(settings, "MISSIONS_LAZY_ASSIGNMENT", False):
        return _archive_legacy_rows("daily")
    _rotate_cycle_eager("daily", daily_cycle_id())


@shared_task(name="gamification.models.reset_weekly_missions")
def reset_weekly_missions():
    """
    Rotate weekly mission cycles similarly to daily rotation.

    Same stable Celery name as when this lived in ``gamification.models``.
    """
    from gamification.services.mission_cycles import weekly_cycle_id

    if getattr(settings, "MISSIONS_LAZY_ASSIGNMENT", False):
        return _archive_legacy_rows("weekly")
    _rotate_cycle_eager("weekly", weekly_cycle_id())


@shared_task(name="gamification.tasks.spawn_streak_rescue_missions")
def spawn_streak_rescue_missions():
    """
    Ensure streak-rescue missions exist for users whose streak is active but who
    have not yet studied today (soft 'at risk' nudge).
    """
    if not getattr(settings, "GAMIFICATION_RETENTION_V2", False):
        return 0

    from datetime import timedelta

    from authentication.models import UserProfile
    from gamification.models import Mission
    from gamification.services.mission_cycles import get_or_create_current_mission_completion

    today = timezone.localdate()
    yesterday = today - timedelta(days=1)

    missions = list(
        Mission.objects.filter(goal_type="streak_rescue", is_template=True).order_by("id")[:20]
    )
    if not missions:
        missions = list(Mission.objects.filter(goal_type="streak_rescue").order_by("id")[:10])

    if not missions:
        logger.info("spawn_streak_rescue_missions: no streak_rescue missions configured")
        return 0

    touched = 0
    qs = UserProfile.objects.select_related("user").filter(
        streak__gte=3,
        last_completed_date=yesterday,
    )
    for profile in qs.iterator(chunk_size=200):
        user = profile.user
        for mission in missions:
            get_or_create_current_mission_completion(
                user,
                mission,
                defaults={"progress": 0, "status": "not_started"},
            )
            touched += 1
    return touched


@shared_task(name="gamification.tasks.evaluate_badges_task", ignore_result=True, time_limit=60)
def evaluate_badges_task(user_id: int) -> None:
    """Full badge-criteria sweep for one user, off the request path.

    Dispatched (debounced) from ``grant_reward`` so a burst of grants —
    lesson + sections + mission in one action — coalesces into a single
    evaluation. The debounce lock is cleared before evaluating so grants
    that land mid-sweep can schedule a fresh pass.
    """
    from django.contrib.auth.models import User
    from django.core.cache import cache

    from gamification.utils import evaluate_badges_for_user

    cache.delete(f"badge_eval_pending:{user_id}")
    user = User.objects.filter(pk=user_id).first()
    if user is None:
        return
    try:
        evaluate_badges_for_user(user)
    except Exception:
        logger.exception("evaluate_badges_task failed user_id=%s", user_id)


@shared_task(name="gamification.tasks.finalize_due_duels")
def finalize_due_duels():
    """Score and award duels whose `ends_at` has passed; expire pending duels older than 24h."""
    from datetime import timedelta
    from gamification.models import Duel
    from gamification.services.duels import finalize_duel

    now = timezone.now()

    due_active = Duel.objects.filter(status=Duel.STATUS_ACTIVE, ends_at__lte=now)
    finalized = 0
    for duel in due_active.iterator(chunk_size=100):
        try:
            finalize_duel(duel)
            finalized += 1
        except Exception:
            logger.exception("finalize_due_duels: failed to finalize duel %s", duel.id)

    pending_cutoff = now - timedelta(hours=24)
    stale_pending = Duel.objects.filter(status=Duel.STATUS_PENDING, created_at__lte=pending_cutoff)
    expired = stale_pending.update(status=Duel.STATUS_EXPIRED, finished_at=now)

    logger.info("finalize_due_duels finalized=%s expired_pending=%s", finalized, expired)
    return {"finalized": finalized, "expired_pending": expired}

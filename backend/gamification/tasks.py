"""Celery tasks for gamification (mission cycles + retention behind GAMIFICATION_RETENTION_V2)."""

from __future__ import annotations

import logging

from celery import shared_task
from django.conf import settings
from django.utils import timezone

from gamification.models import MissionCompletion

logger = logging.getLogger(__name__)


@shared_task(name="gamification.models.reset_daily_missions")
def reset_daily_missions():
    """
    Rotate daily mission cycles: archive prior cycle rows and open a fresh row per user/mission.
    Historical rows remain queryable (no destructive wipe).

    Registered as ``gamification.models.reset_daily_missions`` so Beat schedules and
    django_celery_beat PeriodicTask rows keep a stable task name after the move from models.py.
    """
    from gamification.services.mission_cycles import daily_cycle_id

    today_id = daily_cycle_id()

    daily_rows = (
        MissionCompletion.objects.filter(mission__mission_type="daily")
        .exclude(cycle_id=today_id)
        .exclude(cycle_id__startswith="x")
    )
    for mc in daily_rows.iterator(chunk_size=500):
        archive_id = f"x{mc.pk}"[:40]
        MissionCompletion.objects.filter(pk=mc.pk).update(cycle_id=archive_id)
        MissionCompletion.objects.get_or_create(
            user_id=mc.user_id,
            mission_id=mc.mission_id,
            cycle_id=today_id,
            defaults={
                "progress": 0,
                "status": "not_started",
                "completed_at": None,
                "completion_idempotency_key": None,
                "xp_awarded": 0,
            },
        )


@shared_task(name="gamification.models.reset_weekly_missions")
def reset_weekly_missions():
    """
    Rotate weekly mission cycles similarly to daily rotation.

    Same stable Celery name as when this lived in ``gamification.models``.
    """
    from gamification.services.mission_cycles import weekly_cycle_id

    wk = weekly_cycle_id()

    weekly_rows = (
        MissionCompletion.objects.filter(mission__mission_type="weekly")
        .exclude(cycle_id=wk)
        .exclude(cycle_id__startswith="x")
    )
    for mc in weekly_rows.iterator(chunk_size=500):
        archive_id = f"x{mc.pk}"[:40]
        MissionCompletion.objects.filter(pk=mc.pk).update(cycle_id=archive_id)
        MissionCompletion.objects.get_or_create(
            user_id=mc.user_id,
            mission_id=mc.mission_id,
            cycle_id=wk,
            defaults={
                "progress": 0,
                "status": "not_started",
                "completed_at": None,
                "completion_idempotency_key": None,
                "xp_awarded": 0,
            },
        )


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

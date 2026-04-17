"""Celery tasks for gamification retention (behind GAMIFICATION_RETENTION_V2)."""

from __future__ import annotations

import logging

from celery import shared_task
from django.conf import settings
from django.utils import timezone

logger = logging.getLogger(__name__)


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

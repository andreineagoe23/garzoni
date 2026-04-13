import hashlib
import logging

from django.db import transaction
from django.utils import timezone

from decimal import Decimal

from gamification.models import (
    Mission,
    MissionCompletion,
    MissionPerformance,
    StreakItem,
)
from gamification.services.mission_cycles import (
    cycle_id_for_mission,
    get_or_create_current_mission_completion,
)
from gamification.services.rewards import grant_reward
from education.models import Mastery

logger = logging.getLogger(__name__)


def track_mission_performance(user, mission_completion, completion_data):
    """Track mission performance metrics for analytics."""
    try:
        mastery_before = {}
        mastery_after = {}

        if mission_completion.mission.goal_type == "complete_lesson":
            skills = Mastery.objects.filter(user=user).values("skill", "proficiency")
            mastery_before = {m["skill"]: m["proficiency"] for m in skills}

        MissionPerformance.objects.create(
            user=user,
            mission=mission_completion.mission,
            completion=mission_completion,
            time_to_completion_seconds=completion_data.get("completion_time_seconds"),
            mastery_before=mastery_before,
            mastery_after=mastery_after,
        )
    except Exception as exc:
        logger.error("Error tracking mission performance: %s", exc)


def _get_or_generate_idempotency_key(user_id, mission_id):
    key_data = f"{user_id}_{mission_id}_{timezone.now().isoformat()}"
    return hashlib.sha256(key_data.encode()).hexdigest()


def complete_mission(user, mission_id, idempotency_key, completion_data):
    if not idempotency_key:
        idempotency_key = _get_or_generate_idempotency_key(user.id, mission_id)

    with transaction.atomic():
        existing = (
            MissionCompletion.objects.select_for_update()
            .filter(completion_idempotency_key=idempotency_key)
            .first()
        )
        if existing:
            return {
                "message": "Mission already completed.",
                "xp_awarded": existing.xp_awarded,
                "progress": existing.progress,
                "status": existing.status,
            }, 200

        mission = Mission.objects.select_for_update().get(pk=mission_id)
        mc, _ = get_or_create_current_mission_completion(
            user, mission, defaults={"progress": 0, "status": "not_started"}
        )
        mission_completion = MissionCompletion.objects.select_for_update().get(pk=mc.pk)

        if mission_completion.status == "completed":
            return {
                "error": "Mission already completed.",
                "xp_awarded": mission_completion.xp_awarded,
            }, 400

        base_xp = mission_completion.mission.points_reward
        xp_multiplier = 1.0

        first_try = completion_data.get("first_try", False)
        hints_used = completion_data.get("hints_used", 0)
        attempts = completion_data.get("attempts", 1)

        if first_try and attempts == 1 and hints_used == 0:
            mission_completion.first_try_bonus = True
            xp_multiplier += 0.2

        if mission_completion.mission.goal_type == "complete_lesson":
            mastery_bonus = completion_data.get("mastery_bonus", False)
            if mastery_bonus:
                mission_completion.mastery_bonus = True
                xp_multiplier += 0.15

        streak_item = (
            StreakItem.objects.select_for_update()
            .filter(user=user, item_type="streak_boost", quantity__gt=0)
            .first()
        )
        if streak_item:
            xp_multiplier += 0.3
            streak_item.quantity -= 1
            streak_item.save(update_fields=["quantity"])

        final_xp = int(base_xp * xp_multiplier)

        mission_completion.progress = 100
        mission_completion.status = "completed"
        mission_completion.completed_at = timezone.now()
        mission_completion.completion_idempotency_key = idempotency_key
        mission_completion.xp_awarded = final_xp

        if completion_data.get("completion_time_seconds"):
            mission_completion.completion_time_seconds = completion_data.get(
                "completion_time_seconds"
            )

        mission_completion.save()

        grant_reward(
            user,
            f"mission_manual:{idempotency_key}",
            points=final_xp,
            coins=Decimal("0"),
            bump_streak="none",
            evaluate_badges=True,
        )
        track_mission_performance(user, mission_completion, completion_data)

        logger.info(
            "mission_completed",
            extra={
                "user_id": user.id,
                "mission_id": mission_id,
                "xp_awarded": final_xp,
                "first_try": mission_completion.first_try_bonus,
                "mastery_bonus": mission_completion.mastery_bonus,
            },
        )

        return {
            "message": "Mission completed successfully.",
            "xp_awarded": final_xp,
            "progress": 100,
            "status": "completed",
        }, 200


def generate_mastery_aware_mission(user, mission_type):
    weakest_skills = Mastery.objects.filter(user=user).order_by("proficiency", "due_at")[:3]

    if not weakest_skills.exists():
        return (
            Mission.objects.filter(mission_type=mission_type, is_template=False)
            .exclude(completions__user=user, completions__status="completed")
            .first()
        )

    target_skill = weakest_skills.first().skill

    mission = (
        Mission.objects.filter(
            mission_type=mission_type,
            target_weakest_skills=True,
            goal_type="complete_lesson",
            is_template=False,
        )
        .exclude(completions__user=user, completions__status="completed")
        .first()
    )

    if mission:
        goal_ref = mission.goal_reference or {}
        goal_ref["target_skill"] = target_skill
        mission.goal_reference = goal_ref
        mission.save(update_fields=["goal_reference"])
        return mission

    return (
        Mission.objects.filter(mission_type=mission_type, is_template=False)
        .exclude(completions__user=user, completions__status="completed")
        .first()
    )


def swap_mission(user, mission_id):
    with transaction.atomic():
        mission_row = Mission.objects.select_for_update().get(pk=mission_id)
        cid = cycle_id_for_mission(mission_row)
        mission_completions = (
            MissionCompletion.objects.select_for_update()
            .filter(user=user, mission_id=mission_id, cycle_id=cid)
            .order_by("-id")
        )

        if not mission_completions.exists():
            get_or_create_current_mission_completion(
                user,
                mission_row,
                defaults={"progress": 0, "status": "not_started"},
            )
            mission_completions = (
                MissionCompletion.objects.select_for_update()
                .filter(user=user, mission_id=mission_id, cycle_id=cid)
                .order_by("-id")
            )
        if not mission_completions.exists():
            return {"error": "Mission not found for this user."}, 404

        mission_completion = mission_completions.first()

        if mission_completions.count() > 1:
            logger.warning(
                "Found %s duplicate MissionCompletion records for user %s, mission %s. Keeping most recent.",
                mission_completions.count(),
                user.id,
                mission_id,
            )
            mission_completions.exclude(id=mission_completion.id).delete()

        today = timezone.now().date()
        swapped_today = MissionCompletion.objects.filter(user=user, swapped_at__date=today).exists()
        if swapped_today:
            return {"error": "You can only swap one mission per day."}, 400

        if mission_completion.status == "completed":
            return {"error": "Cannot swap a completed mission."}, 400

        new_mission = generate_mastery_aware_mission(user, mission_completion.mission.mission_type)
        if not new_mission:
            return {"error": "No suitable replacement mission available."}, 400

        MissionCompletion.objects.create(
            user=user,
            mission=new_mission,
            cycle_id=cycle_id_for_mission(new_mission),
            progress=0,
            status="not_started",
            swapped_from_mission=mission_completion,
        )

        mission_completion.swapped_at = timezone.now()
        mission_completion.status = "not_started"
        mission_completion.progress = 0
        mission_completion.save(update_fields=["swapped_at", "status", "progress"])

        return {
            "message": "Mission swapped successfully.",
            "new_mission": {
                "id": new_mission.id,
                "name": new_mission.name,
                "description": new_mission.description,
                "points_reward": new_mission.points_reward,
            },
        }, 200


def generate_mastery_aware_missions(user, mission_type):
    weakest_skills = Mastery.objects.filter(user=user).order_by("proficiency", "due_at")[:5]
    generated = []

    for mastery in weakest_skills:
        mission, created = Mission.objects.get_or_create(
            name=f"Master {mastery.skill}",
            mission_type=mission_type,
            defaults={
                "description": f"Complete lessons focusing on {mastery.skill}",
                "points_reward": 50,
                "goal_type": "complete_lesson",
                "goal_reference": {
                    "required_lessons": 1,
                    "target_skill": mastery.skill,
                },
                "target_weakest_skills": True,
            },
        )

        get_or_create_current_mission_completion(
            user,
            mission,
            defaults={
                "progress": 0,
                "status": "not_started",
            },
        )

        if created:
            generated.append(mission)

    return generated

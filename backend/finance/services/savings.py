from decimal import Decimal
import logging

from django.db import transaction
from django.utils import timezone

from finance.models import SimulatedSavingsAccount
from gamification.services.missions import (
    current_mission_deltas,
    touch_assigned_completions,
)
from gamification.services.rewards import grant_reward

logger = logging.getLogger(__name__)


def _complete_savings_mission(user, completion):
    """Finalize a savings mission and grant its XP.

    Uses the same event key as MissionCompletion.update_progress's auto-complete
    path, so whichever code path finishes the mission first wins and the other
    is an idempotent no-op.
    """
    completion.status = "completed"
    completion.completed_at = timezone.now()
    base_xp = int(completion.mission.points_reward or 0)
    if completion.xp_awarded == 0 and base_xp > 0:
        result = grant_reward(
            user,
            f"mission_auto_complete:{user.id}:{completion.mission_id}:{completion.cycle_id}",
            points=base_xp,
            coins=Decimal("0"),
            bump_streak="none",
            evaluate_badges=True,
        )
        if result.granted:
            completion.xp_awarded = base_xp


def add_savings_and_update_missions(user, amount):
    """Add to the simulated savings pot and advance add_savings missions.

    Returns ``(account, mission_deltas)`` where ``mission_deltas`` is the
    /missions/-shaped list of current-cycle add_savings rows after the update,
    for merging into cached client state.
    """
    amount = Decimal(str(amount))
    today = timezone.now().date()

    with transaction.atomic():
        (
            account,
            created,
        ) = SimulatedSavingsAccount.objects.select_for_update().get_or_create(
            user=user, defaults={"balance": amount}
        )
        if not created:
            account.add_to_balance(amount)

        missions = (
            touch_assigned_completions(user, ["add_savings"])
            .filter(status__in=["not_started", "in_progress"])
            .select_for_update()
        )

        for completion in missions:
            mission_type = completion.mission.mission_type
            target = Decimal(str(completion.mission.goal_reference.get("target", 100)))

            if (
                mission_type == "daily"
                and completion.completed_at is not None
                and completion.completed_at.date() == today
            ):
                continue

            increment = (amount / target) * 100
            completion.progress = min(completion.progress + increment, 100)

            if completion.progress >= 100:
                _complete_savings_mission(user, completion)

            completion.save()

    logger.info(
        "savings_updated",
        extra={
            "user_id": user.id,
            "amount": str(amount),
            "balance": str(account.balance),
        },
    )
    return account, current_mission_deltas(user, ["add_savings"])

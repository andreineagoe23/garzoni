from decimal import Decimal
import logging

from django.db import transaction
from django.utils import timezone

from finance.models import SimulatedSavingsAccount
from gamification.models import MissionCompletion

logger = logging.getLogger(__name__)


def add_savings_and_update_missions(user, amount):
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
            MissionCompletion.objects.select_related("mission")
            .select_for_update()
            .filter(
                user=user,
                mission__goal_type="add_savings",
                status__in=["not_started", "in_progress"],
            )
        )

        for completion in missions:
            mission_type = completion.mission.mission_type
            target = Decimal(str(completion.mission.goal_reference.get("target", 100)))

            if mission_type == "daily":
                if completion.completed_at is not None and completion.completed_at.date() == today:
                    continue

                increment = (amount / target) * 100
                completion.progress = min(completion.progress + increment, 100)

                if completion.progress >= 100:
                    completion.status = "completed"
                    completion.completed_at = timezone.now()

            elif mission_type == "weekly":
                increment = (amount / target) * 100
                completion.progress = min(completion.progress + increment, 100)

                if completion.progress >= 100:
                    completion.status = "completed"
                    completion.completed_at = timezone.now()

            completion.save()

    logger.info(
        "savings_updated",
        extra={
            "user_id": user.id,
            "amount": str(amount),
            "balance": str(account.balance),
        },
    )
    return account

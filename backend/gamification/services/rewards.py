"""
Unified reward grants with idempotency, streak handling, and badge evaluation hooks.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from decimal import Decimal
from typing import TYPE_CHECKING, Literal

from django.contrib.auth.models import User
from django.db import IntegrityError, transaction

from authentication.services.profile import invalidate_profile_cache

if TYPE_CHECKING:
    from education.models import UserProgress

logger = logging.getLogger(__name__)

# --- Reward cadence (balanced defaults; single source of truth) ---
XP_LESSON_FIRST_COMPLETION = 10
COINS_LESSON_FIRST_COMPLETION = Decimal("5.00")

XP_SECTION_FIRST_COMPLETION = 8
COINS_SECTION_FIRST_COMPLETION = Decimal("4.00")

XP_COURSE_COMPLETE = 50
COINS_COURSE_COMPLETE = Decimal("50.00")

XP_PATH_COMPLETE = 100
COINS_PATH_COMPLETE = Decimal("100.00")

XP_QUIZ_PASS = 20
COINS_QUIZ_PASS = Decimal("10.00")

# Extra XP the first time a user passes a given quiz (one-time per quiz, server-enforced).
XP_QUIZ_FIRST_COMPLETION_BONUS = 5

# Exercise grants mirror returned xp_delta magnitudes; cap per attempt to reduce farming.
XP_EXERCISE_ATTEMPT_CAP = 120

# Streak milestone bonuses (profile streak days crossed upward)
STREAK_MILESTONE_REWARDS: dict[int, tuple[int, Decimal]] = {
    3: (10, Decimal("2.00")),
    7: (25, Decimal("5.00")),
    14: (50, Decimal("10.00")),
    30: (100, Decimal("20.00")),
}

BumpStreakMode = Literal["none", "profile", "user_progress"]


@dataclass(frozen=True)
class GrantResult:
    granted: bool
    duplicate: bool
    points: int
    coins: Decimal


def _quantize_coins(value: Decimal) -> Decimal:
    return value.quantize(Decimal("0.01"))


def _maybe_streak_milestones(user: User, streak_before: int, streak_after: int) -> None:
    if streak_after <= streak_before:
        return
    for threshold in sorted(STREAK_MILESTONE_REWARDS.keys()):
        if streak_before < threshold <= streak_after:
            bonus_xp, bonus_coins = STREAK_MILESTONE_REWARDS[threshold]
            grant_reward(
                user,
                f"streak_milestone:{user.id}:{threshold}",
                points=bonus_xp,
                coins=bonus_coins,
                bump_streak="none",
                evaluate_badges=True,
            )


def _apply_streak_bump(
    user: User,
    mode: BumpStreakMode,
    user_progress: UserProgress | None,
) -> tuple[int, int]:
    """
    Returns (streak_before, streak_after) on UserProfile for milestone detection.
    """
    user.profile.refresh_from_db(fields=["streak", "last_completed_date"])
    streak_before = int(user.profile.streak or 0)

    if mode == "profile":
        user.profile.update_streak()
    elif mode == "user_progress" and user_progress is not None:
        user_progress.update_streak()
    # mode == "none": no-op

    user.profile.refresh_from_db(fields=["streak", "last_completed_date"])
    streak_after = int(user.profile.streak or 0)
    return streak_before, streak_after


def grant_reward(
    user: User,
    event_key: str,
    *,
    points: int = 0,
    coins: Decimal | str | float | int | None = None,
    bump_streak: BumpStreakMode = "none",
    user_progress: UserProgress | None = None,
    evaluate_badges: bool = True,
) -> GrantResult:
    """
    Atomically record a ledger row and apply profile points/coins if new.
    """
    if coins is None:
        coins_dec = Decimal("0.00")
    else:
        coins_dec = _quantize_coins(Decimal(str(coins)))

    points = int(points or 0)
    if points < 0 or coins_dec < 0:
        raise ValueError("points and coins must be non-negative")

    if points == 0 and coins_dec == 0 and bump_streak == "none":
        return GrantResult(
            granted=False, duplicate=False, points=0, coins=Decimal("0.00")
        )

    streak_before, streak_after = 0, 0

    try:
        with transaction.atomic():
            from gamification.models import RewardLedgerEntry

            if bump_streak != "none":
                streak_before, streak_after = _apply_streak_bump(
                    user, bump_streak, user_progress
                )

            RewardLedgerEntry.objects.create(
                user=user,
                event_key=event_key[:220],
                points=points,
                coins=coins_dec,
            )
            profile = user.profile
            if points:
                profile.add_points(points)
            if coins_dec > 0:
                profile.add_money(coins_dec)

            logger.info(
                "reward_granted",
                extra={
                    "user_id": user.id,
                    "event_key": event_key[:220],
                    "points": points,
                    "coins": str(coins_dec),
                    "bump_streak": bump_streak,
                },
            )

        invalidate_profile_cache(user)

        if bump_streak != "none":
            _maybe_streak_milestones(user, streak_before, streak_after)

        if evaluate_badges:
            from gamification.utils import evaluate_badges_for_user

            evaluate_badges_for_user(user)

        return GrantResult(
            granted=True, duplicate=False, points=points, coins=coins_dec
        )
    except IntegrityError:
        # Duplicate event_key for this user — idempotent no-op.
        logger.info(
            "reward_duplicate_skipped",
            extra={"user_id": user.id, "event_key": event_key[:220]},
        )
        invalidate_profile_cache(user)
        return GrantResult(
            granted=False, duplicate=True, points=0, coins=Decimal("0.00")
        )

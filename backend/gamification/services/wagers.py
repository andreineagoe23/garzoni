"""
Streak Wagers — a commitment device where a user stakes non-redeemable XP
(UserProfile.points) betting they will keep their learning streak alive.

Design note (do not change to coins): coins (UserProfile.earned_money) are
redeemable for real shop goods and charity donations (finance.Reward /
finance.UserPurchase). Letting users stake real-value currency in a
finance-literacy app used by under-18s is a gambling/consumer-protection
problem. XP is a non-redeemable ranking currency, so it is the only thing
ever staked here. Winning EARNS coins as a payout; only the stake is XP.
"""

from __future__ import annotations

from datetime import timedelta
from decimal import Decimal
from typing import Optional

from django.contrib.auth.models import User
from django.db import IntegrityError, transaction
from django.utils import timezone

from authentication.models import UserProfile
from gamification.models import StreakWager
from gamification.services.rewards import grant_reward

# --- Stake/reward table (module constants; single source of truth) ---
#
# The stake for a given commitment length is fixed by this table (the user
# does not pick their own stake — that would open a path to picking a stake
# of 0 or gaming the payout). Longer commitments are harder to pull off, so
# they pay a richer multiple.
#
# reward_points = stake_points * REWARD_MULTIPLIER
# reward_coins  = stake_points * COINS_PER_STAKE_POINT
#
# e.g. a 7-day wager stakes 40 XP; winning returns 60 XP (1.5x) + 2.00 coins.
STAKE_POINTS_BY_TARGET_DAYS: dict[int, int] = {
    3: 20,
    7: 40,
    14: 80,
    30: 150,
}
DEFAULT_TARGET_DAYS = 7

REWARD_MULTIPLIER = Decimal("1.5")  # win payout in XP = stake * 1.5
COINS_PER_STAKE_POINT = Decimal("0.05")  # win payout in coins = stake * 0.05

# --- Anti-abuse caps ---
#
# 1) Stake-vs-balance cap: never let a single wager stake more than this
#    fraction of the user's *current* XP, so one lost bet cannot zero out
#    (or badly damage) a user's leaderboard rank. For low-balance users this
#    shrinks the effective stake below the table value above.
MAX_STAKE_FRACTION_OF_POINTS = Decimal("0.25")
# 2) Floor below which a (possibly fraction-capped) stake is not worth
#    opening as a wager — also acts as the minimum XP balance required.
MIN_STAKE_POINTS = 10
# 3) Rolling-period cap: at most this many wagers (any status) may be opened
#    per user within ROLLING_PERIOD_DAYS, to prevent a rapid open/win-small
#    or open/cancel farming loop.
MAX_WAGERS_PER_ROLLING_PERIOD = 3
ROLLING_PERIOD_DAYS = 30


class WagerError(Exception):
    """Raised for expected open/cancel rejections (not a bug — a business rule)."""

    code = "wager_error"

    def __init__(self, message: str, code: Optional[str] = None):
        super().__init__(message)
        if code:
            self.code = code


def _quantize_coins(value: Decimal) -> Decimal:
    return value.quantize(Decimal("0.01"))


def compute_stake(points: int, target_days: int) -> int:
    """Table stake for `target_days`, capped to a fraction of `points`."""
    table_stake = STAKE_POINTS_BY_TARGET_DAYS.get(target_days)
    if table_stake is None:
        raise WagerError(f"Unsupported target_days: {target_days}", code="invalid_target_days")
    cap = int((Decimal(int(points or 0)) * MAX_STAKE_FRACTION_OF_POINTS).to_integral_value())
    return max(0, min(table_stake, cap))


def compute_payout(stake_points: int) -> tuple[int, Decimal]:
    reward_points = int((Decimal(stake_points) * REWARD_MULTIPLIER).to_integral_value())
    reward_coins = _quantize_coins(Decimal(stake_points) * COINS_PER_STAKE_POINT)
    return reward_points, reward_coins


def stake_reward_table() -> list[dict]:
    """Public table for the API — one row per supported target_days."""
    rows = []
    for target_days, stake in sorted(STAKE_POINTS_BY_TARGET_DAYS.items()):
        reward_points, reward_coins = compute_payout(stake)
        rows.append(
            {
                "target_days": target_days,
                "stake_points": stake,
                "reward_points": reward_points,
                "reward_coins": str(reward_coins),
            }
        )
    return rows


def open_wager(user: User, target_days: int = DEFAULT_TARGET_DAYS) -> StreakWager:
    """
    Open a streak wager. Debits the stake via UserProfile.spend_points (an
    F-expression UPDATE, not read-then-write) inside the same transaction
    that creates the row, so a crash between debit and create can't happen.

    The ledger stays grants-only (RewardLedgerEntry never holds a negative
    row); the debit is instead surfaced to the activity feed as a zero-value
    grant with a `streak_wager_open:` event_key (see ledger_labels.py).
    """
    today = timezone.localdate()
    window_start = today - timedelta(days=ROLLING_PERIOD_DAYS)

    with transaction.atomic():
        profile = UserProfile.objects.select_for_update().get(user=user)

        if StreakWager.objects.filter(user=user, status=StreakWager.STATUS_ACTIVE).exists():
            raise WagerError("You already have an active streak wager.", code="active_exists")

        if int(profile.streak or 0) < 1:
            raise WagerError(
                "You need an active learning streak to open a wager.", code="streak_too_low"
            )

        recent_count = StreakWager.objects.filter(user=user, started_on__gte=window_start).count()
        if recent_count >= MAX_WAGERS_PER_ROLLING_PERIOD:
            raise WagerError(
                "You've reached the limit of streak wagers for this period.",
                code="rolling_cap_reached",
            )

        stake = compute_stake(profile.points, target_days)
        if stake < MIN_STAKE_POINTS or not profile.spend_points(stake):
            raise WagerError("Not enough XP to open this wager.", code="insufficient_points")

        reward_points, reward_coins = compute_payout(stake)

        try:
            with transaction.atomic():
                wager = StreakWager.objects.create(
                    user=user,
                    stake_points=stake,
                    reward_points=reward_points,
                    reward_coins=reward_coins,
                    target_days=target_days,
                    streak_at_start=int(profile.streak or 0),
                    started_on=today,
                    deadline_on=today + timedelta(days=target_days),
                    status=StreakWager.STATUS_ACTIVE,
                )
        except IntegrityError:
            # Race backstop for the partial-unique constraint; the
            # select_for_update above should already prevent this.
            raise WagerError("You already have an active streak wager.", code="active_exists")

    grant_reward(
        user,
        f"streak_wager_open:{wager.id}:{stake}",
        points=0,
        coins=Decimal("0"),
        bump_streak="none",
        evaluate_badges=False,
        record_zero_ledger=True,
    )
    return wager


def cancel_wager(user: User, wager_id: int) -> StreakWager:
    """Same-day-only cancellation with a full stake refund via add_points
    (a plain reversal of the earlier debit, not a new reward — no ledger row)."""
    with transaction.atomic():
        try:
            wager = StreakWager.objects.select_for_update().get(id=wager_id, user=user)
        except StreakWager.DoesNotExist:
            raise WagerError("Wager not found.", code="not_found")

        if wager.status != StreakWager.STATUS_ACTIVE:
            raise WagerError("This wager is no longer active.", code="not_active")

        if wager.started_on != timezone.localdate():
            raise WagerError(
                "Streak wagers can only be cancelled on the day they were opened.",
                code="cancel_window_closed",
            )

        profile = UserProfile.objects.select_for_update().get(user=user)
        profile.add_points(wager.stake_points)

        wager.status = StreakWager.STATUS_CANCELLED
        wager.resolved_at = timezone.now()
        wager.save(update_fields=["status", "resolved_at"])

    return wager


def _resolve_one(wager_id: int, now) -> Optional[str]:
    """
    Resolve a single wager. Re-checks status under a row lock so calling this
    (or resolve_wagers) twice is a no-op the second time, and pays out inside
    the SAME transaction that flips status to won/lost — so a crash can't
    leave a wager marked "won" without its payout, or vice versa.
    """
    with transaction.atomic():
        wager = (
            StreakWager.objects.select_for_update()
            .filter(id=wager_id, status=StreakWager.STATUS_ACTIVE)
            .first()
        )
        if wager is None:
            return None  # already resolved by a prior/concurrent run

        profile = UserProfile.objects.get(user_id=wager.user_id)

        # "Streak grew by >= target_days since streak_at_start" is reset-proof
        # by construction: update_streak() can only ever add +1/day to the
        # streak counter (a gap resets it to 1 instead), so over the
        # `target_days` calendar days between started_on and deadline_on the
        # counter can increase by AT MOST target_days — and only reaches that
        # ceiling if it was never broken. Any reset strictly reduces the
        # observed growth below target_days, so it can never look like a win
        # by coincidence. A streak freeze bridges the gap without resetting:
        # it advances last_completed_date to yesterday, so the very next
        # update_streak() sees diff == 1 and still increments. The frozen day
        # therefore costs no growth and the wager survives — that is intended:
        # "a freeze legitimately saves a wager".
        growth = int(profile.streak or 0) - wager.streak_at_start
        won = growth >= wager.target_days

        if won:
            grant_reward(
                wager.user,
                f"streak_wager_win:{wager.id}",
                points=wager.reward_points,
                coins=wager.reward_coins,
                bump_streak="none",
                evaluate_badges=True,
            )

        wager.status = StreakWager.STATUS_WON if won else StreakWager.STATUS_LOST
        wager.resolved_at = now
        wager.save(update_fields=["status", "resolved_at"])

    return wager.status


def resolve_wagers(now=None) -> dict:
    """Resolve every active wager whose deadline has passed. Safe to call twice."""
    now = now or timezone.now()
    today = now.date()

    ids = list(
        StreakWager.objects.filter(
            status=StreakWager.STATUS_ACTIVE, deadline_on__lte=today
        ).values_list("id", flat=True)
    )

    won = lost = skipped = 0
    for wager_id in ids:
        outcome = _resolve_one(wager_id, now)
        if outcome == StreakWager.STATUS_WON:
            won += 1
        elif outcome == StreakWager.STATUS_LOST:
            lost += 1
        else:
            skipped += 1

    return {"considered": len(ids), "won": won, "lost": lost, "skipped": skipped}

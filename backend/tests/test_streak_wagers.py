from datetime import timedelta
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone

from authentication.models import UserProfile
from gamification.models import RewardLedgerEntry, StreakItem, StreakWager
from gamification.services.wagers import (
    MAX_WAGERS_PER_ROLLING_PERIOD,
    STAKE_POINTS_BY_TARGET_DAYS,
    WagerError,
    cancel_wager,
    open_wager,
    resolve_wagers,
)

User = get_user_model()


def _make_user(username, points=1000, streak=3):
    user = User.objects.create_user(username=username, password="x")
    profile = UserProfile.objects.get(user=user)
    profile.points = points
    profile.streak = streak
    profile.last_completed_date = timezone.localdate()
    profile.save(update_fields=["points", "streak", "last_completed_date"])
    return user


def _assert_no_negative_ledger_rows():
    negatives = RewardLedgerEntry.objects.filter(points__lt=0) | RewardLedgerEntry.objects.filter(
        coins__lt=0
    )
    assert not negatives.exists(), f"found negative ledger rows: {list(negatives)}"


class StreakWagerOpenTests(TestCase):
    def test_open_wager_debits_points(self):
        user = _make_user("u1", points=1000, streak=5)
        wager = open_wager(user, target_days=7)

        profile = UserProfile.objects.get(user=user)
        expected_stake = STAKE_POINTS_BY_TARGET_DAYS[7]
        self.assertEqual(wager.stake_points, expected_stake)
        self.assertEqual(profile.points, 1000 - expected_stake)
        self.assertEqual(wager.status, StreakWager.STATUS_ACTIVE)
        self.assertEqual(wager.streak_at_start, 5)
        _assert_no_negative_ledger_rows()

    def test_open_wager_insufficient_points_rejected(self):
        user = _make_user("u2", points=5, streak=3)
        with self.assertRaises(WagerError):
            open_wager(user, target_days=7)

        profile = UserProfile.objects.get(user=user)
        self.assertEqual(profile.points, 5)
        self.assertEqual(StreakWager.objects.filter(user=user).count(), 0)
        _assert_no_negative_ledger_rows()

    def test_open_wager_requires_active_streak(self):
        user = _make_user("u3", points=1000, streak=0)
        with self.assertRaises(WagerError):
            open_wager(user, target_days=7)
        _assert_no_negative_ledger_rows()

    def test_only_one_active_wager_per_user(self):
        user = _make_user("u4", points=1000, streak=5)
        open_wager(user, target_days=7)

        with self.assertRaises(WagerError):
            open_wager(user, target_days=3)

        self.assertEqual(
            StreakWager.objects.filter(user=user, status=StreakWager.STATUS_ACTIVE).count(), 1
        )

    def test_rolling_period_cap(self):
        user = _make_user("u5", points=100000, streak=5)
        for _ in range(MAX_WAGERS_PER_ROLLING_PERIOD):
            wager = open_wager(user, target_days=3)
            cancel_wager(user, wager.id)  # free the "only one active" slot each time

        with self.assertRaises(WagerError) as ctx:
            open_wager(user, target_days=3)
        self.assertEqual(ctx.exception.code, "rolling_cap_reached")

    def test_stake_debit_ledger_has_no_negative_rows(self):
        user = _make_user("u6", points=1000, streak=5)
        open_wager(user, target_days=7)
        _assert_no_negative_ledger_rows()
        # The debit is surfaced as a zero-value grant, not a negative row.
        self.assertTrue(
            RewardLedgerEntry.objects.filter(
                user=user, event_key__startswith="streak_wager_open:"
            ).exists()
        )
        zero_row = RewardLedgerEntry.objects.get(
            user=user, event_key__startswith="streak_wager_open:"
        )
        self.assertEqual(zero_row.points, 0)
        self.assertEqual(zero_row.coins, Decimal("0.00"))


class StreakWagerCancelTests(TestCase):
    def test_same_day_cancel_refunds_in_full(self):
        user = _make_user("u7", points=1000, streak=5)
        wager = open_wager(user, target_days=7)
        stake = wager.stake_points

        cancelled = cancel_wager(user, wager.id)

        profile = UserProfile.objects.get(user=user)
        self.assertEqual(cancelled.status, StreakWager.STATUS_CANCELLED)
        self.assertEqual(profile.points, 1000)  # fully refunded
        _assert_no_negative_ledger_rows()
        _ = stake

    def test_next_day_cancel_rejected(self):
        user = _make_user("u8", points=1000, streak=5)
        wager = open_wager(user, target_days=7)
        wager.started_on = timezone.localdate() - timedelta(days=1)
        wager.save(update_fields=["started_on"])

        with self.assertRaises(WagerError) as ctx:
            cancel_wager(user, wager.id)
        self.assertEqual(ctx.exception.code, "cancel_window_closed")

        profile = UserProfile.objects.get(user=user)
        self.assertLess(profile.points, 1000)  # stake stays forfeited (not refunded)
        _assert_no_negative_ledger_rows()


class StreakWagerResolveTests(TestCase):
    def test_win_pays_out_exactly_once_when_resolved_twice(self):
        user = _make_user("u9", points=1000, streak=5)
        wager = open_wager(user, target_days=7)

        # Simulate the streak growing by exactly target_days by the deadline.
        profile = UserProfile.objects.get(user=user)
        profile.streak = wager.streak_at_start + wager.target_days
        profile.save(update_fields=["streak"])

        wager.deadline_on = timezone.localdate() - timedelta(days=1)
        wager.save(update_fields=["deadline_on"])

        result1 = resolve_wagers()
        self.assertEqual(result1["won"], 1)

        wager.refresh_from_db()
        self.assertEqual(wager.status, StreakWager.STATUS_WON)
        points_after_first = UserProfile.objects.get(user=user).points

        # Second call must be a no-op: wager is no longer active.
        result2 = resolve_wagers()
        self.assertEqual(result2["considered"], 0)

        points_after_second = UserProfile.objects.get(user=user).points
        self.assertEqual(points_after_first, points_after_second)

        win_rows = RewardLedgerEntry.objects.filter(
            user=user, event_key=f"streak_wager_win:{wager.id}"
        )
        self.assertEqual(win_rows.count(), 1)
        self.assertEqual(win_rows.first().points, wager.reward_points)
        _assert_no_negative_ledger_rows()

    def test_resolve_wagers_called_twice_directly_still_pays_once(self):
        """Even if resolve_wagers() itself is invoked twice back-to-back (e.g. a
        retried cron tick) with no test-only shortcuts, the payout must not double."""
        user = _make_user("u10", points=1000, streak=5)
        wager = open_wager(user, target_days=3)

        profile = UserProfile.objects.get(user=user)
        profile.streak = wager.streak_at_start + wager.target_days
        profile.save(update_fields=["streak"])

        wager.deadline_on = timezone.localdate()
        wager.save(update_fields=["deadline_on"])

        resolve_wagers()
        resolve_wagers()

        win_rows = RewardLedgerEntry.objects.filter(
            user=user, event_key=f"streak_wager_win:{wager.id}"
        )
        self.assertEqual(win_rows.count(), 1)
        _assert_no_negative_ledger_rows()

    def test_freeze_bridged_gap_still_wins(self):
        # update_streak() only reacts to the *stored* last_completed_date
        # relative to today (it no-ops if called twice with the same stored
        # date), so each simulated "day" below rewinds last_completed_date by
        # hand before calling update_streak() again — that's how a single
        # wall-clock test second can stand in for three separate calendar days.
        user = _make_user("u11", points=1000, streak=1)
        StreakItem.objects.create(user=user, item_type="streak_freeze", quantity=1)

        wager = open_wager(user, target_days=3)
        profile = UserProfile.objects.get(user=user)
        today = timezone.localdate()

        # Day 1 (started_on): user studies normally -> streak 1 -> 2.
        profile.last_completed_date = today - timedelta(days=1)
        profile.streak = wager.streak_at_start
        profile.save(update_fields=["last_completed_date", "streak"])
        profile.update_streak()
        profile.refresh_from_db()
        self.assertEqual(profile.streak, wager.streak_at_start + 1)

        # Day 2: user misses the day entirely (a 2-day gap opens up from
        # today's perspective), but a streak freeze bridges it instead of
        # resetting to 1. The bridge advances last_completed_date to
        # yesterday, so update_streak() then sees diff == 1 and increments:
        # a frozen day still counts as growth, which is what lets a freeze
        # rescue a wager rather than quietly forfeiting it.
        profile.last_completed_date = today - timedelta(days=2)
        profile.save(update_fields=["last_completed_date"])
        profile.update_streak()
        profile.refresh_from_db()
        self.assertEqual(profile.streak, wager.streak_at_start + 2)
        self.assertEqual(StreakItem.objects.get(user=user, item_type="streak_freeze").quantity, 0)

        # Day 3 (deadline): studies again on the next simulated day -> +1 more.
        profile.last_completed_date = today - timedelta(days=1)
        profile.save(update_fields=["last_completed_date"])
        profile.update_streak()
        profile.refresh_from_db()
        self.assertEqual(profile.streak - wager.streak_at_start, wager.target_days)

        wager.deadline_on = timezone.localdate()
        wager.save(update_fields=["deadline_on"])

        result = resolve_wagers()
        self.assertEqual(result["won"], 1)
        wager.refresh_from_db()
        self.assertEqual(wager.status, StreakWager.STATUS_WON)
        _assert_no_negative_ledger_rows()

    def test_broken_streak_is_lost_with_no_payout(self):
        user = _make_user("u12", points=1000, streak=5)
        wager = open_wager(user, target_days=7)

        # Streak resets to 1 mid-wager (a gap with no freeze available) and only
        # grows a little afterward — nowhere near streak_at_start + target_days.
        profile = UserProfile.objects.get(user=user)
        profile.streak = 3
        profile.save(update_fields=["streak"])

        wager.deadline_on = timezone.localdate() - timedelta(days=1)
        wager.save(update_fields=["deadline_on"])

        points_before = UserProfile.objects.get(user=user).points
        result = resolve_wagers()

        self.assertEqual(result["lost"], 1)
        wager.refresh_from_db()
        self.assertEqual(wager.status, StreakWager.STATUS_LOST)

        points_after = UserProfile.objects.get(user=user).points
        self.assertEqual(points_before, points_after)  # no payout
        self.assertFalse(
            RewardLedgerEntry.objects.filter(
                user=user, event_key=f"streak_wager_win:{wager.id}"
            ).exists()
        )
        _assert_no_negative_ledger_rows()

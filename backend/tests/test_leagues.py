from datetime import timedelta

from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.db import IntegrityError, transaction
from django.db.models import Sum
from django.test import TestCase, override_settings
from django.utils import timezone

from authentication.models import UserProfile
from gamification.models import League, LeagueMember, RewardLedgerEntry
from gamification.services.leagues import (
    LEAGUE_FINISH_REWARDS,
    assign_to_league,
    close_week,
    current_standings,
    league_history,
)
from gamification.services.mission_cycles import weekly_cycle_id
from gamification.services.rewards import grant_reward

User = get_user_model()


def _make_user(username, points=0):
    user = User.objects.create_user(username=username, password="x")
    if points:
        profile = UserProfile.objects.get(user=user)
        profile.points = points
        profile.save(update_fields=["points"])
    return user


def _create_league(tier="bronze", cycle_id=None, index=0):
    cycle_id = cycle_id or weekly_cycle_id()
    return League.objects.create(tier=tier, cycle_id=cycle_id, index=index)


def _add_member(league, user, weekly_xp=0):
    return LeagueMember.objects.create(
        league=league, user=user, cycle_id=league.cycle_id, weekly_xp=weekly_xp
    )


@override_settings(LEAGUES_ENABLED=True)
class LeagueLazyAssignmentTests(TestCase):
    def setUp(self):
        cache.clear()

    def test_lazy_assignment_happens_on_first_grant_and_not_before(self):
        user = _make_user("lazy1")
        # No XP granted yet -> no membership at all.
        self.assertFalse(LeagueMember.objects.filter(user=user).exists())

        grant_reward(user, "lazy_grant:1", points=10, bump_streak="none", evaluate_badges=False)

        membership = LeagueMember.objects.get(user=user)
        self.assertEqual(membership.weekly_xp, 10)
        self.assertEqual(membership.league.tier, League.TIER_BRONZE)
        self.assertEqual(membership.cycle_id, weekly_cycle_id())

    def test_record_league_xp_total_matches_ledger_sum_for_the_week(self):
        user = _make_user("sum1")
        grant_reward(user, "e1", points=5, bump_streak="none", evaluate_badges=False)
        grant_reward(user, "e2", points=7, bump_streak="none", evaluate_badges=False)
        grant_reward(user, "e3", points=3, bump_streak="none", evaluate_badges=False)

        ledger_total = RewardLedgerEntry.objects.filter(user=user).aggregate(s=Sum("points"))["s"]
        membership = LeagueMember.objects.get(user=user)

        self.assertEqual(ledger_total, 15)
        self.assertEqual(membership.weekly_xp, ledger_total)

    def test_duplicate_grant_reward_does_not_double_count_league_xp(self):
        user = _make_user("dup1")
        grant_reward(user, "dup_event", points=10, bump_streak="none", evaluate_badges=False)
        result2 = grant_reward(
            user, "dup_event", points=10, bump_streak="none", evaluate_badges=False
        )

        self.assertTrue(result2.duplicate)
        membership = LeagueMember.objects.get(user=user)
        self.assertEqual(membership.weekly_xp, 10)
        self.assertEqual(
            RewardLedgerEntry.objects.filter(user=user, event_key="dup_event").count(), 1
        )

    def test_one_league_per_user_per_cycle_enforced_at_db_level(self):
        user = _make_user("dbcheck1")
        cycle_id = weekly_cycle_id()
        league_a = _create_league("bronze", cycle_id, index=0)
        league_b = _create_league("silver", cycle_id, index=0)
        LeagueMember.objects.create(league=league_a, user=user, cycle_id=cycle_id)

        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                LeagueMember.objects.create(league=league_b, user=user, cycle_id=cycle_id)

    def test_returning_user_resumes_in_tier_left_by_last_resolved_membership(self):
        user = _make_user("returning1")
        prev_cycle_id = weekly_cycle_id(timezone.localdate() - timedelta(days=7))
        prev_league = _create_league("bronze", prev_cycle_id)
        member = _add_member(prev_league, user, weekly_xp=100)
        member.final_rank = 1
        member.outcome = LeagueMember.OUTCOME_PROMOTED
        member.save(update_fields=["final_rank", "outcome"])

        membership = assign_to_league(user)

        self.assertEqual(membership.league.tier, League.TIER_SILVER)


@override_settings(LEAGUES_ENABLED=True)
class LeagueCloseWeekTests(TestCase):
    def setUp(self):
        cache.clear()

    def test_close_week_promotes_top5_and_demotes_bottom5_with_full_cohort(self):
        cycle_id = weekly_cycle_id()
        league = _create_league("silver", cycle_id)
        users = [_make_user(f"full{i}") for i in range(12)]
        for i, user in enumerate(users):
            _add_member(league, user, weekly_xp=(12 - i) * 10)  # distinct, descending

        result = close_week(cycle_id)
        self.assertEqual(result["leagues_closed"], 1)
        self.assertEqual(result["members_processed"], 12)

        members = list(LeagueMember.objects.filter(league=league).order_by("final_rank"))
        outcomes = [m.outcome for m in members]
        self.assertEqual(outcomes[:5], [LeagueMember.OUTCOME_PROMOTED] * 5)
        self.assertEqual(outcomes[5:7], [LeagueMember.OUTCOME_HELD] * 2)
        self.assertEqual(outcomes[7:], [LeagueMember.OUTCOME_DEMOTED] * 5)
        self.assertEqual([m.final_rank for m in members], list(range(1, 13)))

        for m in members:
            reward_points, _reward_coins = LEAGUE_FINISH_REWARDS[m.outcome]
            ledger_rows = RewardLedgerEntry.objects.filter(
                user=m.user, event_key=f"league_finish:{league.id}:{m.user_id}"
            )
            self.assertEqual(ledger_rows.count(), 1)
            self.assertEqual(ledger_rows.first().points, reward_points)

    def test_close_week_is_idempotent(self):
        cycle_id = weekly_cycle_id()
        league = _create_league("gold", cycle_id)
        users = [_make_user(f"idem{i}") for i in range(10)]
        for i, user in enumerate(users):
            _add_member(league, user, weekly_xp=(10 - i) * 5)

        close_week(cycle_id)
        points_after_first = {u.id: UserProfile.objects.get(user=u).points for u in users}

        close_week(cycle_id)  # rerun must not pay out twice
        points_after_second = {u.id: UserProfile.objects.get(user=u).points for u in users}

        self.assertEqual(points_after_first, points_after_second)
        for u in users:
            count = RewardLedgerEntry.objects.filter(
                user=u, event_key__startswith=f"league_finish:{league.id}:"
            ).count()
            self.assertEqual(count, 1)

    def test_cohort_under_ten_members_everyone_held(self):
        cycle_id = weekly_cycle_id()
        league = _create_league("diamond", cycle_id)
        users = [_make_user(f"small{i}") for i in range(6)]
        for i, user in enumerate(users):
            _add_member(league, user, weekly_xp=(6 - i) * 10)

        close_week(cycle_id)

        members = LeagueMember.objects.filter(league=league)
        self.assertEqual(members.count(), 6)
        for m in members:
            self.assertEqual(m.outcome, LeagueMember.OUTCOME_HELD)
            self.assertIsNotNone(m.final_rank)


class LeagueDisabledTests(TestCase):
    """LEAGUES_ENABLED defaults to False; every entry point must be inert."""

    def setUp(self):
        cache.clear()

    @override_settings(LEAGUES_ENABLED=False)
    def test_grant_reward_creates_no_league_membership_when_disabled(self):
        user = _make_user("disabled1")
        grant_reward(user, "disabled_event", points=10, bump_streak="none", evaluate_badges=False)
        self.assertFalse(LeagueMember.objects.filter(user=user).exists())

    @override_settings(LEAGUES_ENABLED=False)
    def test_assign_to_league_returns_none_when_disabled(self):
        user = _make_user("disabled2")
        self.assertIsNone(assign_to_league(user))

    @override_settings(LEAGUES_ENABLED=False)
    def test_close_week_is_a_noop_when_disabled(self):
        cycle_id = weekly_cycle_id()
        league = League.objects.create(tier="bronze", cycle_id=cycle_id, index=0)
        user = _make_user("disabled3")
        LeagueMember.objects.create(league=league, user=user, cycle_id=cycle_id, weekly_xp=5)

        result = close_week(cycle_id)
        self.assertFalse(result["enabled"])

        member = LeagueMember.objects.get(league=league, user=user)
        self.assertIsNone(member.final_rank)
        self.assertIsNone(member.outcome)

    @override_settings(LEAGUES_ENABLED=False)
    def test_current_standings_and_history_report_disabled(self):
        user = _make_user("disabled4")
        standings = current_standings(user)
        self.assertFalse(standings.enabled)
        self.assertEqual(league_history(user), [])


@override_settings(LEAGUES_ENABLED=True)
class LeagueColdStartMergeTests(TestCase):
    """The cold-start guard: with low DAU a tier can be too thin to be a real
    league, so new assignments merge into an adjacent tier instead of shipping
    a 3-person 'cohort'. Zero history must NOT trigger a merge — "no evidence"
    and "evidence of a too-small tier" are different things."""

    def setUp(self):
        cache.clear()
        self.cycle_id = weekly_cycle_id()
        self.prev_cycle_id = weekly_cycle_id(timezone.localdate() - timedelta(days=7))

    def _seed_prev_cycle(self, tier, member_count):
        league = _create_league(tier=tier, cycle_id=self.prev_cycle_id)
        for i in range(member_count):
            _add_member(league, _make_user(f"prev-{tier}-{i}"))
        return league

    def test_thin_previous_tier_merges_new_assignment_upward(self):
        # Bronze had only 3 players last week -> below LEAGUE_MIN_COHORT_SIZE (5).
        # Bronze has nothing below it, so new bronze assignments merge to silver.
        self._seed_prev_cycle("bronze", 3)

        member = assign_to_league(_make_user("newcomer"))

        self.assertIsNotNone(member)
        self.assertEqual(member.league.tier, "silver")
        self.assertEqual(member.league.cycle_id, self.cycle_id)

    def test_healthy_previous_tier_does_not_merge(self):
        self._seed_prev_cycle("bronze", 5)  # exactly at the threshold

        member = assign_to_league(_make_user("newcomer"))

        self.assertIsNotNone(member)
        self.assertEqual(member.league.tier, "bronze")

    def test_no_history_does_not_merge(self):
        # Fresh database: the tier didn't exist last cycle at all. Zero rows is
        # "no evidence", not "too small" — merging here would push every single
        # user off bronze on day one.
        self.assertFalse(League.objects.filter(cycle_id=self.prev_cycle_id).exists())

        member = assign_to_league(_make_user("first-ever"))

        self.assertIsNotNone(member)
        self.assertEqual(member.league.tier, "bronze")

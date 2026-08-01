from datetime import timedelta

from django.contrib.auth import get_user_model
from django.core.cache import cache
from rest_framework.test import APITestCase

from authentication.models import UserProfile
from gamification.models import RewardLedgerEntry
from gamification.services.leaderboards import (
    rank_in_window,
    weekly_xp_leaderboard,
    window_start,
    xp_in_window,
)

User = get_user_model()


def _ledger_entry(user, event_key, points, created_at):
    """Create a RewardLedgerEntry with an explicit created_at.

    created_at uses auto_now_add=True, so the timestamp has to be forced
    with a follow-up .update() after the row exists.
    """
    entry = RewardLedgerEntry.objects.create(user=user, event_key=event_key, points=points)
    RewardLedgerEntry.objects.filter(pk=entry.pk).update(created_at=created_at)
    return entry


class WeeklyXpLeaderboardTests(APITestCase):
    """
    Regression coverage for Phase 0: the old leaderboard filtered
    UserProfile by "was active recently" (last_completed_date) and then
    ordered by LIFETIME points, so "this week" was never actually windowed
    XP. These tests pin down that week/month are now real windows over
    RewardLedgerEntry, independent of lifetime UserProfile.points.
    """

    def setUp(self):
        # The service caches the top-N list and (in the view) per-user rank
        # for 60s; without this, results from one test can leak into the
        # next since tests share the same cache backend.
        cache.clear()

        self.user_a = User.objects.create_user(username="wk-a", password="x")
        self.user_b = User.objects.create_user(username="wk-b", password="x")
        self.user_c = User.objects.create_user(username="wk-c", password="x")

        # Lifetime points (drives all-time ordering only): A > B > C.
        UserProfile.objects.filter(user=self.user_a).update(points=100)
        UserProfile.objects.filter(user=self.user_b).update(points=20)
        UserProfile.objects.filter(user=self.user_c).update(points=5)

        this_week = window_start("week") + timedelta(hours=2)
        last_week = window_start("week") - timedelta(hours=2)

        # This week: B earns far more XP than A -- weekly leader flips
        # relative to the lifetime leaderboard.
        _ledger_entry(self.user_a, "wk:a:this-week", 10, this_week)
        _ledger_entry(self.user_b, "wk:b:this-week", 50, this_week)

        # C only earned XP last week; none of it should count this week.
        _ledger_entry(self.user_c, "wk:c:last-week", 30, last_week)

    def test_last_weeks_xp_does_not_count_toward_this_week(self):
        self.assertEqual(xp_in_window(self.user_c, "week"), 0)

        rows = weekly_xp_leaderboard("week", limit=10)
        user_ids = [row.user_id for row in rows]
        self.assertNotIn(self.user_c.id, user_ids)

    def test_zero_xp_users_are_excluded_from_the_window(self):
        rows = weekly_xp_leaderboard("week", limit=10)
        for row in rows:
            self.assertGreater(row.xp, 0)

    def test_week_ordering_differs_from_all_time_ordering(self):
        # All-time (lifetime points): A(100) > B(20) > C(5).
        all_time_order = list(
            UserProfile.objects.select_related("user")
            .order_by("-points")
            .values_list("user_id", flat=True)
        )
        self.assertEqual(all_time_order[:3], [self.user_a.id, self.user_b.id, self.user_c.id])

        # This week: B(50) > A(10); C has none. The regression being fixed
        # is that the old code would have reported A first (it orders by
        # lifetime points), even though B earned more XP this week.
        week_rows = weekly_xp_leaderboard("week", limit=10)
        week_order = [row.user_id for row in week_rows]
        self.assertEqual(week_order, [self.user_b.id, self.user_a.id])
        self.assertNotEqual(week_order, all_time_order[: len(week_order)])

    def test_rank_in_window_agrees_with_list_position(self):
        rows = weekly_xp_leaderboard("week", limit=10)
        for position, row in enumerate(rows, start=1):
            self.assertEqual(rank_in_window(row.profile.user, "week"), position)

        # A user with zero XP this week ranks after every earner.
        self.assertEqual(rank_in_window(self.user_c, "week"), len(rows) + 1)

    def test_weekly_xp_leaderboard_hydrates_profile_and_user(self):
        rows = weekly_xp_leaderboard("week", limit=10)
        top = rows[0]
        self.assertEqual(top.user_id, self.user_b.id)
        self.assertEqual(top.xp, 50)
        self.assertIsNotNone(top.profile)
        self.assertEqual(top.profile.user_id, self.user_b.id)

    def test_month_window_includes_last_week_but_not_older(self):
        older = window_start("month") - timedelta(days=1)
        _ledger_entry(self.user_c, "wk:c:too-old-for-month", 999, older)

        # Last week's entry (30 in the window) counts for "month"...
        self.assertEqual(xp_in_window(self.user_c, "month"), 30)
        # ...but anything before the 30-day cutoff does not.
        month_ids = [row.user_id for row in weekly_xp_leaderboard("month", limit=10)]
        self.assertIn(self.user_c.id, month_ids)


class LeaderboardViewIntegrationTests(APITestCase):
    """
    End-to-end checks that the rewired views keep the LeaderboardSerializer
    response shape (same keys) while adding xp_window, and that all-time
    behaviour is unchanged.
    """

    def setUp(self):
        cache.clear()

        self.user_a = User.objects.create_user(username="view-a", password="x")
        self.user_b = User.objects.create_user(username="view-b", password="x")

        # Mutate the already-cached `.profile` instances in place (rather
        # than a bulk .filter().update()) so force_authenticate() -- which
        # reuses these exact User objects as request.user -- sees the new
        # points through request.user.profile instead of a stale cached row.
        self.user_a.profile.points = 100
        self.user_a.profile.save()
        self.user_b.profile.points = 20
        self.user_b.profile.save()

        this_week = window_start("week") + timedelta(hours=2)
        _ledger_entry(self.user_a, "view:a:this-week", 5, this_week)
        _ledger_entry(self.user_b, "view:b:this-week", 40, this_week)

        self.client.force_authenticate(user=self.user_a)

    def test_all_time_leaderboard_unchanged_shape_and_order(self):
        response = self.client.get("/api/leaderboard/", {"time_filter": "all-time"})
        self.assertEqual(response.status_code, 200)
        rows = response.data
        self.assertEqual(rows[0]["user"]["id"], self.user_a.id)
        self.assertEqual(rows[0]["points"], 100)
        # all-time: xp_window mirrors lifetime points, per spec.
        self.assertEqual(rows[0]["xp_window"], 100)
        self.assertEqual(rows[1]["points"], 20)
        self.assertEqual(rows[1]["xp_window"], 20)

    def test_week_leaderboard_orders_by_windowed_xp_not_lifetime_points(self):
        response = self.client.get("/api/leaderboard/", {"time_filter": "week"})
        self.assertEqual(response.status_code, 200)
        rows = response.data
        # B has less lifetime points but more XP this week -> ranks first.
        self.assertEqual(rows[0]["user"]["id"], self.user_b.id)
        self.assertEqual(rows[0]["xp_window"], 40)
        # "points" key is preserved (backward compatible) as lifetime points.
        self.assertEqual(rows[0]["points"], 20)
        self.assertEqual(rows[1]["user"]["id"], self.user_a.id)
        self.assertEqual(rows[1]["xp_window"], 5)

    def test_user_rank_view_week_vs_all_time(self):
        all_time_resp = self.client.get("/api/leaderboard/rank/", {"time_filter": "all-time"})
        self.assertEqual(all_time_resp.status_code, 200)
        self.assertEqual(all_time_resp.data["rank"], 1)  # user_a has most lifetime points
        self.assertEqual(all_time_resp.data["xp_window"], 100)

        week_resp = self.client.get("/api/leaderboard/rank/", {"time_filter": "week"})
        self.assertEqual(week_resp.status_code, 200)
        self.assertEqual(week_resp.data["rank"], 2)  # user_a earned less XP than user_b this week
        self.assertEqual(week_resp.data["xp_window"], 5)

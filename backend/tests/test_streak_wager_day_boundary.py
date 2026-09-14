from datetime import date, datetime, timezone as dt_timezone

from django.test import TestCase, override_settings

from authentication.models import UserProfile
from gamification.models import StreakWager
from gamification.services.wagers import open_wager, resolve_wagers
from tests.test_streak_wagers import _make_user


@override_settings(TIME_ZONE="Europe/London")
class ResolveWagersDayBoundaryTests(TestCase):
    def test_the_nightly_tick_resolves_wagers_due_that_london_day(self):
        # Beat resolves wagers at 00:30 Europe/London. In BST that instant is 23:30 UTC on
        # the previous date.
        user = _make_user("boundary", points=1000, streak=5)
        wager = open_wager(user, target_days=3)
        UserProfile.objects.filter(user=user).update(
            streak=wager.streak_at_start + wager.target_days
        )
        StreakWager.objects.filter(id=wager.id).update(deadline_on=date(2026, 7, 15))

        result = resolve_wagers(now=datetime(2026, 7, 14, 23, 30, tzinfo=dt_timezone.utc))

        self.assertEqual(result["won"], 1)

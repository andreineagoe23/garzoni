"""
The streak is a claim about the user's day, not the server's.

Every case here pins a single real UTC instant on which the London date and the
user's local date genuinely disagree, so a regression back to `timezone.localdate()`
fails rather than passing by coincidence.
"""

from datetime import date, datetime, timedelta
from unittest import mock

from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings
from django.utils import timezone

from authentication.models import UserProfile
from education.models import Course, Path, UserProgress
from education.tasks import reset_inactive_streaks

User = get_user_model()

try:
    from zoneinfo import ZoneInfo

    UTC = ZoneInfo("UTC")
except ImportError:  # pragma: no cover - Python < 3.9 is not supported here
    UTC = timezone.utc

# 2026-08-23 12:00 UTC. London (BST, +1) reads 23 Aug; Kiritimati (+14) reads 24 Aug.
INSTANT_AHEAD = datetime(2026, 8, 23, 12, 0, tzinfo=UTC)
TZ_AHEAD = "Pacific/Kiritimati"
LONDON_DATE_AHEAD = date(2026, 8, 23)
LOCAL_DATE_AHEAD = date(2026, 8, 24)

# 2026-08-23 01:00 UTC. London reads 23 Aug; Midway (-11) is still on 22 Aug.
INSTANT_BEHIND = datetime(2026, 8, 23, 1, 0, tzinfo=UTC)
TZ_BEHIND = "Pacific/Midway"
LOCAL_DATE_BEHIND = date(2026, 8, 22)


def _profile(tz_name="", **fields):
    user = User.objects.create_user(username=f"u{User.objects.count()}", password="x")
    profile = UserProfile.objects.get(user=user)
    profile.timezone_name = tz_name
    for key, value in fields.items():
        setattr(profile, key, value)
    profile.save()
    return profile


@override_settings(TIME_ZONE="Europe/London", USE_TZ=True)
class LocalTodayTests(TestCase):
    def test_uses_the_profile_timezone_when_it_is_a_day_ahead(self):
        profile = _profile(TZ_AHEAD)
        with mock.patch.object(timezone, "now", return_value=INSTANT_AHEAD):
            self.assertEqual(profile.local_today(), LOCAL_DATE_AHEAD)
            self.assertNotEqual(profile.local_today(), LONDON_DATE_AHEAD)

    def test_uses_the_profile_timezone_when_it_is_a_day_behind(self):
        profile = _profile(TZ_BEHIND)
        with mock.patch.object(timezone, "now", return_value=INSTANT_BEHIND):
            self.assertEqual(profile.local_today(), LOCAL_DATE_BEHIND)

    def test_falls_back_to_server_time_when_no_timezone_reported(self):
        profile = _profile("")
        with mock.patch.object(timezone, "now", return_value=INSTANT_AHEAD):
            self.assertEqual(profile.local_today(), LONDON_DATE_AHEAD)

    def test_falls_back_to_server_time_on_an_unparseable_timezone(self):
        profile = _profile("Not/AZone")
        with mock.patch.object(timezone, "now", return_value=INSTANT_AHEAD):
            self.assertEqual(profile.local_today(), LONDON_DATE_AHEAD)


@override_settings(TIME_ZONE="Europe/London", USE_TZ=True)
class UpdateStreakTimezoneTests(TestCase):
    def test_increments_on_the_users_own_next_day(self):
        # Finished yesterday *in their timezone*; it is now their today.
        profile = _profile(
            TZ_AHEAD,
            streak=4,
            last_completed_date=LOCAL_DATE_AHEAD - timedelta(days=1),
        )
        with mock.patch.object(timezone, "now", return_value=INSTANT_AHEAD):
            profile.update_streak()
        profile.refresh_from_db()
        self.assertEqual(profile.streak, 5)
        self.assertEqual(profile.last_completed_date, LOCAL_DATE_AHEAD)

    def test_is_a_no_op_twice_in_the_same_local_day(self):
        profile = _profile(TZ_AHEAD, streak=4, last_completed_date=LOCAL_DATE_AHEAD)
        with mock.patch.object(timezone, "now", return_value=INSTANT_AHEAD):
            profile.update_streak()
        profile.refresh_from_db()
        self.assertEqual(profile.streak, 4)

    def test_does_not_double_count_a_user_whose_day_lags_the_server(self):
        # Server has ticked over to the 23rd; the user is still on the 22nd, which
        # they have already completed. Judging on server time would bump them twice.
        profile = _profile(TZ_BEHIND, streak=2, last_completed_date=LOCAL_DATE_BEHIND)
        with mock.patch.object(timezone, "now", return_value=INSTANT_BEHIND):
            profile.update_streak()
        profile.refresh_from_db()
        self.assertEqual(profile.streak, 2)


@override_settings(TIME_ZONE="Europe/London", USE_TZ=True)
class ResetInactiveStreaksTimezoneTests(TestCase):
    def setUp(self):
        path = Path.objects.create(title="Path", description="")
        self.course = Course.objects.create(title="Course", description="", path=path)

    def _with_progress(self, profile, last_activity):
        UserProgress.objects.create(
            user=profile.user,
            course=self.course,
            last_course_activity_date=last_activity,
        )
        return profile

    def test_keeps_a_streak_that_is_still_alive_in_the_users_timezone(self):
        # Their local yesterday. One day inactive, so the streak survives — but
        # the London date is two days after it, which used to clear it.
        profile = _profile(
            TZ_AHEAD, streak=6, last_completed_date=LOCAL_DATE_AHEAD - timedelta(days=1)
        )
        self._with_progress(profile, LOCAL_DATE_AHEAD - timedelta(days=1))
        with mock.patch.object(timezone, "now", return_value=INSTANT_AHEAD):
            reset_inactive_streaks()
        profile.refresh_from_db()
        self.assertEqual(profile.streak, 6)

    def test_still_clears_a_genuinely_lapsed_streak(self):
        profile = _profile(
            TZ_AHEAD, streak=6, last_completed_date=LOCAL_DATE_AHEAD - timedelta(days=5)
        )
        self._with_progress(profile, LOCAL_DATE_AHEAD - timedelta(days=5))
        with mock.patch.object(timezone, "now", return_value=INSTANT_AHEAD):
            reset_inactive_streaks()
        profile.refresh_from_db()
        self.assertEqual(profile.streak, 0)
        self.assertIsNone(profile.last_completed_date)

"""Tests for education.tasks.reset_inactive_streaks (annotate + inactivity threshold)."""

from datetime import timedelta
from unittest.mock import patch

from django.contrib.auth.models import User
from django.test import TestCase
from django.utils import timezone

from authentication.models import UserProfile
from education.models import Course, Path, UserProgress
from education.tasks import reset_inactive_streaks


class ResetInactiveStreaksTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="streakuser", password="test-pass-123!"
        )
        self.path = Path.objects.create(title="P", description="")
        self.course = Course.objects.create(title="C", description="", path=self.path)

    def test_annotate_resolves_user_progress_max_date(self):
        """Regression: ORM must use related_name user_progress, not userprogress."""
        today = timezone.localdate()
        UserProgress.objects.create(
            user=self.user,
            course=self.course,
            last_course_activity_date=today - timedelta(days=1),
        )
        # Should not raise FieldError
        reset_inactive_streaks()

    def test_no_reset_when_active_today(self):
        today = timezone.localdate()
        UserProgress.objects.create(
            user=self.user,
            course=self.course,
            last_course_activity_date=today,
        )
        profile = self.user.profile
        UserProfile.objects.filter(pk=profile.pk).update(
            streak=4, last_completed_date=today
        )
        reset_inactive_streaks()
        profile.refresh_from_db()
        self.assertEqual(profile.streak, 4)

    def test_no_reset_when_inactive_one_calendar_day(self):
        today = timezone.localdate()
        UserProgress.objects.create(
            user=self.user,
            course=self.course,
            last_course_activity_date=today - timedelta(days=1),
        )
        profile = self.user.profile
        UserProfile.objects.filter(pk=profile.pk).update(
            streak=3, last_completed_date=today - timedelta(days=1)
        )
        reset_inactive_streaks()
        profile.refresh_from_db()
        self.assertEqual(profile.streak, 3)

    def test_reset_when_inactive_two_plus_calendar_days(self):
        today = timezone.localdate()
        UserProgress.objects.create(
            user=self.user,
            course=self.course,
            last_course_activity_date=today - timedelta(days=3),
        )
        profile = self.user.profile
        UserProfile.objects.filter(pk=profile.pk).update(
            streak=5, last_completed_date=today - timedelta(days=3)
        )
        with patch("authentication.tasks.send_streak_broken_email") as m:
            reset_inactive_streaks()
            m.delay.assert_called_once_with(self.user.id, 5)
        profile.refresh_from_db()
        self.assertEqual(profile.streak, 0)
        self.assertIsNone(profile.last_completed_date)
        self.assertEqual(
            UserProgress.objects.get(
                user=self.user, course=self.course
            ).learning_session_count,
            0,
        )

    def test_no_streak_broken_email_when_prior_streak_le_three(self):
        today = timezone.localdate()
        UserProgress.objects.create(
            user=self.user,
            course=self.course,
            last_course_activity_date=today - timedelta(days=3),
        )
        profile = self.user.profile
        UserProfile.objects.filter(pk=profile.pk).update(
            streak=2, last_completed_date=today - timedelta(days=3)
        )
        with patch("authentication.tasks.send_streak_broken_email") as m:
            reset_inactive_streaks()
            m.delay.assert_not_called()
        profile.refresh_from_db()
        self.assertEqual(profile.streak, 0)

    def test_max_last_activity_across_courses(self):
        today = timezone.localdate()
        course2 = Course.objects.create(title="C2", description="", path=self.path)
        UserProgress.objects.create(
            user=self.user,
            course=self.course,
            last_course_activity_date=today - timedelta(days=10),
        )
        UserProgress.objects.create(
            user=self.user,
            course=course2,
            last_course_activity_date=today,
        )
        profile = self.user.profile
        UserProfile.objects.filter(pk=profile.pk).update(
            streak=2, last_completed_date=today
        )
        reset_inactive_streaks()
        profile.refresh_from_db()
        self.assertEqual(profile.streak, 2)

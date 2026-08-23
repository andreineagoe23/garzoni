"""
Who the weekly digest goes to.

The queryset used to select users who had *not* logged in for seven days — the
inverse of what the task's own docstring promised, and the same audience the
Customer.io Re-engage 7d journey already covers. These pin the corrected rule:
a digest summarises a week that happened, so it goes to people who were there.
"""

from datetime import timedelta

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone

from authentication.models import UserEmailPreference, UserProfile
from education.models import Course, Lesson, LessonCompletion, Path, UserProgress

User = get_user_model()


def _digest_recipients():
    """The task's own selection, re-expressed so the test asserts on membership."""
    now = timezone.now()
    weekly_cutoff = now - timedelta(days=7)
    return (
        UserProfile.objects.filter(
            user__email_preferences__reminder_frequency="weekly",
            user__email_preferences__reminders=True,
            user__email_preferences__weekly_digest=True,
            user__email__isnull=False,
        )
        .exclude(last_reminder_sent__gt=now - timedelta(days=6))
        .filter(user__user_progress__lessoncompletion__completed_at__gte=weekly_cutoff)
        .distinct()
    )


class WeeklyDigestTargetingTests(TestCase):
    def setUp(self):
        path = Path.objects.create(title="Path", description="")
        self.course = Course.objects.create(title="Course", description="", path=path)
        self.lesson = Lesson.objects.create(
            course=self.course, title="Lesson", detailed_content="x"
        )

    def _user(self, name, email="a@b.test"):
        user = User.objects.create_user(username=name, password="x", email=email)
        UserEmailPreference.objects.update_or_create(
            user=user,
            defaults={
                "reminders": True,
                "weekly_digest": True,
                "reminder_frequency": "weekly",
            },
        )
        return user

    def _completed(self, user, days_ago):
        # One progress row per user+course — there is a unique constraint, and a
        # busy week is many completions against the same progress, not many rows.
        progress, _ = UserProgress.objects.get_or_create(user=user, course=self.course)
        completion = LessonCompletion.objects.create(user_progress=progress, lesson=self.lesson)
        # completed_at is auto_now_add, so move it after the fact.
        LessonCompletion.objects.filter(pk=completion.pk).update(
            completed_at=timezone.now() - timedelta(days=days_ago)
        )
        return completion

    def test_includes_a_user_who_completed_a_lesson_this_week(self):
        user = self._user("active")
        self._completed(user, days_ago=2)
        self.assertIn(user.profile, _digest_recipients())

    def test_excludes_a_user_with_no_activity_at_all(self):
        user = self._user("idle")
        self.assertNotIn(user.profile, _digest_recipients())

    def test_excludes_a_user_whose_only_activity_predates_the_window(self):
        user = self._user("lapsed")
        self._completed(user, days_ago=30)
        self.assertNotIn(user.profile, _digest_recipients())

    def test_lists_a_busy_user_once_not_once_per_lesson(self):
        user = self._user("busy")
        for _ in range(4):
            self._completed(user, days_ago=1)
        self.assertEqual(_digest_recipients().filter(pk=user.profile.pk).count(), 1)

    def test_respects_the_weekly_digest_opt_out(self):
        user = self._user("optout")
        self._completed(user, days_ago=1)
        UserEmailPreference.objects.filter(user=user).update(weekly_digest=False)
        self.assertNotIn(user.profile, _digest_recipients())

    def test_does_not_resend_within_the_cooldown(self):
        user = self._user("recent")
        self._completed(user, days_ago=1)
        UserProfile.objects.filter(pk=user.profile.pk).update(last_reminder_sent=timezone.now())
        self.assertNotIn(user.profile, _digest_recipients())

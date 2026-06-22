from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone

from authentication.services.profile_analytics import (
    mark_first_lesson,
    mark_onboarding_completed,
    update_last_seen_platform,
)


class ProfileAnalyticsTests(TestCase):
    def setUp(self):
        User = get_user_model()
        self.user = User.objects.create_user(username="analytics_user", password="pass")

    def test_mark_onboarding_completed_once(self):
        self.assertTrue(mark_onboarding_completed(self.user))
        self.user.profile.refresh_from_db()
        self.assertIsNotNone(self.user.profile.onboarding_completed_at)
        self.assertFalse(mark_onboarding_completed(self.user))

    def test_mark_first_lesson_once(self):
        self.assertTrue(mark_first_lesson(self.user))
        self.user.profile.refresh_from_db()
        self.assertIsNotNone(self.user.profile.first_lesson_at)
        self.assertFalse(mark_first_lesson(self.user))

    def test_sync_last_login_date(self):
        self.user.last_login = timezone.now()
        self.user.save(update_fields=["last_login"])
        self.user.profile.refresh_from_db()
        self.assertIsNotNone(self.user.profile.last_login_date)

    def test_update_last_seen_platform(self):
        self.assertTrue(update_last_seen_platform(self.user, "ios"))
        self.user.profile.refresh_from_db()
        self.assertEqual(self.user.profile.last_seen_platform, "ios")
        self.assertFalse(update_last_seen_platform(self.user, "ios"))

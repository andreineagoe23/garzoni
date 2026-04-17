from django.contrib.auth.models import User
from django.test import TestCase

from authentication.models import UserEmailPreference, UserProfile
from notifications.enums import CioTemplate
from notifications.policy import should_send_email


class NotificationPolicyTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="u1", email="u1@example.com", password="x")
        self.profile = UserProfile.objects.get(user=self.user)

    def test_password_reset_ignores_marketing_prefs(self):
        UserEmailPreference.objects.update_or_create(
            user=self.user,
            defaults={
                "reminders": False,
                "marketing": False,
                "billing_alerts": False,
            },
        )
        r = should_send_email(self.user, CioTemplate.PASSWORD_RESET)
        self.assertTrue(r.allowed)

    def test_password_changed_ignores_marketing_prefs(self):
        UserEmailPreference.objects.update_or_create(
            user=self.user,
            defaults={
                "reminders": False,
                "marketing": False,
                "billing_alerts": False,
            },
        )
        r = should_send_email(self.user, CioTemplate.PASSWORD_CHANGED)
        self.assertTrue(r.allowed)

    def test_weekly_digest_respects_digest_flag(self):
        UserEmailPreference.objects.update_or_create(
            user=self.user,
            defaults={
                "reminders": True,
                "weekly_digest": False,
            },
        )
        r = should_send_email(self.user, CioTemplate.WEEKLY_DIGEST)
        self.assertFalse(r.allowed)

    def test_billing_email_respects_billing_alerts(self):
        UserEmailPreference.objects.update_or_create(
            user=self.user,
            defaults={"billing_alerts": False},
        )
        r = should_send_email(self.user, CioTemplate.TRIAL_ENDING)
        self.assertFalse(r.allowed)

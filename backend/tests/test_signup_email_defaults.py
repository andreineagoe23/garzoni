"""
Signup email-preference defaults (GDPR-safe).

UK PECR reg. 22 and EU ePrivacy require explicit opt-in consent for marketing
emails, and pre-ticked checkboxes are invalid consent (ICO Direct Marketing
Code; EDPB Guidelines 05/2020 on consent). Service / transactional emails
(reminders, streak alerts, weekly digest of own progress, billing, push) are
legitimate interest / performance of contract and default ON.

Password reset request must also never return 500 when the Celery broker is
unavailable - all dispatch errors are swallowed and the view returns the
generic 200 "link sent" response.
"""

from __future__ import annotations

import logging
from unittest.mock import patch

from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework.test import APIClient

from authentication.models import UserEmailPreference, UserProfile

logger = logging.getLogger(__name__)


class SignupEmailDefaultsTest(TestCase):
    """New signups get GDPR-safe email preference defaults."""

    def _register(self, *, marketing_opt_in=None, username="newuser"):
        payload = {
            "username": username,
            "email": f"{username}@example.com",
            "password": "unit-test-password!",
            "first_name": "New",
            "last_name": "User",
        }
        if marketing_opt_in is not None:
            payload["marketing_opt_in"] = marketing_opt_in
        # Force reCAPTCHA to be treated as not configured so tests don't need
        # to mock a verified token. The view short-circuits the check when
        # `_recaptcha_required()` returns False.
        with patch(
            "authentication.views_auth._recaptcha_required", return_value=False
        ):
            response = APIClient().post(
                "/api/register-secure/", payload, format="json"
            )
        return response

    def test_defaults_service_on_marketing_off(self):
        """Reminders/streak/digest/billing/push default ON; marketing defaults OFF."""
        response = self._register()
        self.assertIn(response.status_code, (200, 201), response.content)
        user = User.objects.get(username="newuser")
        prefs = UserEmailPreference.objects.get(user=user)
        self.assertTrue(prefs.reminders)
        self.assertTrue(prefs.streak_alerts)
        self.assertTrue(prefs.weekly_digest)
        self.assertTrue(prefs.billing_alerts)
        self.assertTrue(prefs.push_notifications)
        self.assertEqual(prefs.reminder_frequency, "weekly")
        self.assertFalse(prefs.marketing)

    def test_profile_cadence_defaults_to_weekly(self):
        response = self._register(username="weeklyuser")
        self.assertIn(response.status_code, (200, 201), response.content)
        user = User.objects.get(username="weeklyuser")
        self.assertEqual(user.profile.email_reminder_preference, "weekly")

    def test_marketing_opt_in_is_respected(self):
        response = self._register(
            marketing_opt_in=True, username="optinuser"
        )
        self.assertIn(response.status_code, (200, 201), response.content)
        user = User.objects.get(username="optinuser")
        prefs = UserEmailPreference.objects.get(user=user)
        self.assertTrue(prefs.marketing)
        # Service defaults still ON.
        self.assertTrue(prefs.reminders)
        self.assertEqual(prefs.reminder_frequency, "weekly")


class ModelDefaultsTest(TestCase):
    """Direct model creation honors the GDPR-safe defaults without any seeding."""

    def test_email_preference_model_defaults(self):
        user = User.objects.create_user(username="modeluser", password="x" * 12)
        prefs = UserEmailPreference.objects.get(user=user)
        self.assertTrue(prefs.reminders)
        self.assertTrue(prefs.weekly_digest)
        self.assertEqual(prefs.reminder_frequency, "weekly")
        self.assertFalse(prefs.marketing)

    def test_profile_default_cadence_is_weekly(self):
        user = User.objects.create_user(username="profileuser", password="x" * 12)
        profile = UserProfile.objects.get(user=user)
        self.assertEqual(profile.email_reminder_preference, "weekly")


class PasswordResetResilienceTest(TestCase):
    """PasswordResetRequestView must never 500, even when Celery is down."""

    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username="resetuser",
            email="reset@example.com",
            password="unit-test-password!",
        )

    def test_unknown_email_returns_200(self):
        response = self.client.post(
            "/api/password-reset/",
            {"email": "nobody@example.com"},
            format="json",
        )
        self.assertEqual(response.status_code, 200)

    def test_broker_failure_returns_200(self):
        """If .delay() raises, the view still returns the generic 200."""
        with patch(
            "authentication.views_password.send_password_reset_email_task.delay",
            side_effect=RuntimeError("broker unreachable"),
        ):
            response = self.client.post(
                "/api/password-reset/",
                {"email": "reset@example.com"},
                format="json",
            )
        self.assertEqual(response.status_code, 200)

    def test_multiple_users_same_email_returns_200(self):
        """Race conditions create duplicate emails; view must cope, not 500."""
        # Bypass unique constraint: Django's auth User has no unique constraint
        # on email by default, so this is legal.
        User.objects.create_user(
            username="resetuser2",
            email="reset@example.com",
            password="unit-test-password!",
        )
        response = self.client.post(
            "/api/password-reset/",
            {"email": "reset@example.com"},
            format="json",
        )
        self.assertEqual(response.status_code, 200)

from unittest.mock import Mock, patch

from django.contrib.auth.models import User
from django.urls import reverse
from django.contrib.auth.tokens import PasswordResetTokenGenerator
from django.test import override_settings
from django.utils.encoding import force_bytes
from django.utils.http import urlsafe_base64_encode
from rest_framework import status
from rest_framework.test import APITestCase
from rest_framework_simplejwt.tokens import RefreshToken

from authentication.models import UserProfile

# Throttles and rate limits read the cache; pin it to local memory so these
# tests don't depend on a running Redis (the default backend in this project).
_LOCMEM_CACHE = override_settings(
    CACHES={"default": {"BACKEND": "django.core.cache.backends.locmem.LocMemCache"}}
)


@_LOCMEM_CACHE
class PasswordChangeRevokesSessionsTest(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="pw-user", email="pw@example.com", password="Old-pass-123!"
        )
        UserProfile.objects.get_or_create(user=self.user)

    def test_change_password_revokes_old_sessions_and_keeps_current(self):
        old_refresh = RefreshToken.for_user(self.user)
        self.client.force_authenticate(user=self.user)

        response = self.client.post(
            "/api/change-password/",
            {
                "current_password": "Old-pass-123!",
                "new_password": "New-pass-456!",
                "confirm_password": "New-pass-456!",
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("access", response.data)
        self.assertIn("refresh", response.data)

        # The current device's fresh refresh token still works.
        self.client.force_authenticate(user=None)
        new_ok = self.client.post(
            "/api/token/refresh/",
            {"refresh": response.data["refresh"]},
            format="json",
        )
        self.assertEqual(new_ok.status_code, status.HTTP_200_OK)

        # The pre-existing refresh token is now revoked.
        old_rejected = self.client.post(
            "/api/token/refresh/",
            {"refresh": str(old_refresh)},
            format="json",
        )
        self.assertEqual(old_rejected.status_code, status.HTTP_401_UNAUTHORIZED)


@_LOCMEM_CACHE
class RecaptchaMobileBypassTest(APITestCase):
    """A spoofable client_type=mobile flag must not let a *present* token skip verification."""

    def setUp(self):
        self.user = User.objects.create_user(
            username="rc-login", email="rc@example.com", password="Right-pass-123!"
        )
        UserProfile.objects.get_or_create(user=self.user)

    @patch("authentication.views_auth.verify_recaptcha", return_value=False)
    @patch("authentication.views_auth._recaptcha_required", return_value=True)
    def test_mobile_client_with_token_is_still_verified(self, _req, _verify):
        response = self.client.post(
            "/api/login-secure/",
            {
                "username": "rc-login",
                "password": "Right-pass-123!",
                "client_type": "mobile",
                "recaptcha_token": "spoofed-or-stale",
            },
            format="json",
        )
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data["code"], "recaptcha_failed")

    @patch("authentication.views_auth.verify_recaptcha", return_value=False)
    @patch("authentication.views_auth._recaptcha_required", return_value=True)
    def test_mobile_client_without_token_may_skip(self, _req, _verify):
        # Native apps can't run reCAPTCHA; with no token they pass the gate and
        # fail only on credentials — never with a reCAPTCHA code.
        response = self.client.post(
            "/api/login-secure/",
            {"username": "rc-login", "password": "Right-pass-123!", "client_type": "mobile"},
            format="json",
        )
        self.assertEqual(response.status_code, 200)


@_LOCMEM_CACHE
class PasswordResetRevokesSessionsTest(APITestCase):
    def test_reset_confirm_revokes_existing_sessions(self):
        user = User.objects.create_user(
            username="reset-user", email="reset@example.com", password="Old-pass-123!"
        )
        UserProfile.objects.get_or_create(user=user)
        old_refresh = RefreshToken.for_user(user)

        uidb64 = urlsafe_base64_encode(force_bytes(user.pk))
        token = PasswordResetTokenGenerator().make_token(user)
        response = self.client.post(
            f"/api/password-reset-confirm/{uidb64}/{token}/",
            {"new_password": "New-pass-456!", "confirm_password": "New-pass-456!"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        rejected = self.client.post(
            "/api/token/refresh/",
            {"refresh": str(old_refresh)},
            format="json",
        )
        self.assertEqual(rejected.status_code, status.HTTP_401_UNAUTHORIZED)


class VerifySessionSecurityTest(APITestCase):
    def test_verify_session_requires_authentication(self):
        response = self.client.post(
            "/api/verify-session/",
            {"session_id": "cs_test_unauth"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def setUp(self):
        self.payer = User.objects.create_user(username="payer", password="unit-test-password!")
        self.attacker = User.objects.create_user(
            username="attacker", password="unit-test-password!"
        )
        UserProfile.objects.get_or_create(user=self.payer)
        UserProfile.objects.get_or_create(user=self.attacker)

    @patch("finance.views.stripe.checkout.Session.retrieve")
    def test_verify_session_rejects_cross_user_session(self, mock_retrieve):
        mock_retrieve.return_value = Mock(
            payment_status="paid",
            payment_intent=Mock(id="pi_test_123"),
            client_reference_id=str(self.payer.id),
            metadata={"user_id": str(self.payer.id)},
            mode="payment",
            subscription=None,
            status="complete",
        )
        self.client.force_authenticate(user=self.attacker)
        response = self.client.post(
            "/api/verify-session/",
            {"session_id": "cs_test_cross_user"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)


class RevenueCatSyncSecurityTest(APITestCase):
    @patch("authentication.views_revenuecat_sync.reconcile_profile_subscription_state")
    def test_revenuecat_sync_ignores_client_rc_user_id(self, mock_reconcile):
        user = User.objects.create_user(username="rc-user", password="unit-test-password!")
        UserProfile.objects.get_or_create(user=user)
        mock_reconcile.return_value = {"provider": "revenuecat"}
        self.client.force_authenticate(user=user)
        self.client.post(
            reverse("revenuecat-sync"),
            {"rc_app_user_id": "999999"},
            format="json",
        )
        mock_reconcile.assert_called_once()
        self.assertEqual(mock_reconcile.call_args.kwargs["rc_app_user_id"], str(user.pk))


class HeartsEndpointSecurityTest(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="hearts-user", password="unit-test-password!")
        self.profile = UserProfile.objects.get_or_create(user=self.user)[0]
        self.profile.hearts = 3
        self.profile.save(update_fields=["hearts"])
        self.client.force_authenticate(user=self.user)

    def test_hearts_grant_requires_zero_hearts(self):
        response = self.client.post("/api/user/hearts/grant/", {"amount": 1}, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_hearts_grant_allowed_when_out_of_hearts(self):
        self.profile.hearts = 0
        self.profile.save(update_fields=["hearts"])
        response = self.client.post("/api/user/hearts/grant/", {"amount": 1}, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["hearts"], 1)

    def test_hearts_refill_noop_when_already_full(self):
        hearts_response = self.client.get("/api/user/hearts/")
        max_hearts = hearts_response.data["max_hearts"]
        self.profile.hearts = max_hearts
        self.profile.save(update_fields=["hearts"])
        response = self.client.post("/api/user/hearts/refill/", {}, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["hearts"], max_hearts)

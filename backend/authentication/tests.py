from datetime import datetime, timezone as dt_timezone
from unittest.mock import patch

from django.contrib.auth.models import User
from django.test import override_settings
from django.urls import reverse
from rest_framework.test import APITestCase
from rest_framework_simplejwt.tokens import RefreshToken

from authentication.entitlements import get_user_plan
from authentication.models import UserProfile
from authentication.revenuecat_products import ENTITLEMENT_PLAN_MAP
from authentication.services.subscriptions import apply_subscription_to_profile
from authentication.revenuecat_products import PRODUCT_PLAN_MAP


class TokenRefreshTests(APITestCase):
    def test_blacklisted_refresh_token_returns_401_without_error_log(self):
        user = User.objects.create_user(
            username="refresh-user",
            email="refresh@example.com",
            password="pass12345",
        )
        refresh = RefreshToken.for_user(user)
        refresh.blacklist()

        with patch("authentication.views_auth.logger.error") as mock_error:
            response = self.client.post(
                reverse("token-refresh"),
                {"refresh": str(refresh)},
                format="json",
            )

        self.assertEqual(response.status_code, 401)
        self.assertEqual(response.data.get("code"), "invalid_refresh_token")
        mock_error.assert_not_called()


class ReconcileSubscriptionStateTests(APITestCase):
    """reconcile_profile_subscription_state must not downgrade a paying user."""

    def setUp(self):
        self.user = User.objects.create_user(
            username="reconcile-user",
            email="reconcile@example.com",
            password="pass12345",
        )
        self.profile, _ = UserProfile.objects.get_or_create(user=self.user)

    def _state(self, provider, plan, status):
        from authentication.services.subscription_reconciliation import ProviderState

        return ProviderState(provider=provider, plan=plan, status=status)

    def test_unmapped_active_provider_sub_does_not_downgrade(self):
        """RC Web Billing mints its own Stripe price → plan unmapped. An active
        sub we can't map must leave an existing paid plan untouched, never reset
        it to starter."""
        from authentication.services import subscription_reconciliation as recon

        apply_subscription_to_profile(
            self.profile,
            has_paid=True,
            is_premium=True,
            subscription_status="active",
            subscription_plan_id="pro",
        )

        with (
            patch.object(recon, "_revenuecat_state", return_value=None),
            patch.object(
                recon, "_stripe_state", return_value=self._state("stripe", None, "active")
            ),
        ):
            recon.reconcile_profile_subscription_state(self.profile)

        self.profile.refresh_from_db()
        self.assertEqual(self.profile.subscription_plan_id, "pro")
        self.assertTrue(self.profile.is_premium)

    def test_all_inactive_providers_normalize_to_starter(self):
        from authentication.services import subscription_reconciliation as recon

        apply_subscription_to_profile(
            self.profile,
            has_paid=True,
            is_premium=True,
            subscription_status="active",
            subscription_plan_id="pro",
        )

        with (
            patch.object(recon, "_revenuecat_state", return_value=None),
            patch.object(
                recon, "_stripe_state", return_value=self._state("stripe", "pro", "canceled")
            ),
        ):
            recon.reconcile_profile_subscription_state(self.profile)

        self.profile.refresh_from_db()
        self.assertEqual(self.profile.subscription_plan_id, "starter")
        self.assertFalse(self.profile.is_premium)

    def test_active_mapped_provider_upgrades(self):
        from authentication.services import subscription_reconciliation as recon

        with (
            patch.object(
                recon, "_revenuecat_state", return_value=self._state("revenuecat", "pro", "active")
            ),
            patch.object(recon, "_stripe_state", return_value=None),
        ):
            recon.reconcile_profile_subscription_state(self.profile)

        self.profile.refresh_from_db()
        self.assertEqual(self.profile.subscription_plan_id, "pro")
        self.assertTrue(self.profile.is_premium)


class SubscriptionParityTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="parity-user",
            email="parity@example.com",
            password="pass12345",
        )
        self.profile, _ = UserProfile.objects.get_or_create(user=self.user)
        self.client.force_authenticate(user=self.user)

    def test_revenuecat_maps_only_supported_plan_ids(self):
        allowed = {"plus", "pro"}
        self.assertTrue(set(PRODUCT_PLAN_MAP.values()).issubset(allowed))
        self.assertTrue(set(ENTITLEMENT_PLAN_MAP.values()).issubset(allowed))

    def test_apply_subscription_plus_updates_get_user_plan_and_entitlements(self):
        apply_subscription_to_profile(
            self.profile,
            has_paid=True,
            is_premium=True,
            subscription_status="active",
            subscription_plan_id="plus",
        )
        self.profile.refresh_from_db()
        user = User.objects.get(pk=self.user.pk)
        self.assertEqual(get_user_plan(user), "plus")

        self.client.force_authenticate(user=user)
        response = self.client.get(reverse("entitlements"))
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data.get("plan"), "plus")
        self.assertTrue(response.data["features"]["personalized_path"]["enabled"])

    def test_apply_subscription_pro_updates_get_user_plan_and_entitlements(self):
        apply_subscription_to_profile(
            self.profile,
            has_paid=True,
            is_premium=True,
            subscription_status="active",
            subscription_plan_id="pro",
        )
        self.profile.refresh_from_db()
        user = User.objects.get(pk=self.user.pk)
        self.assertEqual(get_user_plan(user), "pro")

        self.client.force_authenticate(user=user)
        response = self.client.get(reverse("entitlements"))
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data.get("plan"), "pro")
        self.assertTrue(response.data["features"]["personalized_path"]["enabled"])


@override_settings(DEBUG=True, REVENUECAT_WEBHOOK_SECRET="")
class RevenueCatWebhookTrialTests(APITestCase):
    """RevenueCat webhook maps Apple free trials to trialing + trial_end."""

    def setUp(self):
        self.user = User.objects.create_user(
            username="rc-webhook-user",
            email="rc-webhook@example.com",
            password="pass12345",
        )
        self.profile, _ = UserProfile.objects.get_or_create(user=self.user)

    def test_initial_purchase_trial_sets_trialing_and_trial_end(self):
        exp = datetime(2031, 6, 15, 12, 0, 0, tzinfo=dt_timezone.utc)
        exp_ms = int(exp.timestamp() * 1000)
        body = {
            "event": {
                "type": "INITIAL_PURCHASE",
                "app_user_id": str(self.user.pk),
                "product_id": "app.garzoni.mobile.plus_yearly_v3",
                "period_type": "TRIAL",
                "expiration_at_ms": exp_ms,
            }
        }
        r = self.client.post(reverse("revenuecat-webhook"), body, format="json")
        self.assertEqual(r.status_code, 200)
        self.profile.refresh_from_db()
        self.assertEqual(self.profile.subscription_plan_id, "plus")
        self.assertEqual(self.profile.subscription_status, "trialing")
        self.assertIsNotNone(self.profile.trial_end)
        self.assertEqual(int(self.profile.trial_end.timestamp() * 1000), exp_ms)

    def test_renewal_trial_conversion_sets_active_and_clears_trial_end(self):
        apply_subscription_to_profile(
            self.profile,
            has_paid=True,
            is_premium=True,
            subscription_status="trialing",
            subscription_plan_id="pro",
            trial_end=datetime(2031, 1, 1, tzinfo=dt_timezone.utc),
        )
        body = {
            "event": {
                "type": "RENEWAL",
                "app_user_id": str(self.user.pk),
                "product_id": "app.garzoni.mobile.pro_yearly_v3",
                "period_type": "NORMAL",
                "is_trial_conversion": True,
                "expiration_at_ms": int(
                    datetime(2032, 1, 1, tzinfo=dt_timezone.utc).timestamp() * 1000
                ),
            }
        }
        r = self.client.post(reverse("revenuecat-webhook"), body, format="json")
        self.assertEqual(r.status_code, 200)
        self.profile.refresh_from_db()
        self.assertEqual(self.profile.subscription_status, "active")
        self.assertIsNone(self.profile.trial_end)

    def test_initial_purchase_normal_period_sets_active(self):
        body = {
            "event": {
                "type": "INITIAL_PURCHASE",
                "app_user_id": str(self.user.pk),
                "product_id": "app.garzoni.mobile.plus_monthly_v3",
                "period_type": "NORMAL",
                "expiration_at_ms": int(
                    datetime(2032, 6, 1, tzinfo=dt_timezone.utc).timestamp() * 1000
                ),
            }
        }
        r = self.client.post(reverse("revenuecat-webhook"), body, format="json")
        self.assertEqual(r.status_code, 200)
        self.profile.refresh_from_db()
        self.assertEqual(self.profile.subscription_status, "active")
        self.assertIsNone(self.profile.trial_end)

    def test_initial_purchase_uses_entitlement_fallback_when_product_unmapped(self):
        body = {
            "event": {
                "type": "INITIAL_PURCHASE",
                "app_user_id": str(self.user.pk),
                "product_id": "unknown.product.id",
                "entitlement_id": "Garzoni Educational Pro",
                "period_type": "NORMAL",
            }
        }
        r = self.client.post(reverse("revenuecat-webhook"), body, format="json")
        self.assertEqual(r.status_code, 200)
        self.profile.refresh_from_db()
        self.assertEqual(self.profile.subscription_plan_id, "pro")
        self.assertEqual(self.profile.subscription_status, "active")

    def test_cancellation_clears_trial_end(self):
        apply_subscription_to_profile(
            self.profile,
            has_paid=True,
            is_premium=True,
            subscription_status="trialing",
            subscription_plan_id="plus",
            trial_end=datetime(2031, 3, 1, tzinfo=dt_timezone.utc),
        )
        body = {
            "event": {
                "type": "CANCELLATION",
                "app_user_id": str(self.user.pk),
                "product_id": "app.garzoni.mobile.plus_yearly_v3",
            }
        }
        r = self.client.post(reverse("revenuecat-webhook"), body, format="json")
        self.assertEqual(r.status_code, 200)
        self.profile.refresh_from_db()
        self.assertEqual(self.profile.subscription_plan_id, "starter")
        self.assertIsNone(self.profile.trial_end)


class RevenueCatSyncTrialTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="rc-sync-user",
            email="rc-sync@example.com",
            password="pass12345",
        )
        self.profile, _ = UserProfile.objects.get_or_create(user=self.user)
        self.client.force_authenticate(user=self.user)

    @patch("authentication.services.subscription_reconciliation._fetch_rc_subscriber")
    def test_sync_maps_rest_trial_to_trialing(self, mock_fetch):
        mock_fetch.return_value = {
            "subscriber": {
                "entitlements": {
                    "Garzoni Pro": {
                        "expires_date": "2031-07-01T12:00:00Z",
                        "product_identifier": "app.garzoni.mobile.pro_yearly_v3",
                        "period_type": "trial",
                    }
                },
                "subscriptions": {
                    "app.garzoni.mobile.pro_yearly_v3": {
                        "expires_date": "2031-07-01T12:00:00Z",
                        "period_type": "trial",
                        "unsubscribe_detected_at": None,
                    }
                },
            }
        }
        r = self.client.post(reverse("revenuecat-sync"), {}, format="json")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.data.get("plan"), "pro")
        self.assertEqual(r.data.get("subscription_status"), "trialing")
        self.profile.refresh_from_db()
        self.assertEqual(self.profile.subscription_status, "trialing")
        self.assertIsNotNone(self.profile.trial_end)

    @patch("authentication.services.subscription_reconciliation._fetch_rc_subscriber")
    def test_sync_maps_normal_period_to_active(self, mock_fetch):
        mock_fetch.return_value = {
            "subscriber": {
                "entitlements": {
                    "Garzoni Plus": {
                        "expires_date": "2032-01-01T00:00:00Z",
                        "product_identifier": "app.garzoni.mobile.plus_monthly_v3",
                        "period_type": "normal",
                    }
                },
                "subscriptions": {
                    "app.garzoni.mobile.plus_monthly_v3": {
                        "expires_date": "2032-01-01T00:00:00Z",
                        "period_type": "normal",
                        "unsubscribe_detected_at": None,
                    }
                },
            }
        }
        self.client.post(reverse("revenuecat-sync"), {}, format="json")
        self.profile.refresh_from_db()
        self.assertEqual(self.profile.subscription_status, "active")
        self.assertIsNone(self.profile.trial_end)

    @patch("authentication.services.subscription_reconciliation._fetch_rc_subscriber")
    def test_sync_accepts_educational_entitlement_alias(self, mock_fetch):
        mock_fetch.return_value = {
            "subscriber": {
                "entitlements": {
                    "Garzoni Educational Plus": {
                        "expires_date": "2032-01-01T00:00:00Z",
                        "product_identifier": "app.garzoni.mobile.plus_monthly_v3",
                        "period_type": "normal",
                    }
                },
                "subscriptions": {
                    "app.garzoni.mobile.plus_monthly_v3": {
                        "expires_date": "2032-01-01T00:00:00Z",
                        "period_type": "normal",
                        "unsubscribe_detected_at": None,
                    }
                },
            }
        }
        r = self.client.post(reverse("revenuecat-sync"), {}, format="json")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.data.get("plan"), "plus")


class EntitlementsProfileFieldsTests(APITestCase):
    def test_entitlements_includes_status_and_trial_end(self):
        user = User.objects.create_user(
            username="ent-fields",
            email="ent-fields@example.com",
            password="pass12345",
        )
        profile, _ = UserProfile.objects.get_or_create(user=user)
        apply_subscription_to_profile(
            profile,
            has_paid=True,
            is_premium=True,
            subscription_status="trialing",
            subscription_plan_id="pro",
            trial_end=datetime(2031, 8, 1, 10, 0, 0, tzinfo=dt_timezone.utc),
        )
        self.client.force_authenticate(user=user)
        response = self.client.get(reverse("entitlements"))
        self.assertEqual(response.status_code, 200)
        # authentication.EntitlementsView returns status/trial_end at top level
        self.assertEqual(response.data.get("status"), "trialing")
        self.assertTrue(response.data.get("entitled"))
        self.assertIn("trial_end", response.data)
        self.assertIn("2031-08-01", response.data.get("trial_end") or "")
        self.assertIn("billing_interval", response.data)
        self.assertIn("billingInterval", response.data)


class PlanBypassTests(APITestCase):
    """A user must not be able to grant themselves a paid plan."""

    def setUp(self):
        self.user = User.objects.create_user(
            username="bypass-user", email="bypass@example.com", password="pass12345"
        )
        self.profile, _ = UserProfile.objects.get_or_create(user=self.user)
        self.client.force_authenticate(user=self.user)

    def test_patch_userprofile_cannot_set_subscription_plan(self):
        resp = self.client.patch(
            reverse("userprofile"), {"subscription_plan_id": "pro"}, format="json"
        )
        # Request may succeed (other fields) but the plan must not change.
        self.profile.refresh_from_db()
        self.assertNotEqual(self.profile.subscription_plan_id, "pro")
        self.assertEqual(get_user_plan(self.user), "starter")

    def test_get_user_plan_ignores_plan_without_payment_flag(self):
        # Even if subscription_plan_id is somehow "pro", no has_paid/is_premium = starter.
        self.profile.subscription_plan_id = "pro"
        self.profile.has_paid = False
        self.profile.is_premium = False
        self.profile.save()
        self.assertEqual(get_user_plan(self.user), "starter")


class RegisterConsentTests(APITestCase):
    def _payload(self, **over):
        base = {
            "username": "newperson",
            "email": "newperson@example.com",
            "password": "StrongPass123",
            "accept_terms": True,
            "age_confirmed": True,
            # Bypass reCAPTCHA the way the native app does.
            "client_type": "mobile",
        }
        base.update(over)
        return base

    def test_register_requires_terms_acceptance(self):
        resp = self.client.post(
            reverse("register-secure"), self._payload(accept_terms=False), format="json"
        )
        self.assertEqual(resp.status_code, 400)
        self.assertFalse(User.objects.filter(username="newperson").exists())

    def test_register_requires_age_confirmation(self):
        resp = self.client.post(
            reverse("register-secure"),
            self._payload(username="u2", email="u2@example.com", age_confirmed=False),
            format="json",
        )
        self.assertEqual(resp.status_code, 400)

    def test_register_records_consent(self):
        resp = self.client.post(reverse("register-secure"), self._payload(), format="json")
        self.assertEqual(resp.status_code, 201)
        profile = User.objects.get(username="newperson").profile
        self.assertTrue(profile.age_confirmed)
        self.assertIsNotNone(profile.terms_accepted_at)
        self.assertTrue(profile.terms_version)

    def test_register_rejects_weak_password(self):
        resp = self.client.post(
            reverse("register-secure"),
            self._payload(username="u3", email="u3@example.com", password="123"),
            format="json",
        )
        self.assertEqual(resp.status_code, 400)

    def test_register_tags_signup_platform_from_header(self):
        resp = self.client.post(
            reverse("register-secure"),
            self._payload(username="plat", email="plat@example.com"),
            format="json",
            HTTP_X_GARZONI_PLATFORM="android",
        )
        self.assertEqual(resp.status_code, 201)
        profile = User.objects.get(username="plat").profile
        self.assertEqual(profile.signup_platform, "android")


class SlimRegistrationTests(APITestCase):
    """UX Phase 2 (plan §2.1): email+password+consents-only signup."""

    def _payload(self, **over):
        base = {
            "email": "jane.doe+app@example.com",
            "password": "StrongPass123",
            "accept_terms": True,
            "age_confirmed": True,
            "client_type": "mobile",
        }
        base.update(over)
        return base

    def test_register_without_username_or_names_succeeds(self):
        resp = self.client.post(reverse("register-secure"), self._payload(), format="json")
        self.assertEqual(resp.status_code, 201)
        user = User.objects.get(email="jane.doe+app@example.com")
        self.assertEqual(user.username, "janedoeapp")
        self.assertEqual(user.first_name, "")

    def test_auto_username_dedupes_with_suffix(self):
        User.objects.create_user(
            username="janedoeapp", email="taken@example.com", password="StrongPass123"
        )
        resp = self.client.post(reverse("register-secure"), self._payload(), format="json")
        self.assertEqual(resp.status_code, 201)
        user = User.objects.get(email="jane.doe+app@example.com")
        self.assertEqual(user.username, "janedoeapp2")

    def test_explicit_username_still_respected(self):
        resp = self.client.post(
            reverse("register-secure"), self._payload(username="chosen"), format="json"
        )
        self.assertEqual(resp.status_code, 201)
        self.assertTrue(User.objects.filter(username="chosen").exists())

    def test_unslugifiable_local_part_falls_back_to_user(self):
        # "___" slugifies to empty → generator falls back to "user".
        resp = self.client.post(
            reverse("register-secure"), self._payload(email="___@example.com"), format="json"
        )
        self.assertEqual(resp.status_code, 201)
        user = User.objects.get(email="___@example.com")
        self.assertEqual(user.username, "user")


class EmailLoginTests(APITestCase):
    """UX Phase 2 (plan §2.1): login accepts email as the identifier."""

    def setUp(self):
        self.user = User.objects.create_user(
            username="realname", email="Login@Example.com", password="StrongPass123"
        )

    def _login(self, identifier, password="StrongPass123"):
        return self.client.post(
            reverse("login-secure"),
            {"username": identifier, "password": password, "client_type": "mobile"},
            format="json",
        )

    def test_login_with_email_succeeds(self):
        resp = self._login("login@example.com")
        self.assertEqual(resp.status_code, 200)

    def test_login_with_email_wrong_password_uniform_error(self):
        resp = self._login("login@example.com", password="nope")
        self.assertEqual(resp.status_code, 401)
        self.assertEqual(resp.data.get("code"), "invalid_credentials")

    def test_login_with_username_still_works(self):
        resp = self._login("realname")
        self.assertEqual(resp.status_code, 200)

    def test_duplicate_emails_fail_closed(self):
        User.objects.create_user(
            username="dupe", email="login@example.com", password="OtherPass123"
        )
        resp = self._login("login@example.com")
        self.assertEqual(resp.status_code, 401)


class LoginHardeningTests(APITestCase):
    def test_inactive_user_cannot_login(self):
        user = User.objects.create_user(
            username="inactive", email="inactive@example.com", password="StrongPass123"
        )
        user.is_active = False
        user.save(update_fields=["is_active"])
        resp = self.client.post(
            reverse("login-secure"),
            {
                "username": "inactive",
                "password": "StrongPass123",
                "client_type": "mobile",
            },
            format="json",
        )
        self.assertEqual(resp.status_code, 401)
        self.assertEqual(resp.data.get("code"), "invalid_credentials")

    def test_wrong_and_missing_user_return_same_shape(self):
        User.objects.create_user(
            username="real", email="real@example.com", password="StrongPass123"
        )
        wrong_pw = self.client.post(
            reverse("login-secure"),
            {"username": "real", "password": "nope", "client_type": "mobile"},
            format="json",
        )
        no_user = self.client.post(
            reverse("login-secure"),
            {"username": "ghost", "password": "nope", "client_type": "mobile"},
            format="json",
        )
        self.assertEqual(wrong_pw.status_code, 401)
        self.assertEqual(no_user.status_code, 401)
        self.assertEqual(wrong_pw.data.get("code"), no_user.data.get("code"))


class PasswordResetStrengthTests(APITestCase):
    def test_reset_rejects_weak_password(self):
        from django.contrib.auth.tokens import PasswordResetTokenGenerator
        from django.utils.encoding import force_bytes
        from django.utils.http import urlsafe_base64_encode

        user = User.objects.create_user(
            username="resetme", email="resetme@example.com", password="StrongPass123"
        )
        uid = urlsafe_base64_encode(force_bytes(user.pk))
        token = PasswordResetTokenGenerator().make_token(user)
        resp = self.client.post(
            reverse("password_reset_confirm", args=[uid, token]),
            {"new_password": "123", "confirm_password": "123"},
            format="json",
        )
        self.assertEqual(resp.status_code, 400)

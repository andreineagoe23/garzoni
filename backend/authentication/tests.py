from datetime import datetime, timezone as dt_timezone
from unittest.mock import patch

from django.contrib.auth.models import User
from django.test import override_settings
from django.urls import reverse
from rest_framework.test import APITestCase

from authentication.entitlements import get_user_plan
from authentication.models import UserProfile
from authentication.revenuecat_products import ENTITLEMENT_PLAN_MAP
from authentication.services.subscriptions import apply_subscription_to_profile
from authentication.views_revenuecat import PRODUCT_PLAN_MAP


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

    @patch("authentication.views_revenuecat_sync._fetch_rc_subscriber")
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

    @patch("authentication.views_revenuecat_sync._fetch_rc_subscriber")
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

from django.contrib.auth.models import User
from django.urls import reverse
from rest_framework.test import APITestCase

from authentication.entitlements import get_user_plan
from authentication.models import UserProfile
from authentication.services.subscriptions import apply_subscription_to_profile
from authentication.views_revenuecat import PRODUCT_PLAN_MAP
from authentication.views_revenuecat_sync import _ENTITLEMENT_PLAN_MAP


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
        self.assertTrue(set(_ENTITLEMENT_PLAN_MAP.values()).issubset(allowed))

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

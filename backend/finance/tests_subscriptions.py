from unittest.mock import patch

from django.contrib.auth.models import User
from django.test import override_settings
from django.urls import reverse
from rest_framework.test import APITestCase

from authentication.models import UserProfile


@override_settings(STRIPE_WEBHOOK_SECRET="whsec_test")
class StripeWebhookSubscriptionStatusTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="stripe-webhook-user",
            email="stripe-webhook@example.com",
            password="pass12345",
        )
        self.profile, _ = UserProfile.objects.get_or_create(
            user=self.user,
            defaults={
                "subscription_plan_id": "starter",
                "subscription_status": "inactive",
                "stripe_subscription_id": "sub_123",
            },
        )
        self.profile.stripe_subscription_id = "sub_123"
        self.profile.subscription_plan_id = "starter"
        self.profile.subscription_status = "inactive"
        self.profile.save()

    @patch("finance.views.stripe.Webhook.construct_event")
    def test_subscription_updated_past_due_keeps_premium_and_plan(self, mock_construct):
        self.profile.subscription_plan_id = "plus"
        self.profile.save(update_fields=["subscription_plan_id"])
        mock_construct.return_value = {
            "id": "evt_1",
            "type": "customer.subscription.updated",
            "data": {
                "object": {
                    "id": "sub_123",
                    "status": "past_due",
                    "items": {"data": [{"price": {"id": "price_plus_monthly"}}]},
                }
            },
        }
        with override_settings(STRIPE_PRICE_PLUS_MONTHLY="price_plus_monthly"):
            r = self.client.post(
                reverse("stripe-webhook"),
                data="{}",
                content_type="application/json",
                HTTP_STRIPE_SIGNATURE="sig_test",
            )
        self.assertEqual(r.status_code, 200)
        self.profile.refresh_from_db()
        self.assertEqual(self.profile.subscription_plan_id, "plus")
        self.assertEqual(self.profile.subscription_status, "past_due")
        self.assertTrue(self.profile.has_paid)
        self.assertTrue(self.profile.is_premium)

    @patch("finance.views.stripe.Webhook.construct_event")
    def test_subscription_updated_canceled_downgrades_to_starter(self, mock_construct):
        self.profile.subscription_plan_id = "pro"
        self.profile.subscription_status = "active"
        self.profile.has_paid = True
        self.profile.is_premium = True
        self.profile.save()
        mock_construct.return_value = {
            "id": "evt_2",
            "type": "customer.subscription.updated",
            "data": {"object": {"id": "sub_123", "status": "canceled", "items": {"data": []}}},
        }
        r = self.client.post(
            reverse("stripe-webhook"),
            data="{}",
            content_type="application/json",
            HTTP_STRIPE_SIGNATURE="sig_test",
        )
        self.assertEqual(r.status_code, 200)
        self.profile.refresh_from_db()
        self.assertEqual(self.profile.subscription_plan_id, "starter")
        self.assertEqual(self.profile.subscription_status, "canceled")
        self.assertFalse(self.profile.has_paid)
        self.assertFalse(self.profile.is_premium)

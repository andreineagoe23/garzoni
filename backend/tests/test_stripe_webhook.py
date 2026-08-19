"""Stripe webhook contract tests.

The audit (§3.2) called this the least-tested high-consequence code in the repo:
it is the only path that grants and revokes paid access, and it had two tests.
The Django 5 upgrade later proved the point — four `timezone.utc` call sites in
this handler would have raised AttributeError in production and the suite said
nothing.

These pin the contract Stripe depends on:
  * a bad signature is rejected 400 (never processed)
  * a duplicate delivery is a no-op 200 (Stripe retries; we must not double-grant)
  * an unconfigured secret is 500, not a silent pass
  * a handler error still returns 200, so Stripe stops retrying a poison event
"""

from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings
from django.urls import reverse

from finance.models import StripeWebhookEvent

User = get_user_model()

SECRET = "whsec_test_not_a_real_secret"  # pragma: allowlist secret


def checkout_event(user_id, event_id="evt_checkout_1"):
    return {
        "id": event_id,
        "type": "checkout.session.completed",
        "data": {
            "object": {
                "id": "cs_test_123",
                "client_reference_id": str(user_id),
                "subscription": None,
                "metadata": {"plan_id": "plus"},
            }
        },
    }


@override_settings(STRIPE_WEBHOOK_SECRET=SECRET, STRIPE_SECRET_KEY="sk_test_x")
class StripeWebhookContractTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="payer", password="pw-not-a-secret")
        self.url = "/api/stripe-webhook/"

    def _post(self, body=b"{}"):
        return self.client.post(
            self.url,
            data=body,
            content_type="application/json",
            HTTP_STRIPE_SIGNATURE="t=1,v1=deadbeef",
        )

    # ---------------------------------------------------------------- signature
    def test_bad_signature_is_rejected_and_never_processed(self):
        import stripe

        with patch(
            "stripe.Webhook.construct_event",
            side_effect=stripe.error.SignatureVerificationError("bad sig", "sig_header"),
        ):
            res = self._post()

        self.assertEqual(res.status_code, 400)
        self.assertEqual(
            StripeWebhookEvent.objects.count(),
            0,
            "an unverified event must not be recorded as processed",
        )

    @override_settings(STRIPE_WEBHOOK_SECRET="")
    def test_missing_secret_fails_loudly(self):
        """A blank secret must not degrade into accepting unsigned events."""
        res = self._post()
        self.assertEqual(res.status_code, 500)
        self.assertEqual(StripeWebhookEvent.objects.count(), 0)

    # -------------------------------------------------------------- idempotency
    def test_duplicate_delivery_is_a_noop(self):
        event = checkout_event(self.user.id, event_id="evt_dupe")

        with patch("stripe.Webhook.construct_event", return_value=event):
            first = self._post()
            second = self._post()

        self.assertEqual(first.status_code, 200)
        self.assertEqual(second.status_code, 200)
        self.assertEqual(
            StripeWebhookEvent.objects.filter(event_id="evt_dupe").count(),
            1,
            "the dedupe row must be written exactly once",
        )

    def test_each_distinct_event_is_recorded_once(self):
        with patch(
            "stripe.Webhook.construct_event", return_value=checkout_event(self.user.id, "evt_a")
        ):
            self._post()
        with patch(
            "stripe.Webhook.construct_event", return_value=checkout_event(self.user.id, "evt_b")
        ):
            self._post()

        self.assertEqual(StripeWebhookEvent.objects.count(), 2)

    # ------------------------------------------------------------- event types
    def test_checkout_session_completed_grants_the_plan(self):
        event = checkout_event(self.user.id, "evt_grant")

        with patch("stripe.Webhook.construct_event", return_value=event):
            res = self._post()

        self.assertEqual(res.status_code, 200)
        self.user.refresh_from_db()
        profile = self.user.profile
        self.assertEqual(profile.subscription_plan_id, "plus")

    def test_checkout_without_client_reference_id_does_not_crash(self):
        """Stripe can deliver a session with no client_reference_id; that must
        not 500 or Stripe will retry it forever."""
        event = checkout_event(self.user.id, "evt_noref")
        event["data"]["object"]["client_reference_id"] = None

        with patch("stripe.Webhook.construct_event", return_value=event):
            res = self._post()

        self.assertEqual(res.status_code, 200)

    def test_checkout_with_unknown_user_does_not_crash(self):
        event = checkout_event(999999, "evt_ghost")

        with patch("stripe.Webhook.construct_event", return_value=event):
            res = self._post()

        self.assertEqual(res.status_code, 200)

    def test_checkout_with_non_numeric_reference_does_not_crash(self):
        event = checkout_event(self.user.id, "evt_badref")
        event["data"]["object"]["client_reference_id"] = "not-an-int"

        with patch("stripe.Webhook.construct_event", return_value=event):
            res = self._post()

        self.assertEqual(res.status_code, 200)

    def test_subscription_deleted_is_accepted(self):
        event = {
            "id": "evt_cancel",
            "type": "customer.subscription.deleted",
            "data": {"object": {"id": "sub_1", "customer": "cus_1", "status": "canceled"}},
        }

        with patch("stripe.Webhook.construct_event", return_value=event):
            res = self._post()

        self.assertEqual(res.status_code, 200)
        self.assertTrue(StripeWebhookEvent.objects.filter(event_id="evt_cancel").exists())

    def test_invoice_payment_failed_is_accepted(self):
        event = {
            "id": "evt_failed",
            "type": "invoice.payment_failed",
            "data": {
                "object": {
                    "id": "in_1",
                    "customer": "cus_1",
                    "amount_due": 699,
                    "currency": "gbp",
                }
            },
        }

        with patch("stripe.Webhook.construct_event", return_value=event):
            res = self._post()

        self.assertEqual(res.status_code, 200)

    def test_invoice_payment_succeeded_is_accepted(self):
        event = {
            "id": "evt_paid",
            "type": "invoice.payment_succeeded",
            "data": {
                "object": {
                    "id": "in_2",
                    "customer": "cus_1",
                    "amount_paid": 699,
                    "currency": "gbp",
                }
            },
        }

        with patch("stripe.Webhook.construct_event", return_value=event):
            res = self._post()

        self.assertEqual(res.status_code, 200)

    def test_unhandled_event_type_is_acknowledged(self):
        """Stripe sends event types we do not handle. Acknowledge them or Stripe
        retries and eventually disables the endpoint."""
        event = {"id": "evt_unknown", "type": "customer.updated", "data": {"object": {}}}

        with patch("stripe.Webhook.construct_event", return_value=event):
            res = self._post()

        self.assertEqual(res.status_code, 200)

    def test_handler_exception_still_acknowledges(self):
        """A poison payload must not put Stripe into an infinite retry loop."""
        event = checkout_event(self.user.id, "evt_boom")
        event["data"] = {}  # malformed: no "object"

        with patch("stripe.Webhook.construct_event", return_value=event):
            res = self._post()

        self.assertEqual(res.status_code, 200)

"""Customer.io transactional message_data expansion."""

from django.test import SimpleTestCase

from notifications.customer_io import expand_transactional_message_data


class ExpandTransactionalMessageDataTests(SimpleTestCase):
    def test_adds_first_name_alias_from_customer_name(self):
        out = expand_transactional_message_data({"customer_name": "Alex"})
        self.assertEqual(out["customer_name"], "Alex")
        self.assertEqual(out["first_name"], "Alex")
        self.assertEqual(out["display_name"], "Alex")

    def test_preserves_explicit_first_name(self):
        out = expand_transactional_message_data(
            {"customer_name": "Alex", "first_name": "Alexander"}
        )
        self.assertEqual(out["first_name"], "Alexander")

    def test_order_aliases(self):
        out = expand_transactional_message_data(
            {
                "order_id": "cs_test_123",
                "plan_name": "Plus",
                "amount": "9.99 USD",
                "period_end": "April 18, 2026",
            }
        )
        self.assertEqual(out["checkout_session_id"], "cs_test_123")
        self.assertEqual(out["stripe_checkout_session_id"], "cs_test_123")
        self.assertEqual(out["next_bill"], "April 18, 2026")
        self.assertEqual(out["plan"], "Plus")
        self.assertEqual(out["total"], "9.99 USD")

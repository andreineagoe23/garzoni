"""Pagination and query-count contract for the budgeting lists (audit §2.2, §4.2).

The statement history list was unbounded, and the transaction list silently
returned only the 500 newest rows with no signal to the caller. The transaction
serializer also touched `transaction.category` per row, which was one extra query
each.
"""

from datetime import date, timedelta
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from budgeting.models import StatementImport, Transaction, TransactionCategory

User = get_user_model()


def make_plus_user(username):
    user = User.objects.create_user(username=username, password="pw-not-a-secret")
    profile = user.profile
    profile.has_paid = True
    profile.subscription_plan_id = "plus"
    profile.save()
    return user


class TransactionListTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.user = make_plus_user("txn_user")
        cls.category = TransactionCategory.objects.create(slug="groceries", label="Groceries")

    def _make_transactions(self, count):
        Transaction.objects.bulk_create(
            [
                Transaction(
                    user=self.user,
                    category=self.category,
                    amount=Decimal("-12.34"),
                    currency="GBP",
                    description=f"row {i}",
                    posted_at=date(2026, 1, 1) + timedelta(days=i % 300),
                )
                for i in range(count)
            ]
        )

    def test_response_is_paginated_not_a_bare_list(self):
        self._make_transactions(3)
        self.client = APIClient()
        self.client.force_authenticate(self.user)

        res = self.client.get("/api/budgeting/transactions/")

        self.assertEqual(res.status_code, 200)
        body = res.json()
        self.assertIn("count", body)
        self.assertIn("results", body)
        self.assertEqual(body["count"], 3)

    def test_more_than_500_rows_are_reachable(self):
        """The old queryset sliced at [:500] and dropped the rest silently."""
        self._make_transactions(520)
        self.client = APIClient()
        self.client.force_authenticate(self.user)

        res = self.client.get("/api/budgeting/transactions/")

        self.assertEqual(res.json()["count"], 520, "count must reflect every row, not the page")
        self.assertIsNotNone(res.json()["next"], "the remaining rows must be reachable")

    def test_page_size_is_capped(self):
        self._make_transactions(60)
        self.client = APIClient()
        self.client.force_authenticate(self.user)

        res = self.client.get("/api/budgeting/transactions/?page_size=9999")

        self.assertLessEqual(len(res.json()["results"]), 200, "max_page_size must be enforced")

    def test_query_count_does_not_grow_with_rows(self):
        """select_related("category") — without it each row costs one query."""
        self.client = APIClient()
        self.client.force_authenticate(self.user)

        from django.db import connection
        from django.test.utils import CaptureQueriesContext

        self._make_transactions(5)
        with CaptureQueriesContext(connection) as small:
            self.client.get("/api/budgeting/transactions/")

        Transaction.objects.all().delete()
        self._make_transactions(40)
        with CaptureQueriesContext(connection) as large:
            self.client.get("/api/budgeting/transactions/")

        self.assertEqual(
            len(small.captured_queries),
            len(large.captured_queries),
            "query count scales with row count — category is not being joined",
        )

    def test_free_plan_is_still_gated(self):
        free = User.objects.create_user(username="txn_free", password="pw-not-a-secret")
        self.client = APIClient()
        self.client.force_authenticate(free)

        res = self.client.get("/api/budgeting/transactions/")

        self.assertEqual(res.status_code, 402)


class StatementHistoryPaginationTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.user = make_plus_user("stmt_user")

    def test_history_is_paginated(self):
        for i in range(3):
            StatementImport.objects.create(user=self.user, filename=f"s{i}.csv")
        self.client = APIClient()
        self.client.force_authenticate(self.user)

        res = self.client.get("/api/budgeting/statements/")

        self.assertEqual(res.status_code, 200)
        body = res.json()
        self.assertIn("results", body)
        self.assertEqual(body["count"], 3)

    def test_clients_reading_results_or_bare_list_still_work(self):
        """Both clients use `data?.results ?? data ?? []`, so the paginated shape
        must expose `results` as a list."""
        StatementImport.objects.create(user=self.user, filename="a.csv")
        self.client = APIClient()
        self.client.force_authenticate(self.user)

        body = self.client.get("/api/budgeting/statements/").json()

        self.assertIsInstance(body["results"], list)

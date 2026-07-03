"""Equivalence tests for the SQL-side budgeting aggregation.

`_aggregate_period` and `envelopes_with_progress` were rewritten from Python
loops to grouped ORM aggregation; these tests pin the old loop semantics
(reimplemented here as oracles) against the new implementation over fixtures
covering the tricky cases: slug vs raw category fallback, empty raw, the
slug-AND-raw overlap (must not double count), case-insensitive raw matching,
over-budget flags, and month boundaries.
"""

from collections import defaultdict
from datetime import date
from decimal import Decimal

from django.contrib.auth.models import User
from django.test import TestCase

from budgeting.models import BudgetEnvelope, Transaction, TransactionCategory
from budgeting.services.summaries import (
    _aggregate_period,
    envelopes_with_progress,
    month_start,
)

REF = date(2026, 7, 15)
IN_MONTH = date(2026, 7, 10)
PREV_MONTH = date(2026, 6, 28)


def oracle_aggregate(user, period_start):
    """The pre-refactor Python-loop aggregation, kept as the source of truth."""
    from datetime import timedelta

    next_period_start = (period_start + timedelta(days=32)).replace(day=1)
    transactions = Transaction.objects.filter(
        user=user, posted_at__gte=period_start, posted_at__lt=next_period_start
    )
    total_income = Decimal("0")
    total_spent = Decimal("0")
    by_cat = defaultdict(Decimal)
    for tx in transactions:
        if tx.amount > 0:
            total_income += tx.amount
        else:
            spent = -tx.amount
            total_spent += spent
            key = (
                tx.category.slug
                if tx.category_id and getattr(tx.category, "slug", None)
                else (tx.provider_category_raw or "other").lower()
            )
            by_cat[key] += spent
    return total_income, total_spent, dict(by_cat)


def oracle_envelope_spent(user, env, period_start):
    from datetime import timedelta

    from django.db.models import Q

    next_period_start = (period_start + timedelta(days=32)).replace(day=1)
    qs = Transaction.objects.filter(
        user=user,
        posted_at__gte=period_start,
        posted_at__lt=next_period_start,
        amount__lt=0,
    ).filter(Q(category__slug=env.category) | Q(provider_category_raw__iexact=env.category))
    return sum((-tx.amount for tx in qs), Decimal("0"))


class BudgetingSummariesEquivalenceTest(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.user = User.objects.create_user("summaries_user")
        groceries = TransactionCategory.objects.create(slug="groceries", label="Groceries")
        cls.env_groceries = BudgetEnvelope.objects.create(
            user=cls.user,
            category="groceries",
            label="Groceries",
            monthly_target=Decimal("100.00"),
        )
        cls.env_dining = BudgetEnvelope.objects.create(
            user=cls.user,
            category="dining",
            label="Dining",
            monthly_target=Decimal("50.00"),
        )

        def tx(amount, *, category=None, raw="", posted=IN_MONTH, currency="USD"):
            return Transaction.objects.create(
                user=cls.user,
                amount=Decimal(amount),
                currency=currency,
                posted_at=posted,
                category=category,
                provider_category_raw=raw,
            )

        # income
        tx("2000.00")
        tx("15.50", currency="EUR")
        # categorised spend (slug key)
        tx("-40.00", category=groceries)
        tx("-80.00", category=groceries)  # pushes groceries over its 100 target
        # overlap: slug AND raw both match the groceries envelope — one tx,
        # must count once in the envelope total
        tx("-10.00", category=groceries, raw="Groceries")
        # raw-only spend, case-insensitive envelope match ("DINING" -> dining)
        tx("-20.00", raw="DINING")
        tx("-5.25", raw="Dining")
        # raw-only spend with no envelope
        tx("-7.00", raw="Transport")
        # empty raw and no category -> "other"
        tx("-3.00")
        # outside the month — excluded everywhere
        tx("-999.00", posted=PREV_MONTH, category=groceries)

    def test_aggregate_period_matches_python_oracle(self):
        period_start = month_start(REF)
        income, spent, by_cat = oracle_aggregate(self.user, period_start)
        summary = _aggregate_period(self.user, period_start)

        self.assertEqual(summary.total_income, income)
        self.assertEqual(summary.total_spent, spent)
        self.assertEqual(summary.net_cash_flow, income - spent)
        self.assertEqual({r.category: r.spent for r in summary.by_category}, by_cat)
        # descending spend order
        spends = [r.spent for r in summary.by_category]
        self.assertEqual(spends, sorted(spends, reverse=True))
        # dominant currency (9 USD rows vs 1 EUR)
        self.assertEqual(summary.currency, "USD")

    def test_aggregate_period_envelope_flags(self):
        summary = _aggregate_period(self.user, month_start(REF))
        rows = {r.category: r for r in summary.by_category}
        # groceries slug rows: 40 + 80 + 10 = 130 > 100 target
        self.assertEqual(rows["groceries"].spent, Decimal("130.00"))
        self.assertTrue(rows["groceries"].over_budget)
        self.assertEqual(rows["groceries"].target, Decimal("100.00"))
        # raw "dining" bucket: 20 + 5.25, under its 50 target
        self.assertEqual(rows["dining"].spent, Decimal("25.25"))
        self.assertFalse(rows["dining"].over_budget)
        # uncategorised buckets get no target and a titleised label
        self.assertIsNone(rows["transport"].target)
        self.assertEqual(rows["other"].spent, Decimal("3.00"))

    def test_envelopes_with_progress_matches_oracle_and_never_double_counts(self):
        period_start = month_start(REF)
        result = {
            e["category"]: e["spent_this_period"] for e in envelopes_with_progress(self.user, REF)
        }
        for env in (self.env_groceries, self.env_dining):
            self.assertEqual(
                result[env.category], oracle_envelope_spent(self.user, env, period_start)
            )
        # the slug+raw overlap tx counts once: 40 + 80 + 10 = 130 (not 140)
        self.assertEqual(result["groceries"], Decimal("130.00"))
        self.assertEqual(result["dining"], Decimal("25.25"))

    def test_empty_month_defaults(self):
        empty_user = User.objects.create_user("summaries_empty")
        summary = _aggregate_period(empty_user, month_start(REF))
        self.assertEqual(summary.total_income, Decimal("0"))
        self.assertEqual(summary.total_spent, Decimal("0"))
        self.assertEqual(summary.currency, "USD")
        self.assertEqual(summary.by_category, [])
        self.assertEqual(envelopes_with_progress(empty_user, REF), [])

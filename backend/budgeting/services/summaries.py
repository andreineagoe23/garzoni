"""Compute monthly spending summaries and envelope status for a user.

All aggregation happens database-side (conditional ``Sum`` + one grouped
pass per call); Python only maps envelope targets onto the grouped rows.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, timedelta
from decimal import Decimal
from typing import Iterable, List, Optional, Tuple

from django.db.models import Count, DecimalField, F, Q, Sum, Value
from django.db.models.functions import Coalesce, Lower, NullIf
from django.utils import timezone

from budgeting.models import (
    BudgetEnvelope,
    BudgetPeriodSummary,
    SpendingAnomaly,
    Transaction,
)

_ZERO_DEC = Value(Decimal("0"), output_field=DecimalField())


@dataclass
class CategoryRow:
    category: str
    label: str
    spent: Decimal
    target: Optional[Decimal]
    over_budget: bool


@dataclass
class PeriodSummary:
    period_start: date
    currency: str
    total_income: Decimal
    total_spent: Decimal
    net_cash_flow: Decimal
    by_category: List[CategoryRow]


def month_start(d: date) -> date:
    return d.replace(day=1)


def _period_bounds(ref: date) -> Tuple[date, date]:
    period_start = month_start(ref)
    next_period_start = (period_start + timedelta(days=32)).replace(day=1)
    return period_start, next_period_start


def _outflow_spend_by_pair(user, period_start: date, next_period_start: date):
    """One grouped pass over the month's outflows keyed by
    ``(category slug, lowercased raw provider category)`` so envelope matching
    (slug OR raw) can be resolved from the grouped rows without double
    counting transactions that match both."""
    return (
        Transaction.objects.filter(
            user=user,
            posted_at__gte=period_start,
            posted_at__lt=next_period_start,
            amount__lt=0,
        )
        .annotate(raw_cat=Lower("provider_category_raw"))
        .values("category__slug", "raw_cat")
        .annotate(spend=Sum(-F("amount")))
    )


def envelopes_with_progress(user, ref: date | None = None):
    ref = ref or timezone.now().date()
    envelopes = list(BudgetEnvelope.objects.filter(user=user, is_active=True))
    out = []
    if not envelopes:
        return out
    period_start, next_period_start = _period_bounds(ref)
    pairs = list(_outflow_spend_by_pair(user, period_start, next_period_start))
    for env in envelopes:
        cat = env.category
        cat_lower = cat.lower()
        spent = sum(
            (
                row["spend"]
                for row in pairs
                if row["category__slug"] == cat or row["raw_cat"] == cat_lower
            ),
            Decimal("0"),
        )
        out.append(
            {
                "id": env.id,
                "category": env.category,
                "label": env.label,
                "monthly_target": env.monthly_target,
                "spent_this_period": spent,
                "currency": env.currency,
            }
        )
    return out


def _aggregate_period(user, period_start: date) -> PeriodSummary:
    _, next_period_start = _period_bounds(period_start)
    transactions = Transaction.objects.filter(
        user=user,
        posted_at__gte=period_start,
        posted_at__lt=next_period_start,
    )

    totals = transactions.aggregate(
        income=Coalesce(Sum("amount", filter=Q(amount__gt=0)), _ZERO_DEC),
        spent=Coalesce(Sum(-F("amount"), filter=Q(amount__lt=0)), _ZERO_DEC),
    )
    total_income: Decimal = totals["income"]
    total_spent: Decimal = totals["spent"]

    # Dominant non-empty currency for the period (the old Python loop took
    # whichever row iterated last — arbitrary for mixed-currency users).
    currency_row = (
        transactions.exclude(currency="")
        .values("currency")
        .annotate(n=Count("id"))
        .order_by("-n", "currency")
        .first()
    )
    currency = currency_row["currency"] if currency_row else "USD"

    # Spend per category: slug when categorised, else lowercased raw provider
    # category, else "other" — same key the envelopes are matched on.
    cat_rows = (
        transactions.filter(amount__lt=0)
        .annotate(
            cat=Coalesce(
                "category__slug",
                NullIf(Lower("provider_category_raw"), Value("")),
                Value("other"),
            )
        )
        .values("cat")
        .annotate(spend=Sum(-F("amount")))
        .order_by("-spend", "cat")
    )

    envelopes = {
        env.category: env for env in BudgetEnvelope.objects.filter(user=user, is_active=True)
    }
    rows: List[CategoryRow] = []
    for row in cat_rows:
        slug = row["cat"]
        spent = row["spend"]
        env = envelopes.get(slug)
        rows.append(
            CategoryRow(
                category=slug,
                label=(env.label if env else slug.replace("_", " ").title()),
                spent=spent,
                target=(env.monthly_target if env else None),
                over_budget=bool(env and spent > env.monthly_target),
            )
        )
    return PeriodSummary(
        period_start=period_start,
        currency=currency,
        total_income=total_income,
        total_spent=total_spent,
        net_cash_flow=total_income - total_spent,
        by_category=rows,
    )


def get_or_compute_summary(user, ref: date | None = None) -> PeriodSummary:
    """Return the cached :class:`BudgetPeriodSummary` for the period of ``ref``.

    If no summary exists or it is stale (older than 1 hour) we recompute and
    persist a fresh row. Callers that need real-time data should call
    :func:`recompute_summary` directly.
    """

    ref = ref or timezone.now().date()
    period_start = month_start(ref)
    existing = (
        BudgetPeriodSummary.objects.filter(user=user, period_start=period_start)
        .order_by("-computed_at")
        .first()
    )
    if existing and existing.computed_at >= timezone.now() - timedelta(hours=1):
        rows = [
            CategoryRow(**row) if isinstance(row, dict) else row
            for row in existing.by_category.get("rows", [])
        ]
        return PeriodSummary(
            period_start=existing.period_start,
            currency=existing.currency,
            total_income=existing.total_income,
            total_spent=existing.total_spent,
            net_cash_flow=existing.net_cash_flow,
            by_category=rows,
        )
    return recompute_summary(user, ref=ref)


def recompute_summary(user, ref: date | None = None) -> PeriodSummary:
    ref = ref or timezone.now().date()
    period_start = month_start(ref)
    summary = _aggregate_period(user, period_start)
    BudgetPeriodSummary.objects.update_or_create(
        user=user,
        period_start=period_start,
        defaults={
            "currency": summary.currency,
            "total_income": summary.total_income,
            "total_spent": summary.total_spent,
            "net_cash_flow": summary.net_cash_flow,
            "by_category": {
                "rows": [
                    {
                        "category": r.category,
                        "label": r.label,
                        "spent": float(r.spent),
                        "target": float(r.target) if r.target is not None else None,
                        "over_budget": r.over_budget,
                    }
                    for r in summary.by_category
                ],
            },
        },
    )
    detect_anomalies(user, summary)
    # Fresh spending data changes the CFO dashboard payload — drop its cache.
    # Local import: dashboard.py imports this module at load time.
    from budgeting.services.dashboard import invalidate_cfo_dashboard_cache

    invalidate_cfo_dashboard_cache(user.id)
    return summary


def detect_anomalies(user, summary: PeriodSummary) -> Iterable[SpendingAnomaly]:
    """Create new ``SpendingAnomaly`` rows for clear overspends in ``summary``."""

    created: List[SpendingAnomaly] = []
    for row in summary.by_category:
        if not row.over_budget or row.target is None:
            continue
        already = SpendingAnomaly.objects.filter(
            user=user,
            kind=SpendingAnomaly.Kind.OVER_BUDGET,
            category=row.category,
            detected_for=summary.period_start,
            resolved_at__isnull=True,
        ).exists()
        if already:
            continue
        anomaly = SpendingAnomaly.objects.create(
            user=user,
            kind=SpendingAnomaly.Kind.OVER_BUDGET,
            severity="warning",
            category=row.category,
            summary=f"Over budget on {row.label}",
            detail=f"Spent {row.spent} vs target {row.target}",
            detected_for=summary.period_start,
            metadata={
                "spent": float(row.spent),
                "target": float(row.target),
            },
        )
        created.append(anomaly)
    return created

"""Compute monthly spending summaries and envelope status for a user."""

from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass
from datetime import date, timedelta
from decimal import Decimal
from typing import Dict, Iterable, List, Optional

from django.db.models import Q
from django.utils import timezone

from budgeting.models import (
    BudgetEnvelope,
    BudgetPeriodSummary,
    SpendingAnomaly,
    Transaction,
)


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


def envelope_spent_this_period(user, env: BudgetEnvelope, ref: date) -> Decimal:
    period_start = month_start(ref)
    next_period_start = (period_start + timedelta(days=32)).replace(day=1)
    qs = Transaction.objects.filter(
        user=user,
        posted_at__gte=period_start,
        posted_at__lt=next_period_start,
        amount__lt=0,
    ).filter(Q(category__slug=env.category) | Q(provider_category_raw__iexact=env.category))
    total = Decimal("0")
    for tx in qs.iterator():
        total += -tx.amount  # convert outflow to positive spend
    return total


def envelopes_with_progress(user, ref: date | None = None):
    ref = ref or timezone.now().date()
    envelopes = BudgetEnvelope.objects.filter(user=user, is_active=True)
    out = []
    for env in envelopes:
        spent = envelope_spent_this_period(user, env, ref)
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
    next_period_start = (period_start + timedelta(days=32)).replace(day=1)
    transactions = Transaction.objects.filter(
        user=user,
        posted_at__gte=period_start,
        posted_at__lt=next_period_start,
    )
    total_income = Decimal("0")
    total_spent = Decimal("0")
    by_cat: Dict[str, Decimal] = defaultdict(Decimal)
    currency = "USD"
    for tx in transactions.iterator():
        currency = tx.currency or currency
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

    envelopes = {
        env.category: env for env in BudgetEnvelope.objects.filter(user=user, is_active=True)
    }
    rows: List[CategoryRow] = []
    for slug, spent in sorted(by_cat.items(), key=lambda x: -x[1]):
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

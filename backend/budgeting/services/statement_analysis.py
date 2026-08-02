"""
Deterministic analysis of a parsed statement.

Everything here is computed locally from the parsed rows — no LLM call, no
network. The output is what the Statement Import tool renders, and the
category totals are the only thing ever handed to the AI layer.
"""

from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass
from datetime import date
from decimal import Decimal
from typing import Dict, List, Optional, Sequence

from budgeting.services.categorization import (
    TRANSFER_CATEGORIES,
    categorize,
    display_merchant,
    label_for,
    normalise_merchant,
)
from budgeting.services.statements import ParsedRow

ZERO = Decimal("0")

# A merchant seen this many times with a stable amount is treated as recurring.
RECURRING_MIN_HITS = 2
RECURRING_AMOUNT_TOLERANCE = Decimal("0.15")  # ±15%
TOP_N = 8


@dataclass
class ClassifiedRow:
    row: ParsedRow
    category: str
    merchant_key: str
    merchant_label: str


def classify_rows(rows: Sequence[ParsedRow]) -> List[ClassifiedRow]:
    """Attach a category and a normalised merchant to every parsed row."""
    out: List[ClassifiedRow] = []
    for row in rows:
        category = categorize(row.description, row.amount, row.raw_category)
        key = normalise_merchant(row.description) or row.description.lower()[:64]
        out.append(
            ClassifiedRow(
                row=row,
                category=category,
                merchant_key=key,
                merchant_label=display_merchant(row.description),
            )
        )
    return out


def _q(value: Decimal) -> float:
    return float(round(value, 2))


def _detect_recurring(classified: Sequence[ClassifiedRow]) -> List[Dict]:
    """Find likely subscriptions and standing costs.

    A merchant qualifies when it appears at least ``RECURRING_MIN_HITS`` times
    as an outflow with amounts clustered within
    ``RECURRING_AMOUNT_TOLERANCE`` of the median.
    """
    by_merchant: Dict[str, List[ClassifiedRow]] = defaultdict(list)
    for item in classified:
        if item.row.amount < 0 and item.merchant_key:
            by_merchant[item.merchant_key].append(item)

    recurring: List[Dict] = []
    for key, items in by_merchant.items():
        if len(items) < RECURRING_MIN_HITS:
            continue
        amounts = sorted(abs(i.row.amount) for i in items)
        median = amounts[len(amounts) // 2]
        if median <= 0:
            continue
        stable = [a for a in amounts if abs(a - median) <= median * RECURRING_AMOUNT_TOLERANCE]
        if len(stable) < RECURRING_MIN_HITS:
            continue
        months = {(i.row.posted_at.year, i.row.posted_at.month) for i in items}
        recurring.append(
            {
                "merchant": items[0].merchant_label,
                "category": items[0].category,
                "category_label": label_for(items[0].category),
                "occurrences": len(items),
                "months_seen": len(months),
                "typical_amount": _q(median),
                "total": _q(sum(abs(i.row.amount) for i in items)),
                "last_seen": max(i.row.posted_at for i in items).isoformat(),
            }
        )
    recurring.sort(key=lambda r: r["total"], reverse=True)
    return recurring[:TOP_N]


def _monthly_series(classified: Sequence[ClassifiedRow]) -> List[Dict]:
    buckets: Dict[date, Dict[str, Decimal]] = defaultdict(lambda: {"income": ZERO, "spent": ZERO})
    for item in classified:
        month = item.row.posted_at.replace(day=1)
        if item.row.amount > 0:
            buckets[month]["income"] += item.row.amount
        else:
            buckets[month]["spent"] += -item.row.amount
    return [
        {
            "month": month.isoformat(),
            "income": _q(vals["income"]),
            "spent": _q(vals["spent"]),
            "net": _q(vals["income"] - vals["spent"]),
        }
        for month, vals in sorted(buckets.items())
    ]


def _build_insights(
    *,
    currency: str,
    total_spent: Decimal,
    total_income: Decimal,
    categories: Sequence[Dict],
    recurring: Sequence[Dict],
    days_covered: int,
    largest: Sequence[Dict],
) -> List[Dict]:
    """Plain-language findings. Deterministic on purpose — these are facts,
    not opinions, and they must be identical every time the same file is
    uploaded."""
    insights: List[Dict] = []
    cur = currency or ""

    if total_income > 0:
        net = total_income - total_spent
        rate = (net / total_income * 100) if total_income else ZERO
        insights.append(
            {
                "kind": "savings_rate" if net >= 0 else "overspend",
                "tone": "positive" if net >= 0 else "warning",
                "title": (
                    f"You kept {_q(net)} {cur} of {_q(total_income)} {cur} in"
                    if net >= 0
                    else f"You spent {_q(-net)} {cur} more than you earned"
                ),
                "detail": (
                    f"That's a {rate:.0f}% savings rate over this statement."
                    if net >= 0
                    else "Over this period your outgoings were larger than your income."
                ),
            }
        )

    spend_categories = [c for c in categories if c["category"] not in TRANSFER_CATEGORIES]
    if spend_categories:
        top = spend_categories[0]
        insights.append(
            {
                "kind": "top_category",
                "tone": "neutral",
                "title": f"{top['label']} is your biggest spend at {top['spent']} {cur}",
                "detail": f"That's {top['share']:.0f}% of everything you spent.",
            }
        )

    if recurring:
        monthly = sum(Decimal(str(r["typical_amount"])) for r in recurring)
        insights.append(
            {
                "kind": "recurring",
                "tone": "neutral",
                "title": f"{len(recurring)} recurring payments worth about {_q(monthly)} {cur}",
                "detail": "Subscriptions and standing costs are the easiest thing to cut.",
            }
        )

    if days_covered >= 7 and total_spent > 0:
        daily = total_spent / Decimal(days_covered)
        insights.append(
            {
                "kind": "run_rate",
                "tone": "neutral",
                "title": f"About {_q(daily)} {cur} a day",
                "detail": f"At this rate a full month costs roughly {_q(daily * 30)} {cur}.",
            }
        )

    if largest:
        biggest = largest[0]
        if total_spent > 0 and Decimal(str(biggest["amount"])) > total_spent * Decimal("0.2"):
            insights.append(
                {
                    "kind": "large_transaction",
                    "tone": "warning",
                    "title": f"One payment was {biggest['amount']} {cur}",
                    "detail": (
                        f"{biggest['merchant']} on {biggest['date']} is over a fifth "
                        "of everything you spent."
                    ),
                }
            )

    gambling = next((c for c in categories if c["category"] == "gambling"), None)
    if gambling:
        insights.append(
            {
                "kind": "gambling",
                "tone": "warning",
                "title": f"{gambling['spent']} {cur} went to gambling",
                "detail": "Worth a look if that wasn't deliberate.",
            }
        )

    return insights


def analyze(rows: Sequence[ParsedRow], currency: str = "") -> Dict:
    """Build the full analysis payload for a parsed statement."""
    classified = classify_rows(rows)
    if not classified:
        return {}

    total_income = sum((r.row.amount for r in classified if r.row.amount > 0), ZERO)
    total_spent = sum((-r.row.amount for r in classified if r.row.amount < 0), ZERO)

    # Category breakdown (outflows only — income has its own total).
    per_category: Dict[str, Decimal] = defaultdict(lambda: ZERO)
    counts: Dict[str, int] = defaultdict(int)
    for item in classified:
        if item.row.amount < 0:
            per_category[item.category] += -item.row.amount
            counts[item.category] += 1
    categories = [
        {
            "category": slug,
            "label": label_for(slug),
            "spent": _q(amount),
            "count": counts[slug],
            "share": float(round(amount / total_spent * 100, 1)) if total_spent else 0.0,
        }
        for slug, amount in sorted(per_category.items(), key=lambda kv: kv[1], reverse=True)
    ]

    # Top merchants by outflow.
    per_merchant: Dict[str, Dict] = {}
    for item in classified:
        if item.row.amount >= 0 or not item.merchant_key:
            continue
        entry = per_merchant.setdefault(
            item.merchant_key,
            {
                "merchant": item.merchant_label,
                "category": item.category,
                "category_label": label_for(item.category),
                "spent": ZERO,
                "count": 0,
            },
        )
        entry["spent"] += -item.row.amount
        entry["count"] += 1
    merchants = sorted(per_merchant.values(), key=lambda m: m["spent"], reverse=True)[:TOP_N]
    for entry in merchants:
        entry["spent"] = _q(entry["spent"])

    largest = [
        {
            "date": item.row.posted_at.isoformat(),
            "merchant": item.merchant_label or item.row.description,
            "amount": _q(-item.row.amount),
            "category": item.category,
            "category_label": label_for(item.category),
        }
        for item in sorted((c for c in classified if c.row.amount < 0), key=lambda c: c.row.amount)[
            :TOP_N
        ]
    ]

    recurring = _detect_recurring(classified)
    months = _monthly_series(classified)

    period_start = min(c.row.posted_at for c in classified)
    period_end = max(c.row.posted_at for c in classified)
    days_covered = (period_end - period_start).days + 1

    return {
        "currency": currency,
        "period_start": period_start.isoformat(),
        "period_end": period_end.isoformat(),
        "days_covered": days_covered,
        "transaction_count": len(classified),
        "totals": {
            "income": _q(total_income),
            "spent": _q(total_spent),
            "net": _q(total_income - total_spent),
        },
        "categories": categories,
        "top_merchants": merchants,
        "largest_transactions": largest,
        "recurring": recurring,
        "monthly": months,
        "insights": _build_insights(
            currency=currency,
            total_spent=total_spent,
            total_income=total_income,
            categories=categories,
            recurring=recurring,
            days_covered=days_covered,
            largest=largest,
        ),
    }


def sample_rows(rows: Sequence[ParsedRow], limit: int = 12) -> List[Dict]:
    """A short preview of what we parsed, so the user can sanity-check signs
    and dates before committing anything."""
    classified = classify_rows(rows[:limit])
    return [
        {
            "date": item.row.posted_at.isoformat(),
            "description": item.row.description,
            "merchant": item.merchant_label,
            "amount": _q(item.row.amount),
            "currency": item.row.currency,
            "category": item.category,
            "category_label": label_for(item.category),
        }
        for item in classified
    ]


def redacted_context_for_ai(analysis: Dict, limit: int = 8) -> Optional[Dict]:
    """Category totals only — the sole shape allowed to reach the AI layer.

    Merchant names and transaction descriptions are deliberately absent.
    """
    if not analysis:
        return None
    return {
        "currency": analysis.get("currency", ""),
        "period_start": analysis.get("period_start"),
        "period_end": analysis.get("period_end"),
        "totals": analysis.get("totals", {}),
        "categories": [
            {"label": row["label"], "spent": row["spent"], "share": row["share"]}
            for row in analysis.get("categories", [])[:limit]
        ],
        "recurring_count": len(analysis.get("recurring", [])),
    }

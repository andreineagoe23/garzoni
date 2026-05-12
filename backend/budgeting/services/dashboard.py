"""Personal CFO dashboard aggregation.

Builds the cross-domain dashboard payload consumed by the web and mobile
"Personal CFO" surfaces. Pulls portfolio holdings, financial goals, spending
summary, and computes derived metrics (net worth, savings rate, projections,
diversification score). Optionally calls into an LLM for a synthesized
narrative — but always falls back to deterministic prose so the endpoint is
useful even when AI is degraded or budget-exhausted.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import date
from decimal import Decimal
from typing import Any, Dict, List, Optional

from django.conf import settings
from django.utils import timezone

from authentication.entitlements import get_user_plan
from budgeting.models import LinkedAccount
from budgeting.services.summaries import PeriodSummary, get_or_compute_summary
from finance.models import FinancialGoal, PortfolioEntry

logger = logging.getLogger(__name__)

# Three named scenarios used across the projections card.
PROJECTION_SCENARIOS = (
    ("conservative", Decimal("0.04")),
    ("moderate", Decimal("0.07")),
    ("optimistic", Decimal("0.10")),
)

PROJECTION_HORIZONS_YEARS = (1, 3, 5, 10)


@dataclass
class DashboardContext:
    """Lightweight bundle passed to the AI prompt builder."""

    net_worth: Decimal
    savings_rate: Optional[float]
    risk_score: int
    goal_count: int
    on_track_goals: int
    real_holdings_count: int
    monthly_contribution: Decimal
    currency: str


def _to_float(value: Optional[Decimal | float | int]) -> float:
    if value is None:
        return 0.0
    try:
        return float(value)
    except (TypeError, ValueError):
        return 0.0


def _decimal(value: Optional[Decimal | float | int]) -> Decimal:
    if value is None:
        return Decimal("0")
    if isinstance(value, Decimal):
        return value
    try:
        return Decimal(str(value))
    except Exception:
        return Decimal("0")


def _portfolio_block(user) -> Dict[str, Any]:
    """Aggregate the user's real portfolio holdings.

    Paper-trade rows are intentionally excluded from net worth/dashboard
    metrics — they belong to the learning simulator, not the user's real
    financial picture.
    """

    entries = list(
        PortfolioEntry.objects.filter(user=user, is_paper_trade=False).order_by("-purchase_date")
    )
    total_value = Decimal("0")
    total_cost = Decimal("0")
    allocation: Dict[str, Decimal] = {}
    holdings: List[Dict[str, Any]] = []
    for entry in entries:
        price = entry.current_price or entry.purchase_price or Decimal("0")
        value = (entry.quantity or Decimal("0")) * price
        cost = (entry.quantity or Decimal("0")) * (entry.purchase_price or price)
        total_value += value
        total_cost += cost
        allocation[entry.asset_type] = allocation.get(entry.asset_type, Decimal("0")) + value
        holdings.append(
            {
                "symbol": entry.symbol,
                "asset_type": entry.asset_type,
                "quantity": _to_float(entry.quantity),
                "purchase_price": _to_float(entry.purchase_price),
                "current_price": _to_float(price),
                "value": _to_float(value),
                "gain_loss": _to_float(value - cost),
                "gain_loss_pct": (_to_float((value - cost) / cost * 100) if cost > 0 else 0.0),
                "purchase_date": entry.purchase_date.isoformat() if entry.purchase_date else None,
            }
        )
    holdings.sort(key=lambda h: h["value"], reverse=True)
    top_holdings = holdings[:5]

    # Herfindahl-style concentration → diversification score (0 best, 100 worst → invert).
    hhi = Decimal("0")
    if total_value > 0:
        for amount in allocation.values():
            share = amount / total_value
            hhi += share * share
    # Risk score: 100 = perfectly diversified, 0 = single asset.
    risk_score = int(round(float((Decimal("1") - hhi) * Decimal("100"))))
    risk_score = max(0, min(100, risk_score))

    allocation_rows = [
        {
            "asset_type": key,
            "value": _to_float(amount),
            "share_pct": (_to_float(amount / total_value * 100) if total_value > 0 else 0.0),
        }
        for key, amount in sorted(allocation.items(), key=lambda x: -x[1])
    ]

    return {
        "total_value": _to_float(total_value),
        "total_cost": _to_float(total_cost),
        "total_gain_loss": _to_float(total_value - total_cost),
        "total_gain_loss_pct": (
            _to_float((total_value - total_cost) / total_cost * 100) if total_cost > 0 else 0.0
        ),
        "holdings_count": len(holdings),
        "risk_score": risk_score,
        "diversification": (
            "well_diversified"
            if risk_score >= 70
            else "moderately_diversified" if risk_score >= 40 else "concentrated"
        ),
        "allocation": allocation_rows,
        "top_holdings": top_holdings,
    }


def _goals_block(user, monthly_contribution: Decimal) -> Dict[str, Any]:
    goals_qs = FinancialGoal.objects.filter(user=user).order_by("deadline")
    goals: List[Dict[str, Any]] = []
    today = timezone.now().date()
    on_track = 0
    for goal in goals_qs:
        target = _decimal(goal.target_amount)
        current = _decimal(goal.current_amount)
        progress = _to_float(goal.progress_percentage())
        remaining = max(target - current, Decimal("0"))
        months_required: Optional[int] = None
        projected_date: Optional[str] = None
        on_track_flag: Optional[bool] = None
        if remaining > 0 and monthly_contribution > 0:
            months = float(remaining) / float(monthly_contribution)
            months_required = max(1, int(round(months)))
            year = today.year + (today.month - 1 + months_required) // 12
            month = (today.month - 1 + months_required) % 12 + 1
            projected_date = f"{year:04d}-{month:02d}"
            if goal.deadline:
                deadline_months = max(
                    (goal.deadline.year - today.year) * 12 + (goal.deadline.month - today.month),
                    0,
                )
                on_track_flag = months_required <= deadline_months + 1
        elif remaining == 0:
            on_track_flag = True
            projected_date = today.isoformat()[:7]
        if on_track_flag:
            on_track += 1
        goals.append(
            {
                "id": goal.id,
                "name": goal.goal_name,
                "target": _to_float(target),
                "current": _to_float(current),
                "progress_pct": progress,
                "remaining": _to_float(remaining),
                "deadline": goal.deadline.isoformat() if goal.deadline else None,
                "projected_date": projected_date,
                "months_required": months_required,
                "on_track": on_track_flag,
            }
        )
    return {"goals": goals, "on_track_count": on_track}


def _spending_block(
    spending: Optional[PeriodSummary],
) -> Dict[str, Any]:
    if spending is None:
        return {
            "available": False,
            "currency": "USD",
            "income": 0.0,
            "spent": 0.0,
            "net_cash_flow": 0.0,
            "savings_rate_pct": None,
            "by_category": [],
        }
    income = _to_float(spending.total_income)
    spent = _to_float(spending.total_spent)
    cash_flow = _to_float(spending.net_cash_flow)
    savings_rate = (cash_flow / income * 100) if income > 0 else None
    return {
        "available": True,
        "currency": spending.currency,
        "period_start": spending.period_start.isoformat(),
        "income": income,
        "spent": spent,
        "net_cash_flow": cash_flow,
        "savings_rate_pct": savings_rate,
        "by_category": [
            {
                "category": row.category,
                "label": row.label,
                "spent": _to_float(row.spent),
                "target": _to_float(row.target) if row.target is not None else None,
                "over_budget": row.over_budget,
            }
            for row in spending.by_category[:10]
        ],
    }


def _project_future_value(
    principal: Decimal, monthly_contribution: Decimal, annual_rate: Decimal, years: int
) -> Decimal:
    """Compound growth + monthly contribution annuity, both end-of-month."""

    months = years * 12
    if months <= 0:
        return principal
    monthly_rate = annual_rate / Decimal("12")
    if monthly_rate == 0:
        return principal + monthly_contribution * months
    growth_factor = (Decimal("1") + monthly_rate) ** months
    fv_principal = principal * growth_factor
    fv_contrib = monthly_contribution * ((growth_factor - Decimal("1")) / monthly_rate)
    return fv_principal + fv_contrib


def _projections_block(starting_balance: Decimal, monthly_contribution: Decimal) -> Dict[str, Any]:
    scenarios: List[Dict[str, Any]] = []
    for label, rate in PROJECTION_SCENARIOS:
        horizons = []
        for years in PROJECTION_HORIZONS_YEARS:
            fv = _project_future_value(starting_balance, monthly_contribution, rate, years)
            horizons.append(
                {
                    "years": years,
                    "value": _to_float(fv),
                    "gain": _to_float(fv - starting_balance - monthly_contribution * years * 12),
                }
            )
        scenarios.append(
            {
                "name": label,
                "annual_rate_pct": _to_float(rate * Decimal("100")),
                "horizons": horizons,
            }
        )
    timeline: List[Dict[str, Any]] = []
    for year in range(0, 11):
        row: Dict[str, Any] = {"year": year}
        for label, rate in PROJECTION_SCENARIOS:
            fv = _project_future_value(starting_balance, monthly_contribution, rate, year)
            row[label] = _to_float(fv)
        timeline.append(row)
    return {
        "starting_balance": _to_float(starting_balance),
        "monthly_contribution": _to_float(monthly_contribution),
        "scenarios": scenarios,
        "timeline": timeline,
    }


def _net_worth_block(portfolio_value: Decimal, currency: str, user) -> Dict[str, Any]:
    """Sum of real portfolio + any cash balances we track. Linked-account
    balances are *not* stored on the LinkedAccount model today, so we fall back
    to portfolio value alone but expose a breakdown shape that the UI can
    consume regardless."""

    breakdown = [
        {
            "label": "Investments",
            "value": _to_float(portfolio_value),
            "kind": "portfolio",
        },
    ]
    has_linked = LinkedAccount.objects.filter(
        user=user, status=LinkedAccount.Status.ACTIVE
    ).exists()
    return {
        "total": _to_float(portfolio_value),
        "currency": currency,
        "breakdown": breakdown,
        "linked_accounts_available": has_linked,
    }


def _build_narrative(ctx: DashboardContext, surface: str = "web") -> str:
    """Deterministic, encouraging narrative used as both the fallback for the
    AI block and a stable seed for the AI prompt."""

    pieces: List[str] = []
    nw = ctx.net_worth
    if nw > 0:
        pieces.append(
            f"Your tracked net worth is {nw:,.0f} {ctx.currency}, "
            f"powered by {ctx.real_holdings_count} real holding(s)."
        )
    else:
        pieces.append(
            "We don't see any real holdings yet — start by tracking what you already "
            "own from the Market Explorer to unlock projections."
        )
    if ctx.savings_rate is not None:
        if ctx.savings_rate >= 20:
            pieces.append(
                f"Your savings rate of {ctx.savings_rate:.0f}% is excellent — "
                "you're banking more than most peers."
            )
        elif ctx.savings_rate > 0:
            pieces.append(
                f"You're saving about {ctx.savings_rate:.0f}% of income this month. "
                "Lifting that toward 20% would meaningfully accelerate your goals."
            )
        else:
            pieces.append(
                "Spending is running ahead of income this month. Review your "
                "biggest categories in the Budget Planner before locking in any new goals."
            )
    if ctx.goal_count:
        pieces.append(
            f"{ctx.on_track_goals} of {ctx.goal_count} goal(s) look on track at your "
            f"current contribution pace ({ctx.monthly_contribution:,.0f} "
            f"{ctx.currency}/mo)."
        )
    if ctx.real_holdings_count > 0:
        if ctx.risk_score >= 70:
            pieces.append(
                f"Your portfolio diversification score is {ctx.risk_score}/100 — "
                "well spread across asset types."
            )
        elif ctx.risk_score >= 40:
            pieces.append(
                f"Diversification score: {ctx.risk_score}/100. Consider mixing in a "
                "second asset class to reduce concentration risk."
            )
        else:
            pieces.append(
                f"Diversification score: {ctx.risk_score}/100. You are highly "
                "concentrated — a single bad month could swing your net worth."
            )
    if not pieces:
        pieces.append(
            "Add a goal, link an account or track a real holding to unlock your CFO insights."
        )
    return " ".join(pieces)


def _maybe_ai_narrative(user, ctx: DashboardContext, surface: str) -> Dict[str, Any]:
    """Run the OpenAI client if we have an API key + the user has plan access.

    Returns ``{ "text": str, "source": "ai" | "fallback" }``. Failures are
    swallowed silently — we always have the deterministic narrative as a
    backstop. The caller decides whether to consume entitlement quota."""

    fallback = _build_narrative(ctx, surface=surface)
    if not getattr(settings, "OPENAI_API_KEY", ""):
        return {"text": fallback, "source": "fallback"}
    if get_user_plan(user) not in ("plus", "pro"):
        return {"text": fallback, "source": "fallback"}
    try:
        from openai import OpenAI

        client = OpenAI(api_key=settings.OPENAI_API_KEY)
        system = (
            "You are the user's Personal CFO. Write a concise, supportive paragraph "
            "(120-180 words) that synthesizes their net worth, savings rate, goals "
            "and portfolio diversification into one personalized take. Be specific, "
            "use the numbers provided, and end with the single most useful next step. "
            "Do not invent figures that are not in the context. Do not give regulated "
            "investment advice — frame it as coaching, not recommendations."
        )
        context_lines = [
            f"net_worth={ctx.net_worth:.2f} {ctx.currency}",
            f"monthly_contribution={ctx.monthly_contribution:.2f} {ctx.currency}",
            f"savings_rate_pct={ctx.savings_rate}",
            f"goal_count={ctx.goal_count}",
            f"goals_on_track={ctx.on_track_goals}",
            f"real_holdings_count={ctx.real_holdings_count}",
            f"diversification_score={ctx.risk_score}",
        ]
        user_msg = "Stats:\n" + "\n".join(context_lines)
        resp = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": system},
                {"role": "user", "content": user_msg},
            ],
            temperature=0.4,
            max_tokens=320,
        )
        text = (resp.choices[0].message.content or "").strip()
        if not text:
            return {"text": fallback, "source": "fallback"}
        return {"text": text, "source": "ai"}
    except Exception as exc:  # pragma: no cover - external dependency
        logger.warning("cfo_dashboard_ai_failed user=%s err=%s", user.id, exc)
        return {"text": fallback, "source": "fallback"}


def build_dashboard(user, surface: str = "web") -> Dict[str, Any]:
    """Build the full CFO dashboard payload for the given user."""

    today = timezone.now().date()
    try:
        spending = get_or_compute_summary(user, ref=today)
    except Exception as exc:  # pragma: no cover - defensive
        logger.warning("cfo_dashboard_spending_failed user=%s err=%s", user.id, exc)
        spending = None

    portfolio = _portfolio_block(user)
    portfolio_value = _decimal(portfolio["total_value"])
    spending_block = _spending_block(spending)

    monthly_contribution = Decimal("0")
    if spending and spending.net_cash_flow > 0:
        monthly_contribution = _decimal(spending.net_cash_flow)

    goals_block = _goals_block(user, monthly_contribution)
    currency = spending_block.get("currency") or "USD"
    net_worth = _net_worth_block(portfolio_value, currency, user)

    projections = _projections_block(portfolio_value, monthly_contribution)

    ctx = DashboardContext(
        net_worth=portfolio_value,
        savings_rate=spending_block.get("savings_rate_pct"),
        risk_score=portfolio["risk_score"],
        goal_count=len(goals_block["goals"]),
        on_track_goals=goals_block["on_track_count"],
        real_holdings_count=portfolio["holdings_count"],
        monthly_contribution=monthly_contribution,
        currency=currency,
    )
    ai_block = _maybe_ai_narrative(user, ctx, surface=surface)

    return {
        "generated_at": timezone.now().isoformat(),
        "currency": currency,
        "net_worth": net_worth,
        "portfolio": portfolio,
        "goals": goals_block["goals"],
        "goals_summary": {
            "total": len(goals_block["goals"]),
            "on_track": goals_block["on_track_count"],
        },
        "spending": spending_block,
        "projections": projections,
        "ai_analysis": ai_block,
        "context": {
            "monthly_contribution": _to_float(monthly_contribution),
            "real_holdings_count": portfolio["holdings_count"],
            "risk_score": portfolio["risk_score"],
        },
    }


def build_dashboard_context(user) -> DashboardContext:
    """Lightweight helper used by the AI coach to build prompts without
    re-running the entire dashboard pipeline."""

    try:
        spending = get_or_compute_summary(user, ref=timezone.now().date())
    except Exception:
        spending = None
    portfolio = _portfolio_block(user)
    portfolio_value = _decimal(portfolio["total_value"])
    spending_block = _spending_block(spending)
    monthly_contribution = (
        _decimal(spending.net_cash_flow)
        if spending and spending.net_cash_flow > 0
        else Decimal("0")
    )
    goals_block = _goals_block(user, monthly_contribution)
    return DashboardContext(
        net_worth=portfolio_value,
        savings_rate=spending_block.get("savings_rate_pct"),
        risk_score=portfolio["risk_score"],
        goal_count=len(goals_block["goals"]),
        on_track_goals=goals_block["on_track_count"],
        real_holdings_count=portfolio["holdings_count"],
        monthly_contribution=monthly_contribution,
        currency=spending_block.get("currency") or "USD",
    )

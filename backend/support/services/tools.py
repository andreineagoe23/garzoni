"""
OpenAI function-calling tool definitions and their server-side dispatch.
Each tool returns a plain dict that gets serialised as the tool_result content.
"""

from __future__ import annotations

import json
import logging
from typing import Any, Dict, List, Optional

from django.contrib.auth.models import User

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Tool schemas (passed to the OpenAI API as `tools=`)
# ---------------------------------------------------------------------------

TOOL_DEFINITIONS: List[Dict] = [
    {
        "type": "function",
        "function": {
            "name": "get_user_progress",
            "description": (
                "Retrieve the student's current learning progress: streak, completed courses, "
                "currently active course, and completion percentage."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "course_id": {
                        "type": "integer",
                        "description": "Optional. Limit progress to a specific course.",
                    }
                },
                "required": [],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_weak_skills",
            "description": (
                "Return the student's weakest skills by proficiency score so you can "
                "suggest targeted practice."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "limit": {
                        "type": "integer",
                        "description": "Number of weak skills to return (default 5).",
                    }
                },
                "required": [],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_financial_profile",
            "description": (
                "Retrieve the student's financial profile: goals, risk comfort, income range, "
                "investing experience, savings rate."
            ),
            "parameters": {"type": "object", "properties": {}, "required": []},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "recommend_next_lesson",
            "description": (
                "Find the single best next lesson for the student to do right now, "
                "considering their path, mastery gaps, and completion history."
            ),
            "parameters": {"type": "object", "properties": {}, "required": []},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "generate_practice_question",
            "description": (
                "Generate one fresh practice question for a given skill and difficulty. "
                "Returns question text, answer choices, correct answer, and a brief explanation."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "skill": {
                        "type": "string",
                        "description": "The skill or topic to generate a question about.",
                    },
                    "difficulty": {
                        "type": "integer",
                        "description": "Difficulty 1 (easy) to 5 (hard).",
                    },
                },
                "required": ["skill", "difficulty"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "lookup_lesson",
            "description": (
                "Semantic search over Garzoni's lesson library. Use this when a student asks "
                "about a topic to find the most relevant lessons/courses to recommend."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "Natural-language description of the topic to find.",
                    },
                    "top_k": {
                        "type": "integer",
                        "description": "Number of results to return (default 3).",
                    },
                },
                "required": ["query"],
            },
        },
    },
]


# ---------------------------------------------------------------------------
# Dispatch: call the right DB / service function for each tool name
# ---------------------------------------------------------------------------


def dispatch_tool(tool_name: str, arguments: Dict, user: User) -> Dict:
    """
    Execute a tool call server-side. Returns a JSON-serialisable dict.
    Never raises — returns an error dict on failure so the model can handle it.
    """
    try:
        if tool_name == "get_user_progress":
            return _get_user_progress(user, arguments.get("course_id"))
        if tool_name == "get_weak_skills":
            return _get_weak_skills(user, int(arguments.get("limit", 5)))
        if tool_name == "get_financial_profile":
            return _get_financial_profile(user)
        if tool_name == "recommend_next_lesson":
            return _recommend_next_lesson(user)
        if tool_name == "generate_practice_question":
            return _generate_practice_question(
                arguments.get("skill", ""),
                int(arguments.get("difficulty", 3)),
            )
        if tool_name == "lookup_lesson":
            return _lookup_lesson(
                arguments.get("query", ""),
                int(arguments.get("top_k", 3)),
            )
        return {"error": f"Unknown tool: {tool_name}"}
    except Exception as exc:
        logger.warning("tool_dispatch_error tool=%s err=%s", tool_name, exc)
        return {"error": str(exc)}


# ---------------------------------------------------------------------------
# Tool implementations
# ---------------------------------------------------------------------------


def _get_user_progress(user: User, course_id: Optional[int] = None) -> Dict:
    from education.models import UserProgress

    try:
        profile = getattr(user, "profile", None)
        streak = getattr(profile, "streak", 0) if profile else 0

        qs = UserProgress.objects.filter(user=user).select_related("course", "course__path")
        if course_id:
            qs = qs.filter(course_id=course_id)

        completed_count = qs.filter(is_course_complete=True).count()
        active = qs.order_by("-last_course_activity_date").first()
        active_info = None
        if active and active.course:
            active_info = {
                "course": active.course.title,
                "path": active.course.path.title if active.course.path else None,
                "is_complete": active.is_course_complete,
                "last_activity": (
                    active.last_course_activity_date.isoformat()
                    if active.last_course_activity_date
                    else None
                ),
            }

        return {
            "streak_days": streak,
            "completed_courses": completed_count,
            "active_course": active_info,
        }
    except Exception as exc:
        logger.warning("get_user_progress error: %s", exc)
        return {"error": str(exc)}


def _get_weak_skills(user: User, limit: int = 5) -> Dict:
    from education.models import Mastery

    try:
        skills = list(
            Mastery.objects.filter(user=user)
            .order_by("proficiency")
            .values("skill", "proficiency")[:limit]
        )
        return {"weak_skills": skills}
    except Exception as exc:
        return {"error": str(exc)}


def _get_financial_profile(user: User) -> Dict:
    try:
        profile = getattr(user, "profile", None)
        if not profile:
            return {"error": "No profile found"}

        data: Dict[str, Any] = {}
        for field in (
            "goal_types",
            "timeframe",
            "risk_comfort",
            "income_range",
            "savings_rate_estimate",
            "investing_experience",
        ):
            val = getattr(profile, field, None)
            if val is not None:
                data[field] = val

        try:
            from onboarding.models import QuestionnaireProgress

            q = QuestionnaireProgress.objects.filter(user=user).first()
            if q and q.answers:
                data["onboarding_goals"] = q.answers.get("primary_goal")
                data["biggest_challenge"] = q.answers.get("biggest_challenge")
        except Exception:
            pass

        return data or {"note": "No financial profile data found"}
    except Exception as exc:
        return {"error": str(exc)}


def _recommend_next_lesson(user: User) -> Dict:
    from education.models import UserProgress, Mastery

    try:
        profile = getattr(user, "profile", None)
        recommended = getattr(profile, "recommended_courses", []) if profile else []

        # Find the first recommended course that isn't complete
        if recommended:
            from education.models import Course

            for course_id in recommended:
                progress = UserProgress.objects.filter(user=user, course_id=course_id).first()
                if not progress or not progress.is_course_complete:
                    try:
                        course = Course.objects.select_related("path").get(id=course_id)
                        return {
                            "course_id": course.id,
                            "course_title": course.title,
                            "path": course.path.title if course.path else None,
                            "reason": "next on your personalized path",
                        }
                    except Course.DoesNotExist:
                        continue

        # Fall back: weakest skill → find related course
        weakest = Mastery.objects.filter(user=user).order_by("proficiency").first()
        if weakest:
            return {
                "skill_to_practice": weakest.skill,
                "proficiency": weakest.proficiency,
                "reason": "weakest skill — needs the most attention",
            }

        return {"note": "No specific recommendation — keep exploring!"}
    except Exception as exc:
        return {"error": str(exc)}


def _generate_practice_question(skill: str, difficulty: int) -> Dict:
    """Generate a fresh practice question via the AI tutor service."""
    try:
        from support.prompts.tutor import PRACTICE_QUESTION_SYSTEM
        from education.services.ai_tutor import _post

        system = PRACTICE_QUESTION_SYSTEM.format(skill=skill, difficulty=difficulty)
        raw = _post(
            [
                {"role": "system", "content": system},
                {"role": "user", "content": f"Generate a practice question about {skill}."},
            ],
            temperature=0.6,
            max_tokens=400,
        )
        if raw:
            try:
                return json.loads(raw)
            except json.JSONDecodeError:
                return {"question": raw, "type": "open"}
        return {"error": "Could not generate question"}
    except Exception as exc:
        return {"error": str(exc)}


def _lookup_lesson(query: str, top_k: int = 3) -> Dict:
    """Semantic search via RAG (WS2). Falls back to title keyword match if embeddings not ready."""
    try:
        from education.services.retrieval import search as rag_search

        results = rag_search(query, top_k=top_k)
        return {"results": results}
    except ImportError:
        pass
    except Exception as exc:
        logger.debug("rag_search error: %s", exc)

    # Keyword fallback (pre-WS2)
    try:
        from education.models import Lesson

        terms = query.lower().split()[:5]
        from django.db.models import Q

        q = Q()
        for term in terms:
            q |= Q(title__icontains=term)
        lessons = list(Lesson.objects.filter(q).values("id", "title")[:top_k])
        return {"results": lessons}
    except Exception as exc:
        return {"error": str(exc)}


# ---------------------------------------------------------------------------
# CFO Coach tool definitions and dispatch
# ---------------------------------------------------------------------------

CFO_TOOL_DEFINITIONS: List[Dict] = [
    {
        "type": "function",
        "function": {
            "name": "get_net_worth",
            "description": (
                "Return the user's current tracked net worth, currency and a "
                "breakdown by source (investments, linked accounts)."
            ),
            "parameters": {"type": "object", "properties": {}, "required": []},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_portfolio_summary",
            "description": (
                "Return the user's real (non paper-trade) portfolio holdings, "
                "asset allocation by type, gain/loss and a diversification "
                "score from 0 (highly concentrated) to 100 (well diversified)."
            ),
            "parameters": {"type": "object", "properties": {}, "required": []},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_financial_goals",
            "description": (
                "List the user's financial goals with target amount, current "
                "amount, deadline (if set) and projected completion date at "
                "their current monthly savings pace."
            ),
            "parameters": {"type": "object", "properties": {}, "required": []},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_spending_summary",
            "description": (
                "Return this month's income, total spent, net cash flow, savings "
                "rate, and top spending categories with budget targets where set."
            ),
            "parameters": {"type": "object", "properties": {}, "required": []},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "run_projection",
            "description": (
                "Compute compound growth with optional monthly contributions. "
                "Use this when the user asks 'what if I invest X for Y years' or "
                "wants a quick number for a hypothetical scenario."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "starting_balance": {
                        "type": "number",
                        "description": "Current invested principal in user's currency.",
                    },
                    "monthly_contribution": {
                        "type": "number",
                        "description": "Amount added every month.",
                    },
                    "annual_rate_pct": {
                        "type": "number",
                        "description": "Expected annual return %, e.g. 7 for 7%.",
                    },
                    "years": {
                        "type": "integer",
                        "description": "Time horizon in years.",
                    },
                },
                "required": ["years"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "run_scenario",
            "description": (
                "Run a what-if scenario against the user's current numbers. "
                "Supports 'extra_savings' (model adding more per month) and "
                "'market_drop' (model a one-time portfolio drawdown)."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "kind": {
                        "type": "string",
                        "enum": ["extra_savings", "market_drop"],
                    },
                    "extra_monthly": {
                        "type": "number",
                        "description": "Extra monthly contribution for extra_savings scenarios.",
                    },
                    "drop_pct": {
                        "type": "number",
                        "description": "Portfolio drop percentage (e.g. 20 for -20%) for market_drop.",
                    },
                    "years": {
                        "type": "integer",
                        "description": "Horizon in years. Defaults to 10.",
                    },
                },
                "required": ["kind"],
            },
        },
    },
]


def dispatch_cfo_tool(tool_name: str, arguments: Dict, user) -> Dict:
    """Execute a CFO coach tool call. Never raises."""
    try:
        if tool_name == "get_net_worth":
            return _cfo_net_worth_tool(user)
        if tool_name == "get_portfolio_summary":
            return _cfo_portfolio_tool(user)
        if tool_name == "get_financial_goals":
            return _cfo_goals_tool(user)
        if tool_name == "get_spending_summary":
            return _cfo_spending_tool(user)
        if tool_name == "run_projection":
            return _cfo_projection_tool(arguments, user)
        if tool_name == "run_scenario":
            return _cfo_scenario_tool(arguments, user)
        return {"error": f"Unknown tool: {tool_name}"}
    except Exception as exc:
        logger.warning("cfo_tool_dispatch_error tool=%s err=%s", tool_name, exc)
        return {"error": str(exc)}


def _cfo_portfolio_tool(user) -> Dict:
    from decimal import Decimal
    from finance.models import PortfolioEntry

    entries = list(PortfolioEntry.objects.filter(user=user, is_paper_trade=False))
    total = Decimal("0")
    cost = Decimal("0")
    allocation: Dict[str, Decimal] = {}
    holdings: List[Dict] = []
    for e in entries:
        price = e.current_price or e.purchase_price or Decimal("0")
        value = (e.quantity or Decimal("0")) * price
        c = (e.quantity or Decimal("0")) * (e.purchase_price or price)
        total += value
        cost += c
        allocation[e.asset_type] = allocation.get(e.asset_type, Decimal("0")) + value
        holdings.append(
            {
                "symbol": e.symbol,
                "asset_type": e.asset_type,
                "value": float(value),
                "gain_loss": float(value - c),
            }
        )
    holdings.sort(key=lambda h: h["value"], reverse=True)
    hhi = Decimal("0")
    if total > 0:
        for amount in allocation.values():
            share = amount / total
            hhi += share * share
    risk = int(round(float((Decimal("1") - hhi) * Decimal("100")))) if total > 0 else 0
    risk = max(0, min(100, risk))
    return {
        "total_value": float(total),
        "total_cost": float(cost),
        "total_gain_loss": float(total - cost),
        "holdings_count": len(holdings),
        "diversification_score": risk,
        "allocation": [
            {
                "asset_type": k,
                "value": float(v),
                "share_pct": (float(v / total * 100) if total > 0 else 0.0),
            }
            for k, v in sorted(allocation.items(), key=lambda x: -x[1])
        ],
        "top_holdings": holdings[:5],
    }


def _cfo_goals_tool(user) -> Dict:
    from decimal import Decimal
    from finance.models import FinancialGoal
    from budgeting.services.dashboard import build_dashboard_context

    ctx = build_dashboard_context(user)
    out: List[Dict] = []
    for g in FinancialGoal.objects.filter(user=user).order_by("deadline"):
        target = Decimal(g.target_amount or 0)
        current = Decimal(g.current_amount or 0)
        remaining = max(target - current, Decimal("0"))
        months_required: Optional[int] = None
        if remaining > 0 and ctx.monthly_contribution > 0:
            months_required = max(1, int(round(float(remaining) / float(ctx.monthly_contribution))))
        out.append(
            {
                "id": g.id,
                "name": g.goal_name,
                "target": float(target),
                "current": float(current),
                "progress_pct": float(g.progress_percentage()),
                "deadline": g.deadline.isoformat() if g.deadline else None,
                "months_required_at_current_pace": months_required,
            }
        )
    return {
        "goals": out,
        "monthly_contribution": float(ctx.monthly_contribution),
        "currency": ctx.currency,
    }


def _cfo_spending_tool(user) -> Dict:
    from budgeting.services.dashboard import build_dashboard_context
    from budgeting.services.summaries import get_or_compute_summary
    from django.utils import timezone

    ctx = build_dashboard_context(user)
    try:
        spending = get_or_compute_summary(user, ref=timezone.now().date())
    except Exception:
        spending = None
    if spending is None:
        return {"available": False, "currency": ctx.currency}
    return {
        "available": True,
        "currency": spending.currency,
        "income": float(spending.total_income),
        "spent": float(spending.total_spent),
        "net_cash_flow": float(spending.net_cash_flow),
        "savings_rate_pct": (
            float(spending.net_cash_flow / spending.total_income * 100)
            if spending.total_income > 0
            else None
        ),
        "by_category": [
            {
                "category": r.category,
                "label": r.label,
                "spent": float(r.spent),
                "target": float(r.target) if r.target is not None else None,
                "over_budget": r.over_budget,
            }
            for r in spending.by_category[:8]
        ],
    }


def _cfo_net_worth_tool(user) -> Dict:
    from budgeting.services.dashboard import build_dashboard_context

    ctx = build_dashboard_context(user)
    return {
        "net_worth": float(ctx.net_worth),
        "currency": ctx.currency,
        "real_holdings_count": ctx.real_holdings_count,
    }


def _cfo_projection_tool(args: Dict, user) -> Dict:
    from decimal import Decimal
    from budgeting.services.dashboard import (
        build_dashboard_context,
        _project_future_value,
        PROJECTION_SCENARIOS,
    )

    ctx = build_dashboard_context(user)
    try:
        starting = Decimal(str(args.get("starting_balance", float(ctx.net_worth))))
        monthly = Decimal(str(args.get("monthly_contribution", float(ctx.monthly_contribution))))
        rate_pct = Decimal(str(args.get("annual_rate_pct", 7)))
        years = int(args.get("years", 10))
    except Exception as exc:
        return {"error": f"Invalid arguments: {exc}"}
    years = max(1, min(years, 50))
    annual_rate = rate_pct / Decimal("100")
    fv = _project_future_value(starting, monthly, annual_rate, years)
    total_contrib = monthly * years * 12
    return {
        "starting_balance": float(starting),
        "monthly_contribution": float(monthly),
        "annual_rate_pct": float(rate_pct),
        "years": years,
        "future_value": float(fv),
        "total_contributed": float(total_contrib),
        "investment_gain": float(fv - starting - total_contrib),
        "currency": ctx.currency,
    }


def _cfo_scenario_tool(args: Dict, user) -> Dict:
    from decimal import Decimal
    from budgeting.services.dashboard import (
        build_dashboard_context,
        _project_future_value,
        PROJECTION_SCENARIOS,
        PROJECTION_HORIZONS_YEARS,
    )

    ctx = build_dashboard_context(user)
    kind = args.get("kind")
    years = int(args.get("years") or 10)
    years = max(1, min(years, 30))
    out: Dict = {
        "kind": kind,
        "currency": ctx.currency,
        "years": years,
        "baseline": {},
        "scenario": {},
    }
    if kind == "extra_savings":
        extra = Decimal(str(args.get("extra_monthly", 0)))
        new_monthly = ctx.monthly_contribution + extra
        for name, rate in PROJECTION_SCENARIOS:
            out["baseline"][name] = float(
                _project_future_value(ctx.net_worth, ctx.monthly_contribution, rate, years)
            )
            out["scenario"][name] = float(
                _project_future_value(ctx.net_worth, new_monthly, rate, years)
            )
        out["extra_monthly"] = float(extra)
    elif kind == "market_drop":
        drop_pct = Decimal(str(args.get("drop_pct", 20)))
        adj = ctx.net_worth * (Decimal("1") - drop_pct / Decimal("100"))
        for name, rate in PROJECTION_SCENARIOS:
            out["baseline"][name] = float(
                _project_future_value(ctx.net_worth, ctx.monthly_contribution, rate, years)
            )
            out["scenario"][name] = float(
                _project_future_value(adj, ctx.monthly_contribution, rate, years)
            )
        out["drop_pct"] = float(drop_pct)
        out["post_drop_value"] = float(adj)
    else:
        return {"error": f"Unknown scenario kind: {kind}"}
    out["scenario_horizons_supported"] = list(PROJECTION_HORIZONS_YEARS)
    return out

"""Server-computed Next Steps queue.

Replaces the hardcoded demo payload with a queue composed from live user
state: over-budget envelopes (SpendingAnomaly), due review items (Mastery),
recent course completions bridged to the matching tool, and missing
budget/goal setup. Completing a step grants a small XP reward through the
idempotent reward ledger, so repeat swipes and retries cannot double-award.

Step ids are deterministic per day so the client queue, the completion
endpoint, and the ledger dedupe key all agree without any extra storage.
"""

from __future__ import annotations

from datetime import timedelta
from typing import Any, Dict, List

from django.utils import timezone

from gamification.models import RewardLedgerEntry
from gamification.services.rewards import grant_reward

DAILY_LIMIT = 3
QUEUE_SIZE = 5
_EVENT_PREFIX = "next_step"

# course-title keyword -> practical tool bridge. Route strings match the
# mobile expo-router tree (app/tools/*); web maps the same slugs.
_TOPIC_BRIDGES = (
    (
        ("budget", "spending", "banking", "money basics"),
        {
            "key": "budget",
            "title": "Set up a budget envelope",
            "description": (
                "You just finished a budgeting topic — give one real spending "
                "category a monthly target in the Budget Planner."
            ),
            "category": "action",
            "xp": 10,
            "route": "/tools/budget-planner",
        },
    ),
    (
        ("saving", "emergency"),
        {
            "key": "savings",
            "title": "Turn it into a savings goal",
            "description": (
                "Lock in what you learned: set a target amount and deadline " "in Savings Goals."
            ),
            "category": "action",
            "xp": 10,
            "route": "/tools/savings-goals",
        },
    ),
    (
        ("invest", "stock", "portfolio", "crypto", "forex", "market"),
        {
            "key": "invest",
            "title": "Try a paper trade",
            "description": (
                "Practice the investing concepts you just covered with a "
                "risk-free paper trade in the Portfolio tool."
            ),
            "category": "action",
            "xp": 10,
            "route": "/tools/portfolio",
        },
    ),
)


def _completed_step_ids_today(user, today_iso: str) -> set[str]:
    prefix = f"{_EVENT_PREFIX}:{today_iso}:"
    return {
        key[len(prefix) :]
        for key in RewardLedgerEntry.objects.filter(
            user=user, event_key__startswith=prefix
        ).values_list("event_key", flat=True)
    }


def _anomaly_steps(user) -> List[Dict[str, Any]]:
    from budgeting.models import SpendingAnomaly

    period_start = timezone.now().date().replace(day=1)
    steps = []
    anomalies = SpendingAnomaly.objects.filter(
        user=user,
        kind=SpendingAnomaly.Kind.OVER_BUDGET,
        detected_for=period_start,
        resolved_at__isnull=True,
    ).order_by("-created_at")[:2]
    for anomaly in anomalies:
        label = anomaly.category.replace("_", " ").title() or "spending"
        steps.append(
            {
                "id": f"anomaly-{anomaly.pk}",
                "title": f"Review your {label} budget",
                "description": anomaly.detail or anomaly.summary,
                "category": "action",
                "xp": 10,
                "route": "/tools/budget-planner",
            }
        )
    return steps


def _review_step(user, today_iso: str) -> Dict[str, Any] | None:
    from education.models import Mastery

    due = Mastery.objects.filter(user=user, due_at__lte=timezone.now()).count()
    if due <= 0:
        return None
    target = min(due, 5)
    return {
        "id": f"reviews-{today_iso}",
        "title": f"Clear {target} due review{'s' if target != 1 else ''}",
        "description": (
            f"{due} exercise{'s are' if due != 1 else ' is'} due for review. "
            "A quick session keeps what you learned from fading."
        ),
        "category": "review",
        "xp": 5,
        "route": "/exercises",
    }


def _course_bridge_steps(user) -> List[Dict[str, Any]]:
    from education.models import UserProgress

    week_ago = timezone.now() - timedelta(days=7)
    recent = (
        UserProgress.objects.filter(
            user=user, is_course_complete=True, course_completed_at__gte=week_ago
        )
        .select_related("course")
        .order_by("-course_completed_at")[:5]
    )
    steps: List[Dict[str, Any]] = []
    seen_keys: set[str] = set()
    for progress in recent:
        title = (progress.course.title or "").lower()
        for keywords, bridge in _TOPIC_BRIDGES:
            if bridge["key"] in seen_keys:
                continue
            if any(k in title for k in keywords):
                seen_keys.add(bridge["key"])
                steps.append(
                    {
                        "id": f"bridge-{bridge['key']}-{progress.course_id}",
                        "title": bridge["title"],
                        "description": bridge["description"],
                        "category": bridge["category"],
                        "xp": bridge["xp"],
                        "route": bridge["route"],
                    }
                )
                break
    return steps


def _setup_gap_steps(user) -> List[Dict[str, Any]]:
    from budgeting.models import BudgetEnvelope, Transaction
    from finance.models import FinancialGoal

    steps: List[Dict[str, Any]] = []
    has_budget_data = (
        BudgetEnvelope.objects.filter(user=user, is_active=True).exists()
        or Transaction.objects.filter(user=user).exists()
    )
    if not has_budget_data:
        steps.append(
            {
                "id": "setup-envelope",
                "title": "Create your first budget envelope",
                "description": (
                    "Pick one spending category and give it a monthly target — "
                    "it takes a minute and unlocks spending insights."
                ),
                "category": "action",
                "xp": 10,
                "route": "/tools/budget-planner",
            }
        )
    if not FinancialGoal.objects.filter(user=user).exists():
        steps.append(
            {
                "id": "setup-goal",
                "title": "Set a savings goal",
                "description": (
                    "Give your saving a destination: a target amount and a "
                    "deadline you can track."
                ),
                "category": "action",
                "xp": 10,
                "route": "/tools/savings-goals",
            }
        )
    return steps


_EXPLORE_FALLBACK = {
    "id": "explore-market",
    "title": "Explore market indices",
    "description": "Get a feel for major markets before making investment decisions.",
    "category": "explore",
    "xp": 5,
    "route": "/tools/market-explorer",
}


def build_next_steps(user) -> Dict[str, Any]:
    """Compose today's queue. Order = urgency: overspends, due reviews,
    fresh course bridges, setup gaps, explore fallback."""
    today_iso = timezone.localdate().isoformat()
    done_ids = _completed_step_ids_today(user, today_iso)
    completed_today = len(done_ids)

    steps: List[Dict[str, Any]] = []
    steps.extend(_anomaly_steps(user))
    review = _review_step(user, today_iso)
    if review:
        steps.append(review)
    steps.extend(_course_bridge_steps(user))
    steps.extend(_setup_gap_steps(user))
    if not steps:
        steps.append(dict(_EXPLORE_FALLBACK))

    steps = [s for s in steps if s["id"] not in done_ids][:QUEUE_SIZE]

    return {
        "steps": steps,
        "completed_today": completed_today,
        "limit": DAILY_LIMIT,
    }


def complete_next_step(user, step_id: str) -> Dict[str, Any]:
    """Grant XP for a step in today's queue. Idempotent per user/day/step via
    the reward ledger; enforces the daily XP cap server-side."""
    today_iso = timezone.localdate().isoformat()
    done_ids = _completed_step_ids_today(user, today_iso)
    if step_id in done_ids:
        return {"ok": True, "granted": False, "completed_today": len(done_ids)}
    if len(done_ids) >= DAILY_LIMIT:
        return {"ok": True, "granted": False, "completed_today": len(done_ids)}

    queue = build_next_steps(user)
    step = next((s for s in queue["steps"] if s["id"] == step_id), None)
    if step is None:
        # Unknown/stale id (e.g. queue recomputed): accept without reward so
        # the client swipe flow never errors, but grant nothing.
        return {"ok": True, "granted": False, "completed_today": len(done_ids)}

    result = grant_reward(
        user,
        f"{_EVENT_PREFIX}:{today_iso}:{step_id}",
        points=int(step["xp"]),
        bump_streak="none",
        evaluate_badges=False,
    )
    completed = len(done_ids) + (1 if result.granted else 0)
    return {
        "ok": True,
        "granted": result.granted,
        "xp": int(step["xp"]) if result.granted else 0,
        "completed_today": completed,
    }

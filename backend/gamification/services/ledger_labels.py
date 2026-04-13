"""
Map RewardLedgerEntry.event_key prefixes to user-facing activity labels.

Copy keys are resolved in the API layer via i18n on the client; the backend
returns stable `label_key` + fallback English `title`.
"""

from __future__ import annotations

from decimal import Decimal
from typing import Any


def describe_ledger_event(event_key: str, points: int, coins: Decimal) -> dict[str, Any]:
    key = (event_key or "")[:220]
    pts = int(points or 0)
    coins_s = str(coins or Decimal("0"))

    def base(
        *,
        type_: str,
        action: str,
        title: str,
        label_key: str,
        detail: str = "",
    ) -> dict[str, Any]:
        return {
            "type": type_,
            "action": action,
            "title": title,
            "label_key": label_key,
            "detail": detail,
            "points": pts,
            "coins": coins_s,
        }

    if key.startswith("streak_milestone:"):
        parts = key.split(":")
        milestone = parts[2] if len(parts) > 2 else ""
        return base(
            type_="streak",
            action="milestone",
            title=f"Streak milestone: {milestone} days",
            label_key="gamification.ledger.streak_milestone",
            detail=milestone,
        )
    if key.startswith("streak_freeze_used:"):
        return base(
            type_="streak",
            action="freeze_used",
            title="Streak freeze used",
            label_key="gamification.ledger.streak_freeze_used",
        )
    if key.startswith("mission_manual:"):
        return base(
            type_="mission",
            action="completed",
            title="Mission completed",
            label_key="gamification.ledger.mission_completed",
        )
    if key.startswith("mission_auto_complete:"):
        return base(
            type_="mission",
            action="completed",
            title="Mission completed",
            label_key="gamification.ledger.mission_completed",
        )
    if key.startswith("lesson:") or "lesson" in key:
        return base(
            type_="lesson",
            action="progress",
            title="Lesson reward",
            label_key="gamification.ledger.lesson_reward",
        )
    if key.startswith("quiz:") or "quiz" in key:
        return base(
            type_="quiz",
            action="progress",
            title="Quiz reward",
            label_key="gamification.ledger.quiz_reward",
        )
    if key.startswith("path:"):
        return base(
            type_="path",
            action="completed",
            title="Path reward",
            label_key="gamification.ledger.path_reward",
        )
    if key.startswith("section:"):
        return base(
            type_="lesson",
            action="progress",
            title="Section reward",
            label_key="gamification.ledger.section_reward",
        )
    if key.startswith("exercise:"):
        return base(
            type_="exercise",
            action="progress",
            title="Exercise reward",
            label_key="gamification.ledger.exercise_reward",
        )

    return base(
        type_="reward",
        action="granted",
        title="Reward",
        label_key="gamification.ledger.generic_reward",
        detail=key[:80],
    )

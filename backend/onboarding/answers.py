"""
Helpers for reading raw ``QuestionnaireProgress.answers`` values.

The onboarding questions are ``multiple_choice``: the mobile renderer treats
them as true multi-selects and stores a *list* of option values, while the web
renderer stores a single scalar value (see plan §2.2 — Headspace multi-goal
pattern). Every consumer of an answer must therefore accept both shapes;
these helpers are the single normalization point.

Convention for multi-selects: the first selected element is the primary
answer (e.g. the primary goal).
"""

from __future__ import annotations

from typing import Any


def answer_values(value: Any) -> list[str]:
    """Normalize a raw answer into a list of non-empty string values.

    Accepts a scalar (web single-tap), a list of scalars (mobile
    multi-select), or the ``{"value": ...}`` dict shape some clients send.
    """
    if value is None:
        return []
    if not isinstance(value, (list, tuple)):
        value = [value]
    out: list[str] = []
    for item in value:
        if isinstance(item, dict):
            item = item.get("value")
        text = str(item).strip() if item is not None else ""
        if text:
            out.append(text)
    return out


def primary_answer(value: Any) -> str | None:
    """The primary (first) selected value of an answer, or None when unset."""
    values = answer_values(value)
    return values[0] if values else None

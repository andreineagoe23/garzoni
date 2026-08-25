"""
Shape rules for multiple-choice answers — the ones that let a learner score
without reading the question.

Two giveaways were measured across the whole lesson corpus in August 2026:
the correct option sat in slot 2 in 75% of checks (and never in slot 4), and it
was the longest of the four in 95% of them, averaging 39 characters more than
its distractors.

Slot balance is fixed by ``rebalance_mc_answer_positions`` and is a property of
the corpus, not of one question — ``slot_distribution`` reports it. Length is a
property of a single question, so ``length_problem`` gates it at write time
(``rewrite_exercise_sections``) and at audit time
(``validate_lesson_quality_gates``).
"""

from __future__ import annotations

import os
from collections import Counter
from typing import Any, Iterable

# Longest option may be at most this many times the shortest. Measured on the
# corpus the old pipeline produced: only 4% of existing sets pass at 1.35 and
# 14% at 1.6, so this is a real constraint rather than a formality.
MAX_LENGTH_RATIO = float(os.environ.get("EXERCISE_MAX_LENGTH_RATIO", "1.6"))
# Below this, options are one-word labels and the ratio rule stops meaning much.
MIN_OPTION_CHARS = 25
# Inside the ratio gate there is still room for the answer to be the visibly
# fullest option, so cap how far it may exceed its nearest rival.
MAX_CORRECT_OVERSHOOT = 1.15


def length_problem(options: list[str], correct_index: int | None) -> str | None:
    """
    Describe why these options give the answer away by shape, or None if they don't.

    The message is written to be handed straight back to the model on a retry.
    """
    if not options or len(options) < 2:
        return None
    lengths = [len(str(o).strip()) for o in options]

    if min(lengths) < MIN_OPTION_CHARS:
        return (
            f"every option must be at least {MIN_OPTION_CHARS} characters; "
            f"shortest is {min(lengths)}"
        )

    ratio = max(lengths) / max(min(lengths), 1)
    if ratio > MAX_LENGTH_RATIO:
        return (
            f"options are too uneven in length (longest is {ratio:.2f}x the shortest, "
            f"limit {MAX_LENGTH_RATIO:.2f}); lengths were {lengths}"
        )

    if correct_index is None or not 0 <= correct_index < len(lengths):
        return None
    others = [n for i, n in enumerate(lengths) if i != correct_index]
    if others and lengths[correct_index] > MAX_CORRECT_OVERSHOOT * max(others):
        return (
            f"the correct option is the longest by too much "
            f"({lengths[correct_index]} vs {max(others)} chars) — "
            f"pad the distractors or trim it"
        )
    return None


def target_length_band(existing_options: list[Any]) -> tuple[int, int, int]:
    """
    (low, mid, high) character budget to hand a rewriter, as ``high/low ≈ 1.35``.

    A model given the ratio rule on its own has to reason about it and misses
    roughly 40% of the time; given an explicit character range anchored to the
    question's existing options, it lands far more often. The band sits inside
    MAX_LENGTH_RATIO so a near-miss still passes.
    """
    lengths = sorted(len(str(o).strip()) for o in existing_options if str(o).strip())
    mid = lengths[len(lengths) // 2] if lengths else 70
    mid = max(MIN_OPTION_CHARS + 20, min(95, mid))
    low = max(MIN_OPTION_CHARS, round(mid / 1.16))
    high = round(low * 1.35)
    return low, mid, high


def correct_index_of(data: dict[str, Any], n_options: int) -> int | None:
    """Stored answer index, tolerating the snake_case spelling some rows use."""
    for key in ("correctAnswer", "correct_answer"):
        raw = data.get(key)
        if isinstance(raw, bool):
            continue
        if isinstance(raw, int) and 0 <= raw < n_options:
            return raw
    return None


def slot_distribution(rows: Iterable[tuple[list[str], int | None]]) -> dict[str, Any]:
    """
    Corpus-level answer-position and length summary.

    One lesson holds two knowledge checks, so position bias is invisible per
    lesson and only shows up in aggregate — this is what to watch after a
    content run.
    """
    slots: Counter[int] = Counter()
    longest = 0
    total = 0
    for options, correct in rows:
        if correct is None or not options:
            continue
        total += 1
        slots[correct] += 1
        lengths = [len(str(o).strip()) for o in options]
        if lengths[correct] == max(lengths):
            longest += 1
    width = max(slots) + 1 if slots else 0
    return {
        "total": total,
        "by_slot": {str(i): slots.get(i, 0) for i in range(width)},
        "correct_is_longest": longest,
        "correct_is_longest_pct": round(100 * longest / total, 1) if total else 0.0,
    }

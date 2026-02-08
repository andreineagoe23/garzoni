"""Shared utility functions for environment parsing and configuration."""

from __future__ import annotations

import os
from typing import Iterable, List, Optional


def normalize_text_encoding(text: str | None) -> str | None:
    """Fix common mojibake from UTF-8 being misinterpreted as Latin-1/Windows-1252.

    Use when returning user-facing strings from DB or external sources so apostrophes
    and quotes display correctly (e.g. "won't" instead of mojibake).
    """
    if text is None or not isinstance(text, str):
        return text
    replacements = [
        ("\u2019", "'"),  # RIGHT SINGLE QUOTATION MARK
        ("\u2018", "'"),  # LEFT SINGLE QUOTATION MARK
        ("\u201c", '"'),  # LEFT DOUBLE QUOTATION MARK
        ("\u201d", '"'),  # RIGHT DOUBLE QUOTATION MARK
        ("\u2013", "-"),  # EN DASH
        ("\u2014", "-"),  # EM DASH
        ("\u00e2\u20ac\u2122", "'"),  # mojibake for U+2019 (e.g. won't)
        ("\u00e2\u20ac\u0153", '"'),  # mojibake for left double quote
        ("\u00e2\u20ac\u201d", '"'),  # mojibake for right double quote
        ("\u00c2\u00a3", "\u00a3"),  # Â£ (UTF-8 £ read as Latin-1) -> £
    ]
    out = text
    for old, new in replacements:
        out = out.replace(old, new)
    return out


_TRUE_VALUES = {"1", "true", "t", "yes", "y", "on"}


def env_bool(name: str, default: bool = False) -> bool:
    """Return a boolean from an environment variable.

    Values are considered truthy when they match a small set of common true strings.
    """

    value = os.getenv(name)
    if value is None:
        return default
    return value.strip().lower() in _TRUE_VALUES


def env_csv(name: str, default: Optional[Iterable[str]] = None) -> List[str]:
    """Split a comma-separated environment variable into a list of strings."""

    value = os.getenv(name)
    if value:
        return [item.strip() for item in value.split(",") if item.strip()]
    if default is None:
        return []
    return list(default)

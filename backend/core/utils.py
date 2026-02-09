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
    if text == "":
        return text

    # Common mojibake marker characters when UTF-8 bytes are decoded using
    # legacy encodings (latin-1/cp1252/cp1250).
    mojibake_markers = ("Â", "Ã", "â", "È", "ï¸", "š")

    def _score(value: str) -> int:
        return sum(value.count(marker) for marker in mojibake_markers)

    candidates = [text]
    # Try byte roundtrip recovery for the most common failure modes.
    for source_encoding in ("latin1", "cp1252", "cp1250"):
        try:
            repaired = text.encode(source_encoding).decode("utf-8")
        except (UnicodeEncodeError, UnicodeDecodeError):
            continue
        candidates.append(repaired)
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
        # Romanian ș (U+0219) UTF-8 C8 99 -> È™ when read as Windows-1252
        ("\u00c8\u2122", "\u0219"),  # ș
        # Romanian ț (U+021B) UTF-8 C8 9B -> È› when read as Windows-1252
        ("\u00c8\u203a", "\u021b"),  # ț
        # Romanian Î (U+00CE) UTF-8 C3 8E -> ÃŽ
        ("\u00c3\u008e", "\u00ce"),  # Î
        # Warning sign + variation selector ⚠️ (U+26A0 U+FE0F) UTF-8 E2 9A A0 EF B8 8F -> âš ï¸
        ("\u00e2\u009a\u00a0\u00ef\u00b8\u008f", "\u26a0\ufe0f"),  # ⚠️
        ("\u00e2\u0161\u00a0\u00ef\u00b8\u008f", "\u26a0\ufe0f"),  # âš ï¸ -> ⚠️
        ("\u00e2\u009a\u00a0", "\u26a0"),  # ⚠ (without variation selector)
    ]
    out = min(candidates, key=_score)
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

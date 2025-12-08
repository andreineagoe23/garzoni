"""Shared utility functions for environment parsing and configuration."""
from __future__ import annotations

import os
from typing import Iterable, List, Optional


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

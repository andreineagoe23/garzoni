"""
Centralized user display values with encoding normalization.

Always use this module when exposing user.username, user.first_name, or user.last_name
in API responses, exports, or admin. Do not read those fields directly for display—
this prevents mojibake (e.g. RoÈ™u, Â£, âš ï¸) from appearing again.

Usage:
  from authentication.user_display import user_display_dict, normalize_display_string

  # Full auth payload (login/register)
  user_display_dict(user, include_id=True, include_email=True, include_staff=True)

  # Profile/settings payload
  user_display_dict(user, include_email=True)

  # Minimal (e.g. friend list)
  user_display_dict(user, include_id=True)

  # Single field (e.g. in serializers)
  normalize_display_string(user.username)
"""

from __future__ import annotations

from core.utils import normalize_text_encoding


def normalize_display_string(value: str | None) -> str:
    """Return normalized string for display; prevents mojibake. Use for any user-facing text from DB."""
    if value is None:
        return ""
    normalized = normalize_text_encoding(value)
    return normalized if normalized is not None else value


def user_display_dict(
    user,
    *,
    include_id: bool = False,
    include_email: bool = False,
    include_staff: bool = False,
) -> dict:
    """
    Build a dict of user display fields with encoding normalization applied.
    This is the single source of truth for exposing user names in API/admin.
    """
    out = {
        "username": normalize_display_string(user.username),
        "first_name": normalize_display_string(user.first_name),
        "last_name": normalize_display_string(user.last_name),
    }
    if include_id:
        out["id"] = user.id
    if include_email:
        out["email"] = user.email or ""
    if include_staff:
        out["is_staff"] = getattr(user, "is_staff", False)
        out["is_superuser"] = getattr(user, "is_superuser", False)
    return out

from typing import Any, Dict, Optional

from django.contrib.auth.models import User

from education.models import EducationAuditLog


def log_admin_action(
    *,
    user: Optional[User],
    action: str,
    target_type: str,
    target_id: int,
    metadata: Optional[Dict[str, Any]] = None,
):
    """Persist a lightweight audit trail for administrative changes."""

    EducationAuditLog.objects.create(
        user=user if user and user.is_authenticated else None,
        action=action,
        target_type=target_type,
        target_id=target_id,
        metadata=metadata or {},
    )


def resolve_path_access_tier(path) -> str:
    """Return the minimum tier for a path, with title-based fallback."""
    raw_tier = getattr(path, "access_tier", None)
    if isinstance(raw_tier, str) and raw_tier.strip():
        tier = raw_tier.strip().lower()
        if tier in {"starter", "plus", "pro"}:
            return tier

    title = (getattr(path, "title", "") or "").strip().lower()
    if not title:
        return "starter"

    if "crypto" in title:
        return "pro"
    if "forex" in title:
        return "pro"
    if "real estate" in title:
        return "plus"
    if "personal finance" in title:
        return "plus"
    if "mindset" in title:
        return "starter"
    if "basic finance" in title or "finance basics" in title:
        return "starter"

    return "starter"

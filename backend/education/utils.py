from typing import Any, Dict, Optional

from django.contrib.auth.models import User
from django.http import HttpRequest

from education.models import EducationAuditLog

# Supported locale codes for backend-translated content (must match frontend).
SUPPORTED_LANGUAGES = ["en", "ro"]
DEFAULT_LANGUAGE = "en"


def get_request_language(request: Optional[HttpRequest]) -> str:
    """
    Resolve the requested language from Accept-Language header or X-App-Language.
    Returns a supported code (e.g. 'en', 'ro') or DEFAULT_LANGUAGE.
    """
    if not request:
        return DEFAULT_LANGUAGE
    # Custom header takes precedence (frontend can set it from i18n)
    lang_header = request.META.get("HTTP_X_APP_LANGUAGE") or request.META.get(
        "HTTP_ACCEPT_LANGUAGE"
    )
    if not lang_header:
        return DEFAULT_LANGUAGE
    # Accept-Language can be "ro-RO,ro;q=0.9,en;q=0.8" – take first tag
    raw = lang_header.split(",")[0].strip().split(";")[0].strip().lower()
    if not raw:
        return DEFAULT_LANGUAGE
    code = raw[:2]
    return code if code in SUPPORTED_LANGUAGES else DEFAULT_LANGUAGE


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

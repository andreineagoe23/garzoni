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

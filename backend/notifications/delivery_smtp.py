from __future__ import annotations

import logging

from django.conf import settings
from django.core.mail import send_mail
from django.template.loader import render_to_string
from django.utils.html import strip_tags

logger = logging.getLogger(__name__)


def smtp_configured() -> bool:
    backend = (getattr(settings, "EMAIL_BACKEND", "") or "").lower()
    if "console" in backend:
        return True
    if "anymail" in backend:
        return bool(getattr(settings, "ANYMAIL", None))
    return bool(
        getattr(settings, "EMAIL_HOST_USER", None) and getattr(settings, "EMAIL_HOST_PASSWORD", None)
    )


def send_html_email(*, subject: str, template_name: str, context: dict, to_emails: list[str]) -> None:
    if not smtp_configured():
        raise RuntimeError("SMTP/Anymail not configured")
    html_message = render_to_string(template_name, context)
    send_mail(
        subject,
        strip_tags(html_message),
        settings.DEFAULT_FROM_EMAIL,
        to_emails,
        html_message=html_message,
        fail_silently=False,
    )

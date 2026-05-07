from __future__ import annotations

import logging
from typing import Any

from django.conf import settings
from django.contrib.auth import get_user_model
from django.contrib.auth.models import User
from django.utils import timezone

from authentication.user_display import normalize_display_string
from notifications.customer_io import resolve_transactional_ref
from notifications.delivery_smtp import send_html_email, smtp_configured
from notifications.enums import CioEventName, CioTemplate
from notifications.events import NotificationEvents
from notifications.idempotency import claim_idempotency_key
from notifications.policy import should_send_email
from notifications.profile_sync import NotificationProfileSync
from notifications.transactional import TransactionalMessages

logger = logging.getLogger(__name__)


def _use_cio_transactional(template: CioTemplate) -> bool:
    if not getattr(settings, "CIO_TRANSACTIONAL_ENABLED", False):
        return False
    return resolve_transactional_ref(template.value) is not None


def _outcome_from_cio(ok: bool, err: str | None) -> str:
    if ok:
        return "sent_cio"
    if err and err.startswith("skipped_"):
        return err
    return f"cio_failed:{err}"


class NotificationService:
    """
    Single entry for outbound notifications: policy → Customer.io or SMTP fallback.
    """

    def __init__(self) -> None:
        self.profile_sync = NotificationProfileSync()
        self.events = NotificationEvents()
        self.transactional = TransactionalMessages()

    def sync_user_profile(self, user: User) -> tuple[bool, str | None]:
        return self.profile_sync.sync_user(user)

    def send_password_reset(
        self, user: User, reset_link: str, *, idempotency_key: str | None = None
    ) -> str:
        if idempotency_key and not claim_idempotency_key(idempotency_key, "password_reset"):
            return "skipped_duplicate"
        pr = should_send_email(user, CioTemplate.PASSWORD_RESET)
        if not pr.allowed:
            return f"policy_denied:{pr.reason}"
        ctx = {"user": user, "reset_link": reset_link}
        if _use_cio_transactional(CioTemplate.PASSWORD_RESET):
            ok, err = self.transactional.send(
                CioTemplate.PASSWORD_RESET,
                user,
                {
                    "reset_link": reset_link,
                    "customer_name": user.first_name or user.username or "there",
                },
            )
            return _outcome_from_cio(ok, err)
        if not smtp_configured():
            return "skipped_no_smtp"
        send_html_email(
            subject="Password Reset Request",
            template_name="emails/password_reset.html",
            context=ctx,
            to_emails=[user.email],
        )
        return "sent_smtp"

    def send_welcome(self, user: User, *, idempotency_key: str | None = None) -> str:
        if idempotency_key and not claim_idempotency_key(idempotency_key, "welcome"):
            return "skipped_duplicate"
        pr = should_send_email(user, CioTemplate.WELCOME)
        if not pr.allowed:
            return f"policy_denied:{pr.reason}"
        display_name = normalize_display_string(user.first_name or user.username or "there")
        app_url = getattr(settings, "FRONTEND_URL", "https://garzoni.app")
        ctx = {
            "display_name": display_name,
            "app_url": app_url,
            "year": timezone.now().year,
        }
        cio_data = {
            "customer_name": display_name,
            "app_url": app_url,
            "year": ctx["year"],
        }
        # Always fire USER_REGISTERED track event so CIO journeys/automations can deliver
        # the welcome email independently of the transactional template being configured.
        self.publish_domain_event(user, CioEventName.USER_REGISTERED, cio_data)
        if _use_cio_transactional(CioTemplate.WELCOME):
            ok, err = self.transactional.send(CioTemplate.WELCOME, user, cio_data)
            return _outcome_from_cio(ok, err)
        if smtp_configured():
            send_html_email(
                subject="Welcome to Garzoni",
                template_name="emails/welcome.html",
                context=ctx,
                to_emails=[user.email],
            )
            return "sent_smtp"
        return "journey_event_published"

    def send_subscription_cancelled(
        self,
        *,
        email: str,
        display_name: str,
        access_until_iso: str | None = None,
        user: User | None = None,
        idempotency_key: str | None = None,
    ) -> str:
        if idempotency_key and not claim_idempotency_key(idempotency_key, "subscription_cancelled"):
            return "skipped_duplicate"
        User = get_user_model()
        resolved_user = user or User.objects.filter(email__iexact=email.strip()).first()
        if resolved_user:
            pr = should_send_email(resolved_user, CioTemplate.SUBSCRIPTION_CANCELLED)
            if not pr.allowed:
                return f"policy_denied:{pr.reason}"
        access_until_str = None
        if access_until_iso:
            try:
                from datetime import datetime as dt_parse

                dt = dt_parse.fromisoformat(access_until_iso.replace("Z", "+00:00"))
                access_until_str = dt.strftime("%B %d, %Y")
            except Exception:
                access_until_str = (
                    access_until_iso[:10] if len(access_until_iso) >= 10 else access_until_iso
                )
        ctx = {
            "display_name": display_name,
            "access_until_str": access_until_str,
            "manage_url": f"{getattr(settings, 'FRONTEND_URL', 'https://garzoni.app').rstrip('/')}/billing",
            "year": timezone.now().year,
        }
        md = {
            "customer_name": display_name,
            "access_until_str": access_until_str or "",
            "manage_url": ctx["manage_url"],
            "year": ctx["year"],
        }
        if _use_cio_transactional(CioTemplate.SUBSCRIPTION_CANCELLED):
            if resolved_user:
                ok, err = self.transactional.send(
                    CioTemplate.SUBSCRIPTION_CANCELLED,
                    resolved_user,
                    md,
                    to_email=email,
                )
            else:
                ok, err = self.transactional.send_with_identifiers(
                    CioTemplate.SUBSCRIPTION_CANCELLED,
                    to_email=email,
                    identifiers={"email": email.strip()},
                    data=md,
                )
            return _outcome_from_cio(ok, err)
        if not smtp_configured():
            return "skipped_no_smtp"
        send_html_email(
            subject="Your subscription has been cancelled",
            template_name="emails/subscription_cancelled.html",
            context=ctx,
            to_emails=[email],
        )
        return "sent_smtp"

    def send_staff_contact_email(self, *, from_email: str, topic: str, message: str) -> None:
        from django.core.mail import send_mail as django_send_mail

        django_send_mail(
            f"[Contact Form] {topic}",
            f"From: {from_email}\n\n{message}",
            settings.DEFAULT_FROM_EMAIL,
            (
                [settings.CONTACT_EMAIL]
                if getattr(settings, "CONTACT_EMAIL", None)
                else [settings.DEFAULT_FROM_EMAIL]
            ),
            fail_silently=False,
        )

    def send_template_for_user(
        self,
        user: User,
        template: CioTemplate,
        *,
        subject: str,
        django_template: str,
        context: dict[str, Any],
        idempotency_key: str | None = None,
        purpose: str = "generic",
    ) -> str:
        if idempotency_key and not claim_idempotency_key(idempotency_key, purpose):
            return "skipped_duplicate"
        pr = should_send_email(user, template)
        if not pr.allowed:
            return f"policy_denied:{pr.reason}"
        if _use_cio_transactional(template):
            # CIO templates use Liquid; pass a flattened message_data subset from context keys
            md = {
                k: v
                for k, v in context.items()
                if isinstance(v, (str, int, float, bool)) or v is None
            }
            ok, err = self.transactional.send(template, user, md)
            return _outcome_from_cio(ok, err)
        if not smtp_configured():
            return "skipped_no_smtp"
        send_html_email(
            subject=subject, template_name=django_template, context=context, to_emails=[user.email]
        )
        return "sent_smtp"

    def track_journey_eligible(
        self, user: User, event: CioEventName, data: dict[str, Any] | None = None
    ) -> None:
        if getattr(settings, "CIO_JOURNEY_EVENTS_ENABLED", False) and getattr(
            settings, "CIO_TRACK_ENABLED", False
        ):
            self.events.track(user, event, data or {})

    def publish_domain_event(
        self, user: User, event: CioEventName, data: dict[str, Any] | None = None
    ) -> None:
        """Track API event when CIO_TRACK_ENABLED (not gated on journey-only flag)."""
        if getattr(settings, "CIO_TRACK_ENABLED", False):
            self.events.track(user, event, data or {})

    def _send_transactional_operational(
        self,
        user: User,
        template: CioTemplate,
        message_data: dict[str, Any],
        *,
        idempotency_key: str | None,
        purpose: str,
        smtp_subject: str | None = None,
        smtp_template: str | None = None,
        extra_smtp_context: dict[str, Any] | None = None,
    ) -> str:
        if idempotency_key and not claim_idempotency_key(idempotency_key, purpose):
            return "skipped_duplicate"
        pr = should_send_email(user, template)
        if not pr.allowed:
            return f"policy_denied:{pr.reason}"
        if _use_cio_transactional(template):
            ok, err = self.transactional.send(template, user, message_data)
            return _outcome_from_cio(ok, err)
        if smtp_template and smtp_subject and smtp_configured():
            ctx: dict[str, Any] = {**(extra_smtp_context or {}), **message_data}
            ctx.setdefault("year", timezone.now().year)
            ctx["user"] = user
            send_html_email(
                subject=smtp_subject,
                template_name=smtp_template,
                context=ctx,
                to_emails=[user.email],
            )
            return "sent_smtp"
        logger.info(
            "Transactional template %s has no CIO mapping and no SMTP fallback; skipped",
            template.value,
        )
        return "skipped_no_cio_mapping"

    def send_email_verification(
        self,
        user: User,
        *,
        verify_link: str,
        idempotency_key: str | None = None,
    ) -> str:
        name = normalize_display_string(user.first_name or user.username or "there")
        return self._send_transactional_operational(
            user,
            CioTemplate.EMAIL_VERIFICATION,
            {"verify_link": verify_link, "customer_name": name},
            idempotency_key=idempotency_key,
            purpose="email_verification",
            smtp_subject="Verify your Garzoni email",
            smtp_template="emails/email_verification.html",
            extra_smtp_context={"verification_link": verify_link},
        )

    def send_magic_login(
        self,
        user: User,
        *,
        magic_link: str,
        expires_minutes: int = 15,
        idempotency_key: str | None = None,
    ) -> str:
        name = normalize_display_string(user.first_name or user.username or "there")
        return self._send_transactional_operational(
            user,
            CioTemplate.MAGIC_LOGIN,
            {
                "magic_link": magic_link,
                "customer_name": name,
                "expires_minutes": expires_minutes,
            },
            idempotency_key=idempotency_key,
            purpose="magic_login",
            smtp_subject="Your Garzoni login link",
            smtp_template="emails/magic_login.html",
            extra_smtp_context={"login_link": magic_link, "expires_minutes": expires_minutes},
        )

    def send_order_confirmed(
        self,
        user: User,
        *,
        message_data: dict[str, Any],
        idempotency_key: str | None = None,
    ) -> str:
        return self._send_transactional_operational(
            user,
            CioTemplate.ORDER_CONFIRMED,
            message_data,
            idempotency_key=idempotency_key,
            purpose="order_confirmed",
            smtp_subject="Your Garzoni order confirmed",
            smtp_template="emails/order_confirmed.html",
        )

    def send_payment_receipt(
        self,
        user: User,
        *,
        message_data: dict[str, Any],
        idempotency_key: str | None = None,
    ) -> str:
        return self._send_transactional_operational(
            user,
            CioTemplate.PAYMENT_RECEIPT,
            message_data,
            idempotency_key=idempotency_key,
            purpose="payment_receipt",
            smtp_subject="Payment received – Garzoni",
            smtp_template="emails/payment_receipt.html",
        )

    def send_payment_failed(
        self,
        user: User,
        *,
        message_data: dict[str, Any],
        idempotency_key: str | None = None,
    ) -> str:
        return self._send_transactional_operational(
            user,
            CioTemplate.PAYMENT_FAILED,
            message_data,
            idempotency_key=idempotency_key,
            purpose="payment_failed",
            smtp_subject="Action needed: payment failed",
            smtp_template="emails/payment_failed.html",
        )

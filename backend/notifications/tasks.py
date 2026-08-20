from __future__ import annotations

import logging

from celery import shared_task
from django.conf import settings
from django.contrib.auth import get_user_model

from django.utils import timezone

from notifications.enums import CioTemplate
from notifications.service import NotificationService

logger = logging.getLogger(__name__)


@shared_task(
    bind=True,
    autoretry_for=(Exception,),
    retry_backoff=60,
    retry_kwargs={"max_retries": 3},
)
def send_password_reset_email_task(
    self, user_pk: int, reset_link: str, idempotency_key: str | None = None
) -> str:
    User = get_user_model()
    try:
        user = User.objects.get(pk=user_pk)
    except User.DoesNotExist:
        return "skipped_no_user"
    svc = NotificationService()
    svc.sync_user_profile(user)
    return svc.send_password_reset(user, reset_link, idempotency_key=idempotency_key)


@shared_task(
    bind=True,
    autoretry_for=(Exception,),
    retry_backoff=60,
    retry_kwargs={"max_retries": 3},
)
def send_welcome_email_task(self, user_id: int, idempotency_key: str | None = None) -> str:
    User = get_user_model()
    try:
        user = User.objects.get(id=user_id)
    except User.DoesNotExist:
        return "skipped (user not found)"
    svc = NotificationService()
    svc.sync_user_profile(user)
    return svc.send_welcome(user, idempotency_key=idempotency_key)


@shared_task(
    bind=True,
    autoretry_for=(Exception,),
    retry_backoff=60,
    retry_kwargs={"max_retries": 3},
)
def sync_user_to_customer_io(self, user_id: int) -> str:
    User = get_user_model()
    try:
        user = User.objects.get(id=user_id)
    except User.DoesNotExist:
        return "skipped"
    from notifications.customer_io import is_test_email

    if is_test_email(user.email):
        return "skipped_test_email"
    ok, err = NotificationService().sync_user_profile(user)
    return "ok" if ok else f"failed:{err}"


@shared_task(
    bind=True,
    autoretry_for=(Exception,),
    retry_backoff=60,
    retry_kwargs={"max_retries": 3},
)
def send_billing_order_confirmed_task(
    self, user_pk: int, message_data: dict, idempotency_key: str | None = None
) -> str:
    User = get_user_model()
    try:
        user = User.objects.get(pk=user_pk)
    except User.DoesNotExist:
        return "skipped_no_user"
    svc = NotificationService()
    svc.sync_user_profile(user)
    return svc.send_order_confirmed(
        user, message_data=message_data, idempotency_key=idempotency_key
    )


@shared_task(
    bind=True,
    autoretry_for=(Exception,),
    retry_backoff=60,
    retry_kwargs={"max_retries": 3},
)
def send_billing_payment_receipt_task(
    self, user_pk: int, message_data: dict, idempotency_key: str | None = None
) -> str:
    User = get_user_model()
    try:
        user = User.objects.get(pk=user_pk)
    except User.DoesNotExist:
        return "skipped_no_user"
    svc = NotificationService()
    svc.sync_user_profile(user)
    return svc.send_payment_receipt(
        user, message_data=message_data, idempotency_key=idempotency_key
    )


@shared_task(
    bind=True,
    autoretry_for=(Exception,),
    retry_backoff=60,
    retry_kwargs={"max_retries": 3},
)
def send_billing_payment_failed_task(
    self, user_pk: int, message_data: dict, idempotency_key: str | None = None
) -> str:
    User = get_user_model()
    try:
        user = User.objects.get(pk=user_pk)
    except User.DoesNotExist:
        return "skipped_no_user"
    svc = NotificationService()
    svc.sync_user_profile(user)
    return svc.send_payment_failed(user, message_data=message_data, idempotency_key=idempotency_key)


@shared_task(
    bind=True,
    autoretry_for=(Exception,),
    retry_backoff=60,
    retry_kwargs={"max_retries": 3},
)
def send_password_changed_email_task(
    self, user_pk: int, *, idempotency_key: str | None = None
) -> str:
    User = get_user_model()
    try:
        user = User.objects.get(pk=user_pk)
    except User.DoesNotExist:
        return "skipped_no_user"
    display_name = user.first_name or user.username or "there"
    ctx = {"display_name": display_name, "year": timezone.now().year}
    svc = NotificationService()
    svc.sync_user_profile(user)
    return svc.send_template_for_user(
        user,
        CioTemplate.PASSWORD_CHANGED,
        subject="Your Garzoni password was changed",
        django_template="emails/password_changed.html",
        context=ctx,
        idempotency_key=idempotency_key,
        purpose="password_changed",
    )


@shared_task(
    bind=True,
    autoretry_for=(Exception,),
    retry_backoff=60,
    retry_kwargs={"max_retries": 5},
)
def delete_user_from_customer_io(self, person_id: str) -> str:
    """Remove a deleted account's Customer.io profile.

    Takes the person id, not a user id: by the time this runs the Django row is
    gone, so there is nothing left to look up. Retries hard — a profile that
    outlives its account keeps entering journeys, keeps failing every email send
    on `undefined variable: customer.email`, and keeps counting against the
    profile allowance. 89 of the 179 profiles in the workspace on 2026-08-20 were
    exactly this, because nothing reconciled a failed delete.
    """
    from notifications.customer_io import delete_person

    ok, err = delete_person(str(person_id))
    if not ok:
        # Raise so autoretry_for picks it up rather than losing the profile.
        raise RuntimeError(f"customer.io delete failed for person_id={person_id}: {err}")
    return "ok"


def safe_enqueue_delete_user_from_customer_io(person_id: str) -> None:
    """Queue the profile delete, falling back to an inline call if the broker is down.

    Never raises: account deletion must succeed for the user even when Customer.io
    or Redis does not. A failure here is logged at error level precisely because
    it is the case that silently accumulates orphans.
    """
    try:
        delete_user_from_customer_io.delay(str(person_id))
        return
    except Exception:
        logger.warning(
            "delete_user_from_customer_io.delay failed for person_id=%s — "
            "broker may be unavailable. Deleting inline.",
            person_id,
            exc_info=True,
        )
    try:
        from notifications.customer_io import delete_person

        ok, err = delete_person(str(person_id))
        if not ok:
            logger.error(
                "customer.io profile NOT deleted for person_id=%s: %s — "
                "this leaves an orphaned profile; run `manage.py cio_find_orphans`",
                person_id,
                err,
            )
    except Exception:
        logger.exception("customer.io inline delete raised for person_id=%s", person_id)


def safe_enqueue_sync_user_to_customer_io(user_id: int) -> None:
    """
    Queue Customer.io profile sync without failing the HTTP request if Celery/Redis is down.
    Falls back to synchronous sync so traits (e.g. expo_push_token) still reach Customer.io.

    Debounced per user: a single sign-in fans out into several near-simultaneous
    syncs (login + push-token registration + profile read), each doing a CDP +
    Track write — the "N attributes changed / Failed Attribute Change" bursts seen
    in the CIO activity log. Each sync re-sends the full current profile, so
    collapsing rapid duplicates loses nothing; the next change after the window
    syncs normally. Window is CIO_SYNC_DEBOUNCE_SECONDS (default 5; 0 disables).
    """
    debounce = int(getattr(settings, "CIO_SYNC_DEBOUNCE_SECONDS", 5) or 0)
    if debounce > 0:
        from django.core.cache import cache

        key = f"cio_sync_recent:{user_id}"
        # add() is atomic and only succeeds if the key is absent — first caller in
        # the window wins, the rest are skipped.
        if not cache.add(key, 1, timeout=debounce):
            return

    try:
        sync_user_to_customer_io.delay(user_id)
        return
    except Exception:
        logger.warning(
            "sync_user_to_customer_io.delay failed for user_id=%s — "
            "broker may be unavailable (Redis, Celery). Running inline sync.",
            user_id,
            exc_info=True,
        )
    try:
        User = get_user_model()
        user = User.objects.get(id=user_id)
    except User.DoesNotExist:
        return
    try:
        ok, err = NotificationService().sync_user_profile(user)
        if not ok:
            logger.warning(
                "inline Customer.io sync failed user_id=%s: %s",
                user_id,
                err,
            )
    except Exception:
        logger.warning(
            "inline Customer.io sync raised for user_id=%s",
            user_id,
            exc_info=True,
        )


@shared_task(
    bind=True,
    autoretry_for=(Exception,),
    retry_backoff=30,
    retry_kwargs={"max_retries": 3},
)
def suppress_customer_in_cio(self, customer_id: str, email: str | None = None) -> str:
    """
    Set ``unsubscribed = true`` on a Customer.io profile after a hard bounce or spam
    complaint, so no further CIO email (journey, newsletter, or transactional) is ever
    attempted for that address.

    This is the only durable suppression path for Apple Private Relay "unauthorized
    sender" bounces: Mailgun classifies them as policy/block rejections, not permanent
    hard bounces, so CIO's ESP suppression list never catches them and the same relay
    inboxes get retried forever. Flipping ``unsubscribed`` stops all CIO sends regardless
    of campaign. ``email`` is accepted only for log traceability — the profile is
    addressed by its stable id (Django pk).
    """
    pid = (customer_id or "").strip()
    if not pid:
        return "skipped_no_id"
    from notifications.customer_io import identify_person

    ok, err = identify_person(pid, {"unsubscribed": True})
    logger.info("cio_suppress id=%s email=%s ok=%s err=%s", pid, email or "", ok, err)
    return "ok" if ok else f"failed:{err}"


@shared_task(
    bind=True,
    autoretry_for=(Exception,),
    retry_backoff=30,
    retry_kwargs={"max_retries": 3},
)
def resubscribe_customer_in_cio(self, customer_id: str) -> str:
    """
    Clear ``unsubscribed`` on a Customer.io profile after the user opts back into
    marketing from Settings or the preferences centre.

    Counterpart to :func:`suppress_customer_in_cio`. Profile identify never carries
    ``unsubscribed`` (writing it on every sync would undo bounce suppression), so
    re-subscription has to be an explicit, one-shot flip on the off→on transition.
    """
    pid = (customer_id or "").strip()
    if not pid:
        return "skipped_no_id"
    from notifications.customer_io import identify_person

    ok, err = identify_person(pid, {"unsubscribed": False})
    logger.info("cio_resubscribe id=%s ok=%s err=%s", pid, ok, err)
    return "ok" if ok else f"failed:{err}"


def safe_enqueue_resubscribe_customer_in_cio(customer_id: str) -> None:
    """Queue the re-subscribe without failing the caller if Celery/Redis is down."""
    cid = (str(customer_id) if customer_id is not None else "").strip()
    if not cid:
        return
    try:
        resubscribe_customer_in_cio.delay(cid)
        return
    except Exception:
        logger.warning(
            "resubscribe_customer_in_cio.delay failed id=%s — broker may be down, running inline",
            cid,
            exc_info=True,
        )
    try:
        from notifications.customer_io import identify_person

        identify_person(cid, {"unsubscribed": False})
    except Exception:
        logger.warning("inline CIO resubscribe raised id=%s", cid, exc_info=True)


def safe_enqueue_suppress_customer_in_cio(customer_id: str, email: str | None = None) -> None:
    """Queue CIO suppression without failing the caller (e.g. a webhook) if Celery/Redis
    is down — falls back to an inline identify so the bounce is still suppressed."""
    cid = (str(customer_id) if customer_id is not None else "").strip()
    if not cid:
        return
    try:
        suppress_customer_in_cio.delay(cid, email)
        return
    except Exception:
        logger.warning(
            "suppress_customer_in_cio.delay failed id=%s — broker may be down, running inline",
            cid,
            exc_info=True,
        )
    try:
        from notifications.customer_io import identify_person

        identify_person(cid, {"unsubscribed": True})
    except Exception:
        logger.warning("inline CIO suppress raised id=%s", cid, exc_info=True)


# ---------------------------------------------------------------------------
# Expo delivery receipts
# ---------------------------------------------------------------------------

# Expo keeps receipts for ~24h. Give APNs/FCM a few minutes to report before
# asking, and stop asking once the receipt can no longer exist.
RECEIPT_MIN_AGE_SECONDS = 15 * 60
RECEIPT_MAX_AGE_HOURS = 24
RECEIPT_BATCH_SIZE = 300


@shared_task(bind=True, max_retries=1)
def poll_expo_push_receipts(self) -> dict:
    """
    Ask Expo what actually happened to the pushes we sent.

    A ticket from `/push/send` only means "queued". Every real failure mode —
    a revoked APNs key (`InvalidCredentials`), a wrong FCM sender
    (`MismatchSenderId`), an uninstalled app (`DeviceNotRegistered`) — is
    reported here and nowhere else. Run it on a schedule so a dead credential
    shows up in hours instead of being invisible until someone notices they
    have not had a notification in months.
    """
    from django.utils import timezone as dj_timezone

    from notifications.expo_push import (
        FATAL_RECEIPT_ERRORS,
        _clear_stale_expo_token,
        fetch_expo_receipts,
    )
    from notifications.models import PushTicket

    now = dj_timezone.now()
    from datetime import timedelta

    pending = list(
        PushTicket.objects.filter(
            status=PushTicket.STATUS_PENDING,
            created_at__lte=now - timedelta(seconds=RECEIPT_MIN_AGE_SECONDS),
            created_at__gte=now - timedelta(hours=RECEIPT_MAX_AGE_HOURS),
        ).order_by("created_at")[:RECEIPT_BATCH_SIZE]
    )

    # Anything older than the retention window will never get a receipt.
    expired = PushTicket.objects.filter(
        status=PushTicket.STATUS_PENDING,
        created_at__lt=now - timedelta(hours=RECEIPT_MAX_AGE_HOURS),
    ).update(status=PushTicket.STATUS_EXPIRED, checked_at=now)

    if not pending:
        return {"checked": 0, "ok": 0, "errors": 0, "expired": expired}

    by_id = {t.ticket_id: t for t in pending}
    receipts, err = fetch_expo_receipts(list(by_id.keys()))
    if err:
        logger.warning("expo_receipts_fetch_failed err=%s", err)
        return {"checked": 0, "ok": 0, "errors": 0, "expired": expired, "fetch_error": err}

    ok_count = 0
    error_count = 0
    fatal_codes: dict[str, int] = {}

    for tid, receipt in receipts.items():
        ticket = by_id.get(tid)
        if ticket is None or not isinstance(receipt, dict):
            continue
        ticket.checked_at = now
        if receipt.get("status") == "ok":
            ticket.status = PushTicket.STATUS_OK
            ok_count += 1
            ticket.save(update_fields=["status", "checked_at"])
            continue

        details = receipt.get("details") or {}
        code = str(details.get("error") or "") if isinstance(details, dict) else ""
        ticket.status = PushTicket.STATUS_ERROR
        ticket.error_code = code[:64]
        ticket.detail = str(receipt.get("message") or "")[:1000]
        ticket.save(update_fields=["status", "error_code", "detail", "checked_at"])
        error_count += 1

        if code == "DeviceNotRegistered" and ticket.token:
            # Guard the empty token: an unfiltered clear would match every profile
            # whose token is "" and null them all in one statement.
            _clear_stale_expo_token(ticket.token, user_id=ticket.user_id)
        elif code in FATAL_RECEIPT_ERRORS:
            fatal_codes[code] = fatal_codes.get(code, 0) + 1

    if fatal_codes:
        # Sender-side breakage: not one user's problem, the whole channel's.
        logger.error(
            "expo_push_credentials_broken codes=%s — push is failing at the gateway for "
            "every device. Check `eas credentials` (iOS push key still present in Apple "
            "Developer?) and the FCM server key.",
            fatal_codes,
        )

    logger.info(
        "expo_receipts_polled checked=%s ok=%s errors=%s expired=%s",
        len(receipts),
        ok_count,
        error_count,
        expired,
    )
    return {
        "checked": len(receipts),
        "ok": ok_count,
        "errors": error_count,
        "expired": expired,
        "fatal": fatal_codes,
    }


@shared_task
def prune_push_tickets(days: int = 7) -> int:
    """Drop resolved tickets older than `days`; the table is a diagnostic buffer."""
    from datetime import timedelta

    from django.utils import timezone as dj_timezone

    from notifications.models import PushTicket

    cutoff = dj_timezone.now() - timedelta(days=days)
    deleted, _ = PushTicket.objects.filter(created_at__lt=cutoff).delete()
    return deleted


# ---------------------------------------------------------------------------
# AI-generated push nudges
# ---------------------------------------------------------------------------


@shared_task(bind=True, max_retries=1)
def send_ai_nudge_task(self, user_pk: int) -> str:
    """
    Generate a personalised AI nudge and route it via the channel resolver:
    push when the user has a mobile token, email otherwise.
    """
    User = get_user_model()
    try:
        user = User.objects.select_related("profile").get(pk=user_pk)
    except User.DoesNotExist:
        return "skipped_no_user"

    # Hard opt-out check BEFORE any AI generation. Cheap, avoids LLM cost on
    # users who unsubscribed via CIO (mirrored back to prefs.marketing).
    try:
        from authentication.models import UserEmailPreference

        prefs = UserEmailPreference.objects.filter(user=user).first()
        if prefs and not prefs.marketing:
            return "skipped_marketing_off"
    except Exception:
        logger.warning("marketing preference check failed for user_pk=%s", user_pk, exc_info=True)

    try:
        from education.services.ai_tutor import generate_push_nudge

        nudge_text = generate_push_nudge(user=user)
        if not nudge_text:
            return "skipped_no_nudge"

        svc = NotificationService()
        svc.sync_user_profile(user)
        result = svc.send_marketing_nudge(
            user,
            push_template=CioTemplate.AI_NUDGE,
            email_template=CioTemplate.REMINDER_MONTHLY,
            push_data={"message": nudge_text, "user_id": user_pk},
            email_data={
                "message": nudge_text,
                "user_id": user_pk,
                "customer_name": user.first_name or user.username or "there",
            },
            smtp_subject="A quick nudge from Garzoni",
            smtp_template="emails/reminder_monthly.html",
            smtp_context={"nudge_text": nudge_text},
            purpose="ai_nudge",
        )
        logger.info("ai_nudge_dispatched user=%s outcome=%s", user_pk, result)
        return result
    except Exception as exc:
        logger.error("ai_nudge_task_error user=%s", user_pk, exc_info=True)
        raise self.retry(exc=exc)


@shared_task
def send_ai_nudges_batch() -> dict:
    """
    DISABLED 2026-05-30. This task previously blasted every active user with an
    "AI nudge" daily at 09:00; the email fallback re-used CioTemplate.REMINDER_MONTHLY
    (subject "A quick check-in from garzoni"), which generated daily-email complaints
    and reached unsubscribed users because the SMTP fallback did not consult CIO's
    unsubscribe state. The Celery beat entry is also removed in settings/celery.py.

    Kept as a no-op so DB-scheduled (django_celery_beat) entries that still reference
    this task name do not crash. To re-enable, gate per user on:
      - prefs.marketing == True
      - last_ai_nudge_sent older than N days (recommend 7)
      - resolve_channels(...) prefers push, never email
    """
    if not getattr(settings, "AI_NUDGES_BATCH_ENABLED", False):
        logger.info("ai_nudges_batch_disabled")
        return {"sent": 0, "skipped": 0, "disabled": True}

    User = get_user_model()
    from django.utils import timezone
    from django.core.cache import cache

    today = timezone.now().date().isoformat()
    sent = 0
    skipped = 0

    users = User.objects.filter(is_active=True).select_related("profile")[:500]

    for user in users:
        cache_key = f"ai_nudge_sent:{user.id}:{today}"
        if cache.get(cache_key):
            skipped += 1
            continue
        try:
            send_ai_nudge_task.delay(user.pk)
            cache.set(cache_key, 1, timeout=90_000)
            sent += 1
        except Exception:
            skipped += 1

    logger.info("ai_nudges_batch_queued sent=%s skipped=%s", sent, skipped)
    return {"sent": sent, "skipped": skipped}

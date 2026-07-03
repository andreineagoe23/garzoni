"""
Background tasks for budgeting and the Personal CFO report.

These tasks are intentionally idempotent and side-effect-bounded so they can be
scheduled with Celery Beat without risk of duplicate notifications.
"""

from __future__ import annotations

import logging
from datetime import timedelta

from celery import shared_task
from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.db.models import Q
from django.utils import timezone

from budgeting.models import (
    BudgetEnvelope,
    LinkedAccount,
    SpendingAnomaly,
    Transaction,
)
from budgeting.services.providers import (
    NormalizedTransaction,
    get_provider,
)
from budgeting.services.summaries import (
    get_or_compute_summary,
    recompute_summary,
)

logger = logging.getLogger(__name__)


@shared_task(ignore_result=True)
def sync_linked_accounts_task() -> int:
    """Pull recent transactions for every active linked account.

    Returns the number of accounts processed. Idempotent: transactions are
    deduplicated by ``(user, provider_transaction_id)``.
    """

    provider = get_provider()
    if not provider.status().enabled:
        return 0

    cutoff = (timezone.now() - timedelta(days=30)).date().isoformat()
    accounts = LinkedAccount.objects.filter(status=LinkedAccount.Status.ACTIVE)
    processed = 0
    for account in accounts.iterator():
        try:
            transactions = provider.fetch_transactions(account.user, cutoff)
        except Exception as exc:  # pragma: no cover - defensive
            logger.warning("Budgeting sync failed for account %s: %s", account.id, exc)
            LinkedAccount.objects.filter(pk=account.pk).update(
                status=LinkedAccount.Status.ERROR, last_error=str(exc)[:500]
            )
            continue
        upsert_normalized_transactions(account, transactions)
        LinkedAccount.objects.filter(pk=account.pk).update(
            last_synced_at=timezone.now(), last_error=""
        )
        processed += 1
    return processed


def upsert_normalized_transactions(account: LinkedAccount, transactions) -> int:
    """Insert new transactions for ``account``. Returns inserted count."""

    inserted = 0
    for tx in transactions:
        if not isinstance(tx, NormalizedTransaction):
            continue
        existing = Transaction.objects.filter(
            user=account.user,
            provider_transaction_id=tx.provider_transaction_id,
        ).exists()
        if existing:
            continue
        Transaction.objects.create(
            user=account.user,
            account=account,
            provider_transaction_id=tx.provider_transaction_id,
            source=Transaction.Source.PROVIDER,
            amount=tx.amount,
            currency=tx.currency,
            description=tx.description,
            merchant_name=tx.merchant_name,
            posted_at=tx.posted_at,
            provider_category_raw=tx.provider_category_raw,
            is_pending=tx.is_pending,
        )
        inserted += 1
    if inserted:
        # Force a fresh summary so dashboards reflect the new data.
        recompute_summary(account.user)
    return inserted


@shared_task(ignore_result=True, time_limit=90)
def generate_cfo_narrative_task(user_id: int) -> bool:
    """Generate the AI CFO narrative off the request path and cache it.

    Context is rebuilt here (not passed in) so a task that sat in the queue
    while the user's finances changed stores the narrative under the hash of
    the data it actually described. The per-user enqueue lock is released on
    every exit path so a failed generation can be retried by the next view.
    """

    from budgeting.services.dashboard import (
        CFO_NARRATIVE_CACHE_TTL,
        build_dashboard_context,
        context_hash,
        generate_ai_narrative,
        invalidate_cfo_dashboard_cache,
        narrative_cache_key,
    )

    User = get_user_model()
    try:
        user = User.objects.get(pk=user_id)
        ctx = build_dashboard_context(user)
        text = generate_ai_narrative(user, ctx)
        if not text:
            return False
        cache.set(
            narrative_cache_key(user_id, context_hash(ctx)),
            text,
            CFO_NARRATIVE_CACHE_TTL,
        )
        # Cached dashboard payloads embed the (stale, pending) ai block.
        invalidate_cfo_dashboard_cache(user_id)
        return True
    finally:
        cache.delete(f"cfo_ai_lock:{user_id}")


@shared_task(ignore_result=True)
def recompute_summaries_task() -> int:
    """Refresh the current-period summary for every user with budget data.

    Refreshes both Plus and Pro users who have either envelopes or recent
    transactions.
    """

    User = get_user_model()
    cutoff = timezone.now() - timedelta(days=45)
    user_ids = (
        User.objects.filter(
            Q(budget_envelopes__is_active=True) | Q(transactions__posted_at__gte=cutoff.date())
        )
        .values_list("id", flat=True)
        .distinct()
    )
    count = 0
    for uid in user_ids:
        try:
            user = User.objects.get(pk=uid)
            recompute_summary(user)
            count += 1
        except Exception as exc:  # pragma: no cover - defensive
            logger.warning("Recompute summary failed for user %s: %s", uid, exc)
    return count


@shared_task(ignore_result=True)
def send_weekly_cfo_reports() -> int:
    """Generate a Personal CFO digest and send via the notifications layer.

    This task is intentionally cautious:
      * runs only on Plus/Pro users with active CFO data,
      * skips users with no envelopes, no transactions, and no anomalies,
      * does not retry on individual user failures.
    """

    from authentication.entitlements import get_user_plan, plan_allows
    from notifications.events import NotificationEvents

    User = get_user_model()
    candidates = User.objects.filter(
        Q(budget_envelopes__is_active=True)
        | Q(transactions__isnull=False)
        | Q(spending_anomalies__resolved_at__isnull=True)
    ).distinct()
    sent = 0
    events = NotificationEvents()
    for user in candidates.iterator():
        plan = get_user_plan(user)
        if not plan_allows(plan, "plus"):
            continue
        try:
            summary = get_or_compute_summary(user)
        except Exception as exc:  # pragma: no cover - defensive
            logger.warning("CFO report aggregation failed: %s", exc)
            continue
        anomalies = SpendingAnomaly.objects.filter(user=user, resolved_at__isnull=True).count()
        if (
            summary.total_income == 0
            and summary.total_spent == 0
            and anomalies == 0
            and not BudgetEnvelope.objects.filter(user=user, is_active=True).exists()
        ):
            continue
        try:
            events.track(
                user,
                "personal_cfo_weekly_report",
                {
                    "currency": summary.currency,
                    "total_income": float(summary.total_income),
                    "total_spent": float(summary.total_spent),
                    "net_cash_flow": float(summary.net_cash_flow),
                    "anomaly_count": anomalies,
                },
            )
        except Exception as exc:  # pragma: no cover - defensive
            logger.warning("CFO weekly report dispatch failed: %s", exc)
            continue
        sent += 1
    return sent

"""
Persistence + plan allowances for statement imports.

Analysing a statement is free for every signed-in user (see
``StatementPreviewView``) — that is the hook. *Saving* it, so spending is
tracked month over month and feeds the Personal CFO, is what consumes the free
trial allowance and then requires Plus/Pro.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from decimal import Decimal
from typing import Dict, Optional, Sequence

from django.conf import settings
from django.db import transaction as db_transaction

from budgeting.models import StatementImport, Transaction
from budgeting.services.categorization import categorize, display_merchant, ensure_categories
from budgeting.services.statements import ParsedRow, ParsedStatement

logger = logging.getLogger(__name__)


def _setting(name: str, default: int) -> int:
    return int(getattr(settings, name, default))


@dataclass(frozen=True)
class ImportAllowance:
    """What this user may do right now."""

    plan: str
    is_paid: bool
    max_rows: int
    max_bytes: int
    free_limit: int
    used: int
    remaining: Optional[int]  # None == unlimited
    can_save: bool

    def as_dict(self) -> Dict:
        return {
            "plan": self.plan,
            "is_paid": self.is_paid,
            "max_rows": self.max_rows,
            "max_file_bytes": self.max_bytes,
            "free_saves_total": self.free_limit,
            "free_saves_used": self.used,
            "free_saves_remaining": self.remaining,
            "can_save": self.can_save,
        }


def get_allowance(user, plan: str) -> ImportAllowance:
    """Resolve upload limits and remaining free saves for ``user``.

    Free saves are counted from persisted ``StatementImport`` rows rather than
    a cache counter, so the allowance survives restarts and cannot be reset by
    signing out.
    """
    from authentication.entitlements import plan_allows

    is_paid = plan_allows(plan, "plus")
    free_limit = _setting("BUDGETING_FREE_STATEMENT_IMPORTS", 3)

    if is_paid:
        return ImportAllowance(
            plan=plan,
            is_paid=True,
            max_rows=_setting("BUDGETING_MAX_STATEMENT_ROWS", 5000),
            max_bytes=_setting("BUDGETING_MAX_STATEMENT_BYTES", 5 * 1024 * 1024),
            free_limit=free_limit,
            used=0,
            remaining=None,
            can_save=True,
        )

    used = StatementImport.objects.filter(
        user=user, was_trial=True, status=StatementImport.Status.COMPLETED
    ).count()
    remaining = max(free_limit - used, 0)
    return ImportAllowance(
        plan=plan,
        is_paid=False,
        max_rows=_setting("BUDGETING_FREE_STATEMENT_ROWS", 400),
        max_bytes=_setting("BUDGETING_FREE_STATEMENT_BYTES", 1024 * 1024),
        free_limit=free_limit,
        used=used,
        remaining=remaining,
        can_save=remaining > 0,
    )


def _to_transaction(
    user,
    row: ParsedRow,
    categories,
    statement: StatementImport,
) -> Transaction:
    slug = categorize(row.description, row.amount, row.raw_category)
    return Transaction(
        user=user,
        account=None,
        statement_import=statement,
        provider_transaction_id=row.fingerprint,
        source=Transaction.Source.CSV,
        amount=row.amount,
        currency=row.currency or statement.currency,
        description=row.description[:256],
        merchant_name=display_merchant(row.description)[:128],
        posted_at=row.posted_at,
        is_pending=False,
        category=categories.get(slug),
        provider_category_raw=slug[:128],
    )


@db_transaction.atomic
def commit_statement(
    user,
    parsed: ParsedStatement,
    *,
    filename: str,
    is_trial: bool,
) -> StatementImport:
    """Persist a parsed statement, skipping rows already imported.

    Deduplication rides the existing ``(user, provider_transaction_id)``
    constraint using the content fingerprint, so re-uploading an overlapping
    statement is safe and idempotent.
    """
    statement = StatementImport.objects.create(
        user=user,
        filename=(filename or "")[:128],
        dialect_slug=parsed.dialect_slug,
        dialect_label=parsed.dialect_label,
        currency=parsed.currency,
        period_start=parsed.period_start,
        period_end=parsed.period_end,
        skipped_count=parsed.skipped_rows,
        was_trial=is_trial,
    )

    slugs = {categorize(row.description, row.amount, row.raw_category) for row in parsed.rows}
    categories = ensure_categories(slugs)

    existing = set(
        Transaction.objects.filter(
            user=user,
            provider_transaction_id__in=[r.fingerprint for r in parsed.rows],
        ).values_list("provider_transaction_id", flat=True)
    )

    to_create = []
    seen_in_file: set = set()
    duplicates = 0
    for row in parsed.rows:
        if row.fingerprint in existing or row.fingerprint in seen_in_file:
            duplicates += 1
            continue
        seen_in_file.add(row.fingerprint)
        to_create.append(_to_transaction(user, row, categories, statement))

    if to_create:
        Transaction.objects.bulk_create(to_create, batch_size=500)

    income = sum((t.amount for t in to_create if t.amount > 0), Decimal("0"))
    spent = sum((-t.amount for t in to_create if t.amount < 0), Decimal("0"))

    statement.created_count = len(to_create)
    statement.duplicate_count = duplicates
    statement.total_income = income
    statement.total_spent = spent
    statement.save(
        update_fields=[
            "created_count",
            "duplicate_count",
            "total_income",
            "total_spent",
        ]
    )

    logger.info(
        "statement_import user=%s dialect=%s created=%s duplicates=%s trial=%s",
        user.id,
        parsed.dialect_slug,
        len(to_create),
        duplicates,
        is_trial,
    )
    return statement


def revert_statement(user, statement: StatementImport) -> int:
    """Delete the transactions an import created and mark it reverted.

    This is the user-facing undo *and* the erasure path — the transactions are
    hard-deleted, not flagged.
    """
    with db_transaction.atomic():
        deleted, _ = Transaction.objects.filter(user=user, statement_import=statement).delete()
        statement.status = StatementImport.Status.REVERTED
        statement.save(update_fields=["status"])
    return deleted


def recompute_affected_periods(user, parsed_or_statement) -> None:
    """Refresh cached monthly summaries for every month the import touched.

    Accepts either a :class:`ParsedStatement` or a persisted
    :class:`StatementImport` — both expose ``period_start``/``period_end``.
    Recomputing also invalidates the Personal CFO dashboard cache, so imported
    spending shows up there immediately.
    """
    from datetime import date, timedelta

    from budgeting.services.summaries import recompute_summary

    start = getattr(parsed_or_statement, "period_start", None)
    end = getattr(parsed_or_statement, "period_end", None)
    if not start or not end:
        return
    cursor = date(start.year, start.month, 1)
    guard = 0
    # Guard bounds the loop at 3 years: a pathological statement should not
    # trigger an unbounded recompute.
    while cursor <= end and guard < 36:
        recompute_summary(user, ref=cursor)
        cursor = (cursor + timedelta(days=32)).replace(day=1)
        guard += 1


def statement_history(user, limit: int = 20) -> Sequence[StatementImport]:
    return list(StatementImport.objects.filter(user=user).order_by("-created_at")[:limit])

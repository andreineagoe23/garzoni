"""
AI commentary on a parsed statement.

Privacy contract (see ``docs/banking/open-banking-plan.md``): the model only
ever sees **category totals and ratios**. Merchant names, transaction
descriptions and individual amounts never leave the server. That is also why
this module rebuilds the prompt from a validated numeric payload rather than
forwarding anything the client sent as text — there is no free-text path from
a statement into the prompt, so a merchant string cannot carry an injection.

Runs on the request path behind its own endpoint (not inside preview) so that
uploading a statement stays fast and an OpenAI outage degrades to the
deterministic insights instead of blocking the whole tool.
"""

from __future__ import annotations

import logging
from decimal import Decimal, InvalidOperation
from typing import Dict, List, Optional

from django.conf import settings

from budgeting.services.categorization import CATEGORY_LABELS, label_for

logger = logging.getLogger(__name__)

MAX_CATEGORIES = 10
MODEL = getattr(settings, "OPENAI_MODEL_EXTRACTION", "gpt-4.1-nano")

SYSTEM_PROMPT = (
    "You are a UK/Romania personal finance coach reviewing one bank statement. "
    "You are given category totals only — you cannot see individual "
    "transactions or merchant names, so never claim to. "
    "Write 3 short bullet points, each one sentence, in this order: "
    "(1) the single most important pattern in the numbers, "
    "(2) the most realistic place to cut, with the actual figure, "
    "(3) one concrete action for next month. "
    "Use the currency given. Be direct and specific, never preachy. "
    "Do not invent figures that are not in the data. "
    "Do not give regulated investment advice. "
    "Return plain text bullets starting with '- ', nothing else."
)


def _decimal(value, default: str = "0") -> Decimal:
    try:
        return Decimal(str(value))
    except (InvalidOperation, TypeError, ValueError):
        return Decimal(default)


def build_prompt_context(payload: Dict) -> Optional[Dict]:
    """Validate a client-supplied analysis into a numbers-only context.

    Everything is coerced: category identity must be a known slug, every other
    field must be a number. Anything else is dropped rather than passed along.
    """
    if not isinstance(payload, dict):
        return None

    totals = payload.get("totals") or {}
    spent = _decimal(totals.get("spent"))
    if spent <= 0:
        return None

    currency = str(payload.get("currency") or "").strip().upper()[:3]
    if len(currency) != 3 or not currency.isalpha():
        currency = ""

    categories: List[Dict] = []
    for row in (payload.get("categories") or [])[:MAX_CATEGORIES]:
        if not isinstance(row, dict):
            continue
        slug = str(row.get("category") or "").strip().lower()
        if slug not in CATEGORY_LABELS:
            continue
        categories.append(
            {
                "label": label_for(slug),
                "spent": _decimal(row.get("spent")),
                "share": _decimal(row.get("share")),
            }
        )
    if not categories:
        return None

    essentials = payload.get("essentials") or {}
    rhythm = payload.get("rhythm") or {}

    return {
        "currency": currency,
        "days_covered": int(_decimal(payload.get("days_covered"))),
        "income": _decimal(totals.get("income")),
        "spent": spent,
        "net": _decimal(totals.get("net")),
        "categories": categories,
        "discretionary": _decimal(essentials.get("discretionary")),
        "essential": _decimal(essentials.get("essential")),
        "weekend_share": _decimal(rhythm.get("weekend_share")),
        "recurring_total": _decimal(payload.get("recurring_total")),
        "recurring_count": int(_decimal(payload.get("recurring_count"))),
    }


def _render(context: Dict) -> str:
    currency = context["currency"]
    lines = [
        f"currency={currency}",
        f"days_covered={context['days_covered']}",
        f"total_in={context['income']}",
        f"total_out={context['spent']}",
        f"net={context['net']}",
        f"essential_spend={context['essential']}",
        f"discretionary_spend={context['discretionary']}",
        f"weekend_share_pct={context['weekend_share']}",
        f"recurring_payments={context['recurring_count']}",
        f"recurring_monthly_total={context['recurring_total']}",
        "categories:",
    ]
    for row in context["categories"]:
        lines.append(f"  {row['label']}: {row['spent']} ({row['share']}%)")
    return "\n".join(lines)


def generate_statement_insight(payload: Dict) -> Optional[str]:
    """Return AI bullets for a statement, or ``None`` on any failure.

    Callers always have the deterministic insights to fall back on, so a
    missing key, a timeout or a bad response is never fatal.
    """
    context = build_prompt_context(payload)
    if context is None:
        return None
    if not getattr(settings, "OPENAI_API_KEY", ""):
        return None

    try:
        from openai import OpenAI

        client = OpenAI(api_key=settings.OPENAI_API_KEY, timeout=25.0)
        response = client.chat.completions.create(
            model=MODEL,
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": _render(context)},
            ],
            temperature=0.3,
            max_tokens=300,
        )
        text = (response.choices[0].message.content or "").strip()
        return text or None
    except Exception:
        logger.warning("statement_ai_insight_failed", exc_info=True)
        return None


def parse_bullets(text: str, limit: int = 4) -> List[str]:
    """Split the model's reply into clean bullet strings for the UI."""
    bullets: List[str] = []
    for raw in (text or "").splitlines():
        line = raw.strip().lstrip("-•*").strip()
        if line:
            bullets.append(line[:300])
    return bullets[:limit]

"""
Parse RevenueCat webhook payloads and REST subscriber JSON for trial vs paid state.

RevenueCat distinguishes free trials via `period_type` = TRIAL (webhooks use uppercase;
subscriber.subscription records often use lowercase — we normalize to uppercase).
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone as dt_timezone

from django.utils import timezone as django_timezone

from authentication.revenuecat_products import ENTITLEMENT_PLAN_MAP, PRODUCT_PLAN_MAP, plan_rank

logger = logging.getLogger(__name__)


def parse_iso_datetime_utc(value: str | None) -> datetime | None:
    """Parse RC ISO8601 timestamps (e.g. expires_date) to aware UTC datetime."""
    if not value or not isinstance(value, str):
        return None
    try:
        normalized = value.replace("Z", "+00:00")
        dt = datetime.fromisoformat(normalized)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=dt_timezone.utc)
        return dt
    except (ValueError, TypeError, OSError):
        return None


def parse_expiration_ms(expiration_at_ms: int | float | None) -> datetime | None:
    """Convert RevenueCat webhook `expiration_at_ms` to aware UTC datetime."""
    if expiration_at_ms is None:
        return None
    try:
        ms = float(expiration_at_ms)
        return datetime.fromtimestamp(ms / 1000.0, tz=dt_timezone.utc)
    except (ValueError, TypeError, OSError, OverflowError):
        return None


def normalize_period_type(value: object | None) -> str:
    return str(value or "").strip().upper()


def trial_state_from_rc_entitlement_and_subscription(
    entitlement_data: dict | None,
    subscription_data: dict | None,
) -> tuple[str, datetime | None]:
    """
    Derive (`subscription_status`, `trial_end`) from REST API entitlement + subscription objects.

    Prefer explicit period_type on the entitlement when present; otherwise use the
    subscription record keyed by product_identifier (canonical for store period).
    """
    for payload in (entitlement_data, subscription_data):
        if not payload:
            continue
        pt = normalize_period_type(payload.get("period_type"))
        if pt == "TRIAL":
            expires = payload.get("expires_date")
            trial_end = parse_iso_datetime_utc(expires) if expires else None
            return "trialing", trial_end
    return "active", None


def subscription_status_and_trial_end_from_webhook_event(
    event: dict,
) -> tuple[str, datetime | None]:
    """
    Map a RevenueCat webhook `event` object to subscription_status and trial_end.

    Rules:
    - RENEWAL with `is_trial_conversion` True → user just left free trial; paid period is active.
    - `period_type` TRIAL → trialing; `trial_end` from `expiration_at_ms` when present.
    - Otherwise → active (no trial End date; caller clears stored trial_end).
    """
    event_type = str(event.get("type") or "")

    if event_type == "RENEWAL" and event.get("is_trial_conversion") is True:
        return "active", None

    pt = normalize_period_type(event.get("period_type"))
    if pt == "TRIAL":
        trial_end = parse_expiration_ms(event.get("expiration_at_ms"))
        if trial_end is None:
            logger.warning(
                "[RevenueCat] TRIAL period without usable expiration_at_ms; trial_end unset"
            )
        return "trialing", trial_end

    return "active", None


def _is_entitlement_active(entitlement: dict) -> bool:
    expires = entitlement.get("expires_date")
    if expires is None:
        return True
    try:
        normalized = str(expires).replace("Z", "+00:00")
        exp_dt = datetime.fromisoformat(normalized)
        if exp_dt.tzinfo is None:
            exp_dt = exp_dt.replace(tzinfo=dt_timezone.utc)
        return exp_dt > django_timezone.now()
    except Exception:
        return True


def resolve_plan_and_trial_from_subscriber_payload(
    data: dict,
) -> tuple[str | None, str, datetime | None]:
    """
    From GET /v1/subscribers/{app_user_id} JSON, derive plan, subscription_status, trial_end.

    Returns:
        (plan_id or None, subscription_status, trial_end)
    """
    subscriber = data.get("subscriber") or {}
    entitlements = subscriber.get("entitlements") or {}
    subscriptions = subscriber.get("subscriptions") or {}

    best_plan: str | None = None
    winning_entitlement: dict | None = None

    for ent_key, ent_data in entitlements.items():
        plan = ENTITLEMENT_PLAN_MAP.get(ent_key)
        if not plan:
            continue
        if ent_data.get("expires_date") is None or _is_entitlement_active(ent_data):
            if plan_rank(plan) > plan_rank(best_plan):
                best_plan = plan
                winning_entitlement = ent_data

    if best_plan and winning_entitlement is not None:
        pid = winning_entitlement.get("product_identifier")
        sub_record = subscriptions.get(pid) if pid else None
        status, trial_end = trial_state_from_rc_entitlement_and_subscription(
            winning_entitlement,
            sub_record,
        )
        return best_plan, status, trial_end

    # Fallback: active subscriptions by product ID (misconfigured entitlements)
    best_fb: str | None = None
    fallback_sub: dict | None = None
    for product_id, sub_data in subscriptions.items():
        if sub_data.get("unsubscribe_detected_at") is not None:
            continue
        plan = PRODUCT_PLAN_MAP.get(product_id)
        if plan and plan_rank(plan) > plan_rank(best_fb):
            best_fb = plan
            fallback_sub = sub_data

    if best_fb and fallback_sub is not None:
        status, trial_end = trial_state_from_rc_entitlement_and_subscription(None, fallback_sub)
        return best_fb, status, trial_end

    return None, "active", None

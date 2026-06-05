from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import datetime, timezone as dt_timezone

import requests
import stripe
from django.conf import settings

from authentication.entitlements import normalize_plan_id
from authentication.revenuecat_products import plan_rank
from authentication.services.revenuecat_billing import (
    resolve_plan_and_trial_from_subscriber_payload,
)
from authentication.services.subscriptions import apply_subscription_to_profile
from finance.plan_resolution import (
    plan_id_from_stripe_price_id,
    primary_price_id_from_subscription,
)

logger = logging.getLogger(__name__)

_RC_API_BASE = "https://api.revenuecat.com/v1"
_ACTIVE_STRIPE_STATUSES = {"active", "trialing", "past_due", "unpaid", "incomplete"}


@dataclass
class ProviderState:
    provider: str
    plan: str | None
    status: str
    trial_end: datetime | None = None


def _fetch_rc_subscriber(app_user_id: str) -> dict | None:
    api_key = (getattr(settings, "REVENUECAT_API_KEY", "") or "").strip()
    if not api_key:
        return None
    try:
        resp = requests.get(
            f"{_RC_API_BASE}/subscribers/{app_user_id}",
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            timeout=10,
        )
        if resp.status_code == 200:
            return resp.json()
    except Exception as exc:
        logger.warning(
            "[subscription_reconcile] RevenueCat fetch failed for %s: %s", app_user_id, exc
        )
    return None


def _revenuecat_state(user_id: int, rc_app_user_id: str | None = None) -> ProviderState | None:
    candidates: list[str] = []
    if rc_app_user_id:
        candidates.append(str(rc_app_user_id))
    candidates.append(str(user_id))
    seen: set[str] = set()
    for candidate in candidates:
        if candidate in seen:
            continue
        seen.add(candidate)
        payload = _fetch_rc_subscriber(candidate)
        if not payload:
            continue
        plan, status, trial_end = resolve_plan_and_trial_from_subscriber_payload(payload)
        if plan:
            return ProviderState(
                provider="revenuecat", plan=plan, status=status, trial_end=trial_end
            )
    return None


def _stripe_state(profile) -> ProviderState | None:
    stripe_key = (getattr(settings, "STRIPE_SECRET_KEY", "") or "").strip()
    if not stripe_key:
        return None
    stripe.api_key = stripe_key

    sub = None
    sub_id = (getattr(profile, "stripe_subscription_id", None) or "").strip()
    customer_id = (getattr(profile, "stripe_customer_id", None) or "").strip()

    try:
        if sub_id:
            sub = stripe.Subscription.retrieve(sub_id)
        elif customer_id:
            subs = stripe.Subscription.list(customer=customer_id, status="all", limit=10)
            for item in subs.data:
                if getattr(item, "status", None) in _ACTIVE_STRIPE_STATUSES:
                    sub = item
                    break
        elif getattr(profile.user, "email", None):
            customers = stripe.Customer.list(email=profile.user.email, limit=10)
            for customer in customers.data:
                subs = stripe.Subscription.list(customer=customer.id, status="all", limit=10)
                for item in subs.data:
                    if getattr(item, "status", None) in _ACTIVE_STRIPE_STATUSES:
                        sub = item
                        customer_id = customer.id
                        break
                if sub:
                    break
    except stripe.error.StripeError as exc:
        logger.warning(
            "[subscription_reconcile] Stripe lookup failed for user=%s: %s", profile.user_id, exc
        )
        return None

    if not sub:
        return None

    status = getattr(sub, "status", "active") or "active"
    price_id = primary_price_id_from_subscription(sub)
    mapped_plan = plan_id_from_stripe_price_id(price_id)
    trial_end_raw = getattr(sub, "trial_end", None)
    trial_end = (
        datetime.fromtimestamp(int(trial_end_raw), tz=dt_timezone.utc) if trial_end_raw else None
    )

    if customer_id and not getattr(profile, "stripe_customer_id", None):
        apply_subscription_to_profile(profile, stripe_customer_id=customer_id)
    if getattr(sub, "id", None) and getattr(profile, "stripe_subscription_id", None) != getattr(
        sub, "id", None
    ):
        apply_subscription_to_profile(profile, stripe_subscription_id=getattr(sub, "id", None))
    return ProviderState(provider="stripe", plan=mapped_plan, status=status, trial_end=trial_end)


def reconcile_profile_subscription_state(
    profile,
    *,
    rc_app_user_id: str | None = None,
) -> dict:
    """
    Reconcile profile subscription fields against Stripe and RevenueCat.
    Returns a summary suitable for API responses/logging.
    """
    current_plan = normalize_plan_id(getattr(profile, "subscription_plan_id", None) or "starter")
    states: list[ProviderState] = []
    rc_state = _revenuecat_state(profile.user_id, rc_app_user_id=rc_app_user_id)
    if rc_state:
        states.append(rc_state)
    stripe_state = _stripe_state(profile)
    if stripe_state:
        states.append(stripe_state)

    active_states = [s for s in states if s.plan in {"plus", "pro"} and s.status != "canceled"]
    # An active subscription whose price/product we couldn't map to a plan
    # (e.g. RevenueCat Web Billing mints its own Stripe price ids). Treat this
    # as "unknown but paid" — never downgrade on it, or a plain sync would wipe
    # a real entitlement to starter.
    unmapped_active = [
        s for s in states if s.plan not in {"plus", "pro"} and s.status in _ACTIVE_STRIPE_STATUSES
    ]
    if active_states:
        winner = max(active_states, key=lambda s: plan_rank(s.plan))
        apply_subscription_to_profile(
            profile,
            has_paid=True,
            is_premium=True,
            subscription_plan_id=winner.plan,
            subscription_status=winner.status or "active",
            trial_end=winner.trial_end if winner.status == "trialing" else None,
        )
    elif unmapped_active:
        # Reachable provider reports an active sub we can't map — leave the
        # profile untouched rather than risk downgrading a paying user.
        logger.warning(
            "[subscription_reconcile] user=%s has active provider sub with unmapped "
            "plan (providers=%s); leaving plan unchanged",
            profile.user_id,
            [s.provider for s in unmapped_active],
        )
    elif states:
        # Providers reachable and every subscription is inactive — normalize to starter.
        apply_subscription_to_profile(
            profile,
            has_paid=False,
            is_premium=False,
            subscription_plan_id="starter",
            subscription_status="canceled",
            trial_end=None,
        )

    profile.refresh_from_db()
    return {
        "plan_before": current_plan,
        "plan_after": normalize_plan_id(profile.subscription_plan_id or "starter"),
        "status_after": profile.subscription_status,
        "providers_checked": [s.provider for s in states],
        "providers_active": [s.provider for s in active_states],
    }

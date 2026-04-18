"""Resolve internal plan ids (plus/pro) from Stripe prices and subscription payloads."""

from __future__ import annotations

import logging
from typing import Any, Optional

from django.conf import settings
from django.core.cache import cache

import stripe

logger = logging.getLogger(__name__)


def plan_id_from_stripe_price_id(price_id) -> str | None:
    """Map a Stripe price id back to plus/pro for profile updates."""
    if not price_id:
        return None
    pid = price_id if isinstance(price_id, str) else getattr(price_id, "id", None)
    if not pid:
        return None
    mapping = (
        (getattr(settings, "STRIPE_PRICE_PLUS_YEARLY", None), "plus"),
        (getattr(settings, "STRIPE_PRICE_PLUS_MONTHLY", None), "plus"),
        (getattr(settings, "STRIPE_PRICE_PRO_YEARLY", None), "pro"),
        (getattr(settings, "STRIPE_PRICE_PRO_MONTHLY", None), "pro"),
    )
    for configured, plan in mapping:
        if configured and configured == pid:
            return plan
    return None


def primary_price_id_from_subscription(obj: Any) -> Optional[str]:
    """First subscription line price id from a Stripe Subscription object or webhook dict."""
    if not obj:
        return None
    items = getattr(obj, "items", None)
    if items is None and isinstance(obj, dict):
        items = obj.get("items") or {}
    data = getattr(items, "data", None) if items is not None else None
    if data is None and isinstance(items, dict):
        data = items.get("data") or []
    if not data:
        return None
    first = data[0]
    price_obj = (
        getattr(first, "price", None)
        if not isinstance(first, dict)
        else first.get("price")
    )
    if isinstance(price_obj, str):
        return price_obj
    if price_obj is None:
        return None
    return (
        getattr(price_obj, "id", None)
        if not isinstance(price_obj, dict)
        else price_obj.get("id")
    )


def resolve_checkout_plan(
    *,
    metadata: dict | None,
    subscription=None,
    subscription_id: str | None = None,
) -> str | None:
    """
    Resolve plus/pro for a paid checkout.

    Trusts metadata plan_id only when it normalizes to plus or pro.
    Otherwise uses the subscription's primary Stripe price id.
    """
    from authentication.entitlements import normalize_plan_id

    meta = metadata or {}
    raw = meta.get("plan_id")
    if raw not in (None, ""):
        cand = normalize_plan_id(str(raw))
        if cand in ("plus", "pro"):
            return cand

    sub = subscription
    if sub is None and subscription_id:
        stripe.api_key = getattr(settings, "STRIPE_SECRET_KEY", "") or ""
        if not stripe.api_key:
            return None
        try:
            sub = stripe.Subscription.retrieve(subscription_id)
        except stripe.error.StripeError as e:
            logger.warning("Could not retrieve subscription %s: %s", subscription_id, e)
            return None

    pid = primary_price_id_from_subscription(sub)
    return plan_id_from_stripe_price_id(pid)


def resolve_plan_id_from_profile_stripe(profile) -> str | None:
    """
    Infer plus/pro from Stripe when profile data is missing or inconsistent.

    Cached briefly to avoid hitting Stripe on every entitlements call.
    """
    stripe_key = getattr(settings, "STRIPE_SECRET_KEY", "") or ""
    if not stripe_key:
        return None

    sub_id = (getattr(profile, "stripe_subscription_id", None) or "").strip()
    cache_key = (
        f"stripe_plan_infer_{profile.user_id}"
        if sub_id
        else f"stripe_plan_infer_cust_{profile.user_id}"
    )
    cached = cache.get(cache_key)
    if cached is not None:
        return None if cached == "__none__" else cached

    stripe.api_key = stripe_key
    out: str | None = None
    try:
        if sub_id:
            sub = stripe.Subscription.retrieve(sub_id)
            st = (
                sub.get("status")
                if isinstance(sub, dict)
                else getattr(sub, "status", None)
            )
            if st in ("active", "trialing", "past_due"):
                pid = primary_price_id_from_subscription(sub)
                out = plan_id_from_stripe_price_id(pid)
        else:
            cid = (getattr(profile, "stripe_customer_id", None) or "").strip()
            if cid:
                subs = stripe.Subscription.list(customer=cid, status="all", limit=10)
                for s in subs.data:
                    if getattr(s, "status", None) in ("active", "trialing", "past_due"):
                        pid = primary_price_id_from_subscription(s)
                        out = plan_id_from_stripe_price_id(pid)
                        if out:
                            break
    except stripe.error.StripeError as e:
        logger.info(
            "Stripe plan inference failed for user %s: %s",
            getattr(profile, "user_id", None),
            e,
        )

    cache.set(cache_key, out if out is not None else "__none__", 300)
    return out

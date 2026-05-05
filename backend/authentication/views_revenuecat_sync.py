"""
Synchronous RevenueCat subscriber sync.

Called by the mobile app immediately after a successful purchase to activate
the subscription without waiting for the async webhook. Calls the RevenueCat
REST API directly, maps entitlements to a plan, and updates UserProfile.
"""

from __future__ import annotations

import logging

import requests
from django.conf import settings
from django.core.cache import cache
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from authentication.services.subscriptions import apply_subscription_to_profile
from authentication.views_revenuecat import PRODUCT_PLAN_MAP

logger = logging.getLogger(__name__)

_RC_API_BASE = "https://api.revenuecat.com/v1"
_ENTITLEMENT_PLAN_MAP = {
    "Garzoni Plus": "plus",
    "Garzoni Pro": "pro",
}


def _fetch_rc_subscriber(app_user_id: str) -> dict | None:
    api_key = getattr(settings, "REVENUECAT_API_KEY", "").strip()
    if not api_key:
        logger.error("[RC Sync] REVENUECAT_API_KEY not configured")
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
        logger.warning("[RC Sync] RC API returned %s for user %s", resp.status_code, app_user_id)
    except Exception as exc:
        logger.error("[RC Sync] RC API error: %s", exc)
    return None


_PLAN_RANK = {"starter": 0, "plus": 1, "pro": 2}


def _resolve_plan_from_subscriber(data: dict) -> str | None:
    """
    Extract the highest active plan from a RevenueCat subscriber response.
    Checks entitlements first (most reliable), then active subscriptions.
    Takes the highest-rank plan found to handle misconfigured RC dashboards
    where a Pro product is mapped to the wrong entitlement identifier.
    """
    subscriber = data.get("subscriber", {})
    best: str | None = None

    # Check entitlements (e.g. "Garzoni Pro", "Garzoni Plus")
    entitlements = subscriber.get("entitlements", {})
    for entitlement_id, ent_data in entitlements.items():
        if ent_data.get("expires_date") is None or _is_active(ent_data):
            plan = _ENTITLEMENT_PLAN_MAP.get(entitlement_id)
            if plan and _PLAN_RANK.get(plan, 0) > _PLAN_RANK.get(best or "starter", 0):
                best = plan

    if best:
        return best

    # Fallback: check active subscriptions by product ID
    subscriptions = subscriber.get("subscriptions", {})
    for product_id, sub_data in subscriptions.items():
        if sub_data.get("unsubscribe_detected_at") is None:
            plan = PRODUCT_PLAN_MAP.get(product_id)
            if plan and _PLAN_RANK.get(plan, 0) > _PLAN_RANK.get(best or "starter", 0):
                best = plan

    return best


def _is_active(entitlement: dict) -> bool:
    expires = entitlement.get("expires_date")
    if expires is None:
        return True
    from django.utils import timezone
    from datetime import datetime

    try:
        exp_dt = datetime.fromisoformat(expires.replace("Z", "+00:00"))
        return exp_dt > timezone.now()
    except Exception:
        return True


class RevenueCatSyncView(APIView):
    """
    POST /api/auth/revenuecat-sync/

    Called by mobile immediately after a successful RevenueCat purchase.
    Fetches the subscriber record from RC REST API and activates the plan
    synchronously — no webhook latency.

    Returns:
        { ok: true, plan: "plus"|"pro" }  on success
        { ok: false, error: "..." }        on failure (purchase not yet visible in RC)
    """

    permission_classes = [IsAuthenticated]

    def post(self, request):
        user = request.user
        # Mobile may pass its RC appUserID (e.g. anonymous session) so the
        # backend looks up the right subscriber even when RC user != backend user.
        rc_user_id = request.data.get("rc_app_user_id") or str(user.pk)

        data = _fetch_rc_subscriber(rc_user_id)
        # Fallback: if the RC-provided ID returns nothing, try the backend user PK
        if not data and rc_user_id != str(user.pk):
            data = _fetch_rc_subscriber(str(user.pk))
        if not data:
            return Response({"ok": False, "error": "Could not reach RevenueCat."}, status=502)

        plan = _resolve_plan_from_subscriber(data)
        if not plan:
            return Response(
                {"ok": False, "error": "No active subscription found in RevenueCat."},
                status=200,
            )

        try:
            profile = user.profile
        except Exception:
            return Response({"ok": False, "error": "Profile not found."}, status=404)

        apply_subscription_to_profile(
            profile,
            has_paid=True,
            is_premium=True,
            subscription_status="active",
            subscription_plan_id=plan,
        )

        # Clear entitlement cache so next poll returns the new plan immediately
        from django.utils import timezone

        today = timezone.now().date().isoformat()
        for feature in ("ai_tutor", "personalized_path", "ai_explain", "ai_voice", "ai_scan"):
            cache.delete(f"entitlement:{feature}:{user.id}:{today}")

        logger.info("[RC Sync] Activated plan=%s for user=%s", plan, user.pk)
        return Response({"ok": True, "plan": plan})

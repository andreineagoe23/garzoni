"""
Synchronous RevenueCat subscriber sync.

Called by the mobile app immediately after a successful purchase to activate
the subscription without waiting for the async webhook. Calls the RevenueCat
REST API directly, maps entitlements to a plan, and updates UserProfile.
"""

from __future__ import annotations

import logging

from django.core.cache import cache
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from authentication.services.subscription_reconciliation import (
    reconcile_profile_subscription_state,
)

logger = logging.getLogger(__name__)


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
        # Always bind to the authenticated backend user — never trust client-supplied RC IDs.
        rc_user_id = str(user.pk)

        try:
            profile = user.profile
        except Exception:
            return Response({"ok": False, "error": "Profile not found."}, status=404)

        summary = reconcile_profile_subscription_state(
            profile,
            rc_app_user_id=rc_user_id,
        )

        # Clear entitlement cache so next poll returns the new plan immediately
        from django.utils import timezone

        today = timezone.now().date().isoformat()
        for feature in ("ai_tutor", "personalized_path", "ai_explain", "ai_voice", "ai_scan"):
            cache.delete(f"entitlement:{feature}:{user.id}:{today}")

        plan = profile.subscription_plan_id or "starter"
        if plan not in ("plus", "pro"):
            return Response(
                {"ok": False, "error": "No active subscription found in RevenueCat.", **summary},
                status=200,
            )

        logger.info(
            "[RC Sync] Reconciled plan=%s status=%s user=%s summary=%s",
            plan,
            profile.subscription_status,
            user.pk,
            summary,
        )
        return Response(
            {
                "ok": True,
                "plan": plan,
                "subscription_status": profile.subscription_status,
                **summary,
            }
        )

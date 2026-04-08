"""
RevenueCat webhook handler for iOS In-App Purchases.

RevenueCat sends a POST to this endpoint when a subscription event occurs
(purchase, renewal, cancellation, etc.). It updates the user's subscription
plan in the same way the Stripe webhook does, using the shared
apply_subscription_to_profile() function.

Setup steps:
1. Add REVENUECAT_WEBHOOK_SECRET to your backend .env (any random string;
   set the same value in RevenueCat Dashboard → Project → Integrations →
   Webhooks → Authorization header).
2. Create App Store Connect products matching PRODUCT_PLAN_MAP keys below.
3. Add the webhook URL to RevenueCat: POST /api/auth/revenuecat-webhook/
"""

import hashlib
import hmac
import logging

from django.conf import settings
from django.contrib.auth.models import User
from rest_framework.permissions import AllowAny
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from authentication.models import UserProfile
from authentication.services.subscriptions import apply_subscription_to_profile

logger = logging.getLogger(__name__)

# Map RevenueCat product identifier → internal plan ID.
# Update these to match the product IDs you create in App Store Connect.
PRODUCT_PLAN_MAP: dict[str, str] = {
    "app.garzoni.mobile.plus_monthly": "plus",
    "app.garzoni.mobile.plus_yearly": "plus",
    "app.garzoni.mobile.pro_monthly": "pro",
    "app.garzoni.mobile.pro_yearly": "pro",
}

# RevenueCat event types that activate a subscription.
ACTIVE_EVENTS = {"INITIAL_PURCHASE", "RENEWAL", "UNCANCELLATION", "SUBSCRIBER_ALIAS"}
# Events that deactivate a subscription.
INACTIVE_EVENTS = {"CANCELLATION", "EXPIRATION", "BILLING_ISSUE"}


def _verify_authorization(request: Request) -> bool:
    """
    Verify that the request carries the shared webhook secret.
    RevenueCat sends it as a plain Bearer token in the Authorization header.
    Set REVENUECAT_WEBHOOK_SECRET in your environment to a random secret and
    paste the same value in RevenueCat → Integrations → Webhooks.
    """
    secret = getattr(settings, "REVENUECAT_WEBHOOK_SECRET", "").strip()
    if not secret:
        if not settings.DEBUG:
            logger.error(
                "[RevenueCat] REVENUECAT_WEBHOOK_SECRET is not set in production. "
                "Rejecting webhook request."
            )
            return False
        # Development only: accept without verification but warn loudly.
        logger.warning(
            "[RevenueCat] REVENUECAT_WEBHOOK_SECRET is not set. "
            "All webhook requests are accepted without verification."
        )
        return True

    auth_header = request.META.get("HTTP_AUTHORIZATION", "")
    provided = auth_header.removeprefix("Bearer ").strip()

    # Use constant-time comparison to prevent timing attacks.
    return hmac.compare_digest(
        hashlib.sha256(provided.encode()).digest(),
        hashlib.sha256(secret.encode()).digest(),
    )


class RevenueCatWebhookView(APIView):
    """Receive RevenueCat subscription lifecycle events and sync to UserProfile."""

    permission_classes = [AllowAny]
    # Disable CSRF for webhook endpoints (they authenticate via the shared secret).
    authentication_classes = []

    def post(self, request: Request) -> Response:
        if not _verify_authorization(request):
            logger.warning("[RevenueCat] Rejected webhook: bad Authorization header.")
            return Response({"error": "Unauthorized"}, status=401)

        event: dict = request.data.get("event", {})
        event_type: str = event.get("type", "")
        app_user_id: str | None = event.get("app_user_id") or event.get("original_app_user_id")
        product_id: str = event.get("product_id", "")

        logger.info(
            "[RevenueCat] event=%s user=%s product=%s",
            event_type,
            app_user_id,
            product_id,
        )

        if not app_user_id:
            # No user to update — acknowledge so RevenueCat doesn't retry.
            return Response({"ok": True})

        # Resolve the Django user.  RevenueCat app_user_id is set to the
        # Django user PK (str) in billing.tsx via Purchases.configure({ appUserID }).
        try:
            user = User.objects.select_related("userprofile").get(pk=int(app_user_id))
            profile: UserProfile = user.userprofile
        except (ValueError, User.DoesNotExist, UserProfile.DoesNotExist):
            logger.warning("[RevenueCat] User not found for app_user_id=%s", app_user_id)
            # Return 200 so RevenueCat doesn't retry indefinitely.
            return Response({"ok": True})

        plan_id = PRODUCT_PLAN_MAP.get(product_id)

        if event_type in ACTIVE_EVENTS and plan_id:
            apply_subscription_to_profile(
                profile,
                has_paid=True,
                is_premium=True,
                subscription_status="active",
                subscription_plan_id=plan_id,
            )
            logger.info("[RevenueCat] Activated plan=%s for user=%s", plan_id, user.pk)

        elif event_type in INACTIVE_EVENTS:
            apply_subscription_to_profile(
                profile,
                has_paid=False,
                is_premium=False,
                subscription_status="cancelled",
                subscription_plan_id="starter",
            )
            logger.info("[RevenueCat] Deactivated subscription for user=%s", user.pk)

        else:
            logger.debug("[RevenueCat] Ignored event_type=%s for user=%s", event_type, user.pk)

        return Response({"ok": True})

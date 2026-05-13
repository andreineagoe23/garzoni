from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.views import APIView
from rest_framework.response import Response
from django.conf import settings

from authentication.entitlements import (
    check_and_consume_entitlement,
    entitlement_usage_snapshot,
    get_entitlements_for_user,
    get_plan_catalog,
    normalize_plan_id,
)
from authentication.models import UserProfile


class EntitlementsView(APIView):
    """Expose the current user's plan and entitlement limits."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        entitlements = get_entitlements_for_user(request.user)
        entitlements["usage"] = entitlement_usage_snapshot(request.user)
        try:
            profile = UserProfile.objects.get(user=request.user)
        except UserProfile.DoesNotExist:
            profile = None
        if profile is not None:
            entitlements["status"] = profile.subscription_status
            te = profile.trial_end
            trial_iso = te.isoformat() if te else None
            entitlements["trial_end"] = trial_iso
            entitlements["trialEnd"] = trial_iso
            entitlements.setdefault("billing_interval", None)
            entitlements.setdefault("billingInterval", None)
            # Derive plan from fresh profile — get_entitlements_for_user may have
            # read a stale cached profile via user.profile accessor.
            fresh_plan = normalize_plan_id(profile.subscription_plan_id or "")
            if fresh_plan in ("plus", "pro"):
                entitlements["plan"] = fresh_plan
            plan = entitlements.get("plan")
            entitlements["entitled"] = plan in ("plus", "pro")
            billing_interval = None
            if getattr(profile, "stripe_subscription_id", None):
                try:
                    from finance.plan_resolution import (
                        resolve_billing_interval_from_profile_stripe,
                    )

                    billing_interval = resolve_billing_interval_from_profile_stripe(profile)
                except Exception:
                    billing_interval = None
            entitlements["billing_interval"] = billing_interval
            entitlements["billingInterval"] = billing_interval
        return Response(entitlements)


class ConsumeEntitlementView(APIView):
    """Consume a unit from an entitlement if the user is allowed to use it."""

    permission_classes = [IsAuthenticated]

    def post(self, request):
        feature = request.data.get("feature")
        if not feature:
            return Response({"error": "Feature is required."}, status=status.HTTP_400_BAD_REQUEST)

        amount = request.data.get("amount", 1)
        allowed, meta = check_and_consume_entitlement(request.user, feature, amount)
        status_code = status.HTTP_200_OK

        if not allowed:
            status_code = (
                status.HTTP_402_PAYMENT_REQUIRED
                if meta.get("reason") == "upgrade"
                else status.HTTP_429_TOO_MANY_REQUESTS
            )

        response_payload = {
            "feature": feature,
            "allowed": allowed,
            **{k: v for k, v in meta.items() if k != "error"},
        }

        if not allowed:
            response_payload["error"] = meta.get("error", "Feature unavailable.")

        return Response(response_payload, status=status_code)


class PlansView(APIView):
    """Expose subscription plan catalog for pricing pages."""

    permission_classes = [AllowAny]

    def get(self, request):
        return Response(get_plan_catalog(settings))

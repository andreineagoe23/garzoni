from django.conf import settings
from rest_framework.throttling import AnonRateThrottle, UserRateThrottle

from authentication.entitlements import get_user_plan


class ContactRateThrottle(AnonRateThrottle):
    """
    Rate limit the contact form to prevent spam.
    """

    scope = "contact"

    def get_rate(self):
        return getattr(settings, "CONTACT_THROTTLE_RATE", "5/min")


class OpenRouterPlanRateThrottle(UserRateThrottle):
    """
    Per-user rate limits for OpenRouter proxy, with higher limits for premium users.
    """

    scope = "openrouter"

    def get_rate(self):
        # DRF will call get_rate before allow_request; we can use self.request if present.
        request = getattr(self, "request", None)
        user = getattr(request, "user", None) if request else None
        if user and getattr(user, "is_authenticated", False):
            plan = get_user_plan(user)
            if plan == "premium":
                return getattr(settings, "OPENROUTER_THROTTLE_RATE_PREMIUM", "120/min")
            return getattr(settings, "OPENROUTER_THROTTLE_RATE_FREE", "30/min")
        # Shouldn't happen for OpenRouter (auth required) but keep safe.
        return getattr(settings, "OPENROUTER_THROTTLE_RATE_FREE", "30/min")

    def allow_request(self, request, view):
        # Make request visible to get_rate().
        self.request = request
        return super().allow_request(request, view)

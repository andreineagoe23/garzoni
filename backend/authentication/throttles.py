import sys

from django.conf import settings
from rest_framework.throttling import AnonRateThrottle, UserRateThrottle


def _in_unit_tests() -> bool:
    """True when Django/pytest test runners are active (shared anon IP would throttle the suite)."""
    if "pytest" in sys.modules:
        return True
    # python manage.py test …
    return len(sys.argv) >= 2 and sys.argv[1] == "test"


class LoginRateThrottle(AnonRateThrottle):
    """
    Throttle login attempts to reduce brute-force risk.

    Uses IP-based throttling (AnonRateThrottle). For more advanced lockout rules,
    consider django-axes.
    """

    scope = "login"

    def allow_request(self, request, view):
        if _in_unit_tests():
            return True
        return super().allow_request(request, view)

    def get_rate(self):
        return getattr(settings, "LOGIN_THROTTLE_RATE", "10/min")


class RefreshRateThrottle(AnonRateThrottle):
    """Throttle token refresh requests per IP."""

    scope = "refresh"

    def allow_request(self, request, view):
        if _in_unit_tests():
            return True
        return super().allow_request(request, view)

    def get_rate(self):
        return getattr(settings, "REFRESH_THROTTLE_RATE", "20/min")


class RegisterRateThrottle(AnonRateThrottle):
    """Throttle registration attempts per IP."""

    scope = "register"

    def allow_request(self, request, view):
        if _in_unit_tests():
            return True
        return super().allow_request(request, view)

    def get_rate(self):
        return getattr(settings, "REGISTER_THROTTLE_RATE", "5/min")


class PasswordResetRateThrottle(AnonRateThrottle):
    """Throttle password reset requests per IP."""

    scope = "password_reset"

    def allow_request(self, request, view):
        if _in_unit_tests():
            return True
        return super().allow_request(request, view)

    def get_rate(self):
        return getattr(settings, "PASSWORD_RESET_THROTTLE_RATE", "5/hour")


class HeartsGrantRateThrottle(UserRateThrottle):
    """Limit hearts grant abuse per authenticated user."""

    scope = "hearts_grant"

    def allow_request(self, request, view):
        if _in_unit_tests():
            return True
        return super().allow_request(request, view)

    def get_rate(self):
        return getattr(settings, "HEARTS_GRANT_THROTTLE_RATE", "20/day")


class HeartsRefillRateThrottle(UserRateThrottle):
    """Limit hearts refill abuse per authenticated user."""

    scope = "hearts_refill"

    def allow_request(self, request, view):
        if _in_unit_tests():
            return True
        return super().allow_request(request, view)

    def get_rate(self):
        return getattr(settings, "HEARTS_REFILL_THROTTLE_RATE", "30/day")


class FunnelEventRateThrottle(AnonRateThrottle):
    """Throttle anonymous funnel event ingestion."""

    scope = "funnel_events"

    def allow_request(self, request, view):
        if _in_unit_tests():
            return True
        return super().allow_request(request, view)

    def get_rate(self):
        return getattr(settings, "FUNNEL_EVENT_THROTTLE_RATE", "120/hour")


class PushTokenRateThrottle(AnonRateThrottle):
    """Throttle push token registration changes per authenticated user."""

    scope = "push_token"

    def get_cache_key(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return None
        ident = str(request.user.pk)
        return self.cache_format % {"scope": self.scope, "ident": ident}

    def allow_request(self, request, view):
        if _in_unit_tests():
            return True
        return super().allow_request(request, view)

    def get_rate(self):
        return getattr(settings, "PUSH_TOKEN_THROTTLE_RATE", "10/hour")

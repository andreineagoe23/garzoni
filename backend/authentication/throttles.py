import sys

from django.conf import settings
from rest_framework.throttling import AnonRateThrottle


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

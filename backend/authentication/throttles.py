from django.conf import settings
from rest_framework.throttling import AnonRateThrottle


class LoginRateThrottle(AnonRateThrottle):
    """
    Throttle login attempts to reduce brute-force risk.

    Uses IP-based throttling (AnonRateThrottle). For more advanced lockout rules,
    consider django-axes.
    """

    scope = "login"

    def get_rate(self):
        return getattr(settings, "LOGIN_THROTTLE_RATE", "10/min")


class RefreshRateThrottle(AnonRateThrottle):
    """Throttle token refresh requests per IP."""

    scope = "refresh"

    def get_rate(self):
        return getattr(settings, "REFRESH_THROTTLE_RATE", "20/min")


class RegisterRateThrottle(AnonRateThrottle):
    """Throttle registration attempts per IP."""

    scope = "register"

    def get_rate(self):
        return getattr(settings, "REGISTER_THROTTLE_RATE", "5/min")


class PasswordResetRateThrottle(AnonRateThrottle):
    """Throttle password reset requests per IP."""

    scope = "password_reset"

    def get_rate(self):
        return getattr(settings, "PASSWORD_RESET_THROTTLE_RATE", "5/hour")

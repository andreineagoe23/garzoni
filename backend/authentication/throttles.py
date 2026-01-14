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
    """
    Throttle token refresh attempts to reduce abuse risk.

    Uses IP-based throttling (AnonRateThrottle).
    """

    scope = "refresh"

    def get_rate(self):
        return getattr(settings, "REFRESH_THROTTLE_RATE", "30/min")

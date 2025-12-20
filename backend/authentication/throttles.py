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

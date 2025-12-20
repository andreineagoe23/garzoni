from django.conf import settings
from rest_framework.throttling import UserRateThrottle


class FinanceExternalRateThrottle(UserRateThrottle):
    """
    Throttle endpoints that proxy external finance APIs to protect upstream rate limits.
    """

    scope = "finance_external"

    def get_rate(self):
        return getattr(settings, "FINANCE_EXTERNAL_THROTTLE_RATE", "60/min")

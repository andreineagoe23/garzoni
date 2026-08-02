from django.conf import settings
from rest_framework.throttling import UserRateThrottle


class StatementUploadThrottle(UserRateThrottle):
    """Bound statement parsing, which is CPU-bound and free to every signed-in
    user. Keeps the free analysis hook from becoming a cheap DoS vector."""

    scope = "statement_upload"

    def get_rate(self):
        return getattr(settings, "BUDGETING_STATEMENT_THROTTLE_RATE", "20/hour")

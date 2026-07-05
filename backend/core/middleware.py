import uuid

from core.logging import clear_request_id, set_request_id


class RequestIdMiddleware:
    """
    Adds a request correlation id.

    - Accepts inbound `X-Request-ID` if provided
    - Otherwise generates a new id
    - Returns it on every response as `X-Request-ID`
    """

    request_header = "HTTP_X_REQUEST_ID"
    response_header = "X-Request-ID"

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        rid = request.META.get(self.request_header) or uuid.uuid4().hex
        request.request_id = rid
        set_request_id(rid)
        try:
            import sentry_sdk

            sentry_sdk.set_tag("request_id", rid)
        except Exception:
            pass
        try:
            response = self.get_response(request)
            try:
                response[self.response_header] = rid
            except Exception:
                pass
            return response
        finally:
            clear_request_id()


class LastSeenPlatformMiddleware:
    """Stamp profile.last_seen_at (+ platform) at most once per user per hour."""

    CACHE_TTL_SECONDS = 3600

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)
        user = getattr(request, "user", None)
        if not user or not getattr(user, "is_authenticated", False):
            return response

        from django.core.cache import cache

        from authentication.services.profile_analytics import touch_last_seen
        from core.request_platform import resolve_request_platform

        platform = resolve_request_platform(request)

        cache_key = f"garzoni:last_seen:{user.pk}"
        if cache.get(cache_key):
            return response

        if touch_last_seen(user, platform):
            cache.set(cache_key, 1, self.CACHE_TTL_SECONDS)
        return response

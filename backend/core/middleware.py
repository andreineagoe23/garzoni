import uuid


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
        response = self.get_response(request)
        try:
            response[self.response_header] = rid
        except Exception:
            pass
        return response

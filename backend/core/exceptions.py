from rest_framework.views import exception_handler


def api_exception_handler(exc, context):
    response = exception_handler(exc, context)

    if response is None:
        return response

    detail = response.data.get("detail", None)
    if detail is None:
        detail = response.data

    response.data = {
        "detail": detail,
        "error": detail,
    }
    return response

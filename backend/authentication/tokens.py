from django.conf import settings

def set_jwt_cookies(response, access_token, refresh_token):
    """
    Set JWT tokens in cookies.

    This function sets the access token and refresh token in the response cookies.
    By default both cookies behave like session cookies, but their lifetime can be
    configured via the `SIMPLE_JWT` settings.
    """
    auth_cookie = settings.SIMPLE_JWT.get('AUTH_COOKIE', 'access_token')
    refresh_cookie = settings.SIMPLE_JWT.get('AUTH_COOKIE_REFRESH', 'refresh_token')

    common_cookie_kwargs = {
        "httponly": True,
        "secure": settings.SIMPLE_JWT.get('AUTH_COOKIE_SECURE', not settings.DEBUG),
        "samesite": settings.SIMPLE_JWT.get('AUTH_COOKIE_SAMESITE', "None" if not settings.DEBUG else "Lax"),
        "path": "/",
    }

    auth_cookie_max_age = settings.SIMPLE_JWT.get('AUTH_COOKIE_MAX_AGE')
    refresh_cookie_max_age = settings.SIMPLE_JWT.get('AUTH_COOKIE_REFRESH_MAX_AGE')

    auth_cookie_kwargs = dict(common_cookie_kwargs)
    if auth_cookie_max_age:
        auth_cookie_kwargs["max_age"] = auth_cookie_max_age

    refresh_cookie_kwargs = dict(common_cookie_kwargs)
    if refresh_cookie_max_age:
        refresh_cookie_kwargs["max_age"] = refresh_cookie_max_age

    response.set_cookie(
        key=auth_cookie,
        value=access_token,
        **auth_cookie_kwargs,
    )
    response.set_cookie(
        key=refresh_cookie,
        value=refresh_token,
        **refresh_cookie_kwargs,
    )
    return response


def delete_jwt_cookies(response):
    """
    Delete JWT tokens from cookies.

    This function removes the access token and refresh token from the response cookies.
    It ensures that the user's authentication cookies are cleared.
    """
    auth_cookie = settings.SIMPLE_JWT.get('AUTH_COOKIE', 'access_token')
    refresh_cookie = settings.SIMPLE_JWT.get('AUTH_COOKIE_REFRESH', 'refresh_token')

    delete_kwargs = {
        "path": "/",
        "samesite": settings.SIMPLE_JWT.get(
            "AUTH_COOKIE_SAMESITE", "None" if not settings.DEBUG else "Lax"
        ),
    }
    response.delete_cookie(auth_cookie, **delete_kwargs)
    response.delete_cookie(refresh_cookie, **delete_kwargs)
    return response


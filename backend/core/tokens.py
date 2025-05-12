from django.conf import settings

def set_jwt_cookies(response, access_token, refresh_token):
    """
    Set JWT tokens in cookies.

    This function sets the access token and refresh token in the response cookies.
    The access token is stored with a 1-day expiration, and the refresh token is stored
    with a 7-day expiration. The cookie settings such as `httponly`, `secure`, and `samesite`
    are configurable via the `SIMPLE_JWT` settings.
    """
    auth_cookie = settings.SIMPLE_JWT.get('AUTH_COOKIE', 'access_token')
    refresh_cookie = settings.SIMPLE_JWT.get('AUTH_COOKIE_REFRESH', 'refresh_token')

    print(f"✅ Setting Access Token in Cookie: {access_token}")
    print(f"✅ Setting Refresh Token in Cookie: {refresh_token}")

    response.set_cookie(
        key=auth_cookie,
        value=access_token,
        httponly=True,
        secure=settings.SIMPLE_JWT.get('AUTH_COOKIE_SECURE', False),
        samesite=settings.SIMPLE_JWT.get('AUTH_COOKIE_SAMESITE', 'Lax'),
        max_age=3600 * 24,
    )
    response.set_cookie(
        key=refresh_cookie,
        value=refresh_token,
        httponly=True,
        secure=settings.SIMPLE_JWT.get('AUTH_COOKIE_SECURE', False),
        samesite=settings.SIMPLE_JWT.get('AUTH_COOKIE_SAMESITE', 'Lax'),
        max_age=3600 * 24 * 7,
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

    response.delete_cookie(auth_cookie)
    response.delete_cookie(refresh_cookie)
    return response

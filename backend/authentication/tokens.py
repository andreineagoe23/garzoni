import logging

from django.conf import settings

logger = logging.getLogger(__name__)


def revoke_all_user_tokens(user) -> int:
    """Blacklist every outstanding refresh token for a user.

    Called after a password change or reset so previously issued sessions
    (including any an attacker may hold after an account takeover) can no
    longer be refreshed. Access tokens are stateless and remain valid until
    they expire (ACCESS_TOKEN_LIFETIME, 30 min), which bounds the window.

    Returns the count of tokens newly blacklisted. No-op (returns 0) if the
    simplejwt blacklist app isn't installed.
    """
    if user is None or not getattr(user, "pk", None):
        return 0
    try:
        from rest_framework_simplejwt.token_blacklist.models import (
            BlacklistedToken,
            OutstandingToken,
        )
    except Exception:
        return 0

    count = 0
    for token in OutstandingToken.objects.filter(user=user):
        _, created = BlacklistedToken.objects.get_or_create(token=token)
        if created:
            count += 1
    return count


def set_jwt_cookies(response, access_token, refresh_token):
    """
    Set JWT tokens in cookies.

    This function sets the access token and refresh token in the response cookies.
    By default both cookies behave like session cookies, but their lifetime can be
    configured via the `SIMPLE_JWT` settings.
    """
    auth_cookie = settings.SIMPLE_JWT.get("AUTH_COOKIE", "access_token")
    refresh_cookie = settings.SIMPLE_JWT.get("AUTH_COOKIE_REFRESH", "refresh_token")

    common_cookie_kwargs = {
        "httponly": True,
        "secure": settings.SIMPLE_JWT.get("AUTH_COOKIE_SECURE", not settings.DEBUG),
        "samesite": settings.SIMPLE_JWT.get(
            "AUTH_COOKIE_SAMESITE", "None" if not settings.DEBUG else "Lax"
        ),
        "path": "/",
    }

    auth_cookie_max_age = settings.SIMPLE_JWT.get("AUTH_COOKIE_MAX_AGE")
    refresh_cookie_max_age = settings.SIMPLE_JWT.get("AUTH_COOKIE_REFRESH_MAX_AGE")

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
    auth_cookie = settings.SIMPLE_JWT.get("AUTH_COOKIE", "access_token")
    refresh_cookie = settings.SIMPLE_JWT.get("AUTH_COOKIE_REFRESH", "refresh_token")

    delete_kwargs = {
        "path": "/",
        "samesite": settings.SIMPLE_JWT.get(
            "AUTH_COOKIE_SAMESITE", "None" if not settings.DEBUG else "Lax"
        ),
    }
    response.delete_cookie(auth_cookie, **delete_kwargs)
    response.delete_cookie(refresh_cookie, **delete_kwargs)
    return response

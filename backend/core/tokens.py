from rest_framework_simplejwt.tokens import RefreshToken
from django.conf import settings
from django.http import JsonResponse

def set_jwt_cookies(response, access_token, refresh_token):
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
        max_age=3600 * 24,  # 1 day expiration
    )
    response.set_cookie(
        key=refresh_cookie,
        value=refresh_token,
        httponly=True,
        secure=settings.SIMPLE_JWT.get('AUTH_COOKIE_SECURE', False),
        samesite=settings.SIMPLE_JWT.get('AUTH_COOKIE_SAMESITE', 'Lax'),
        max_age=3600 * 24 * 7,  # 7 days expiration
    )
    return response


def delete_jwt_cookies(response):
    """Delete JWT tokens from cookies"""
    auth_cookie = settings.SIMPLE_JWT.get('AUTH_COOKIE', 'access_token')
    refresh_cookie = settings.SIMPLE_JWT.get('AUTH_COOKIE_REFRESH', 'refresh_token')

    response.delete_cookie(auth_cookie)
    response.delete_cookie(refresh_cookie)
    return response

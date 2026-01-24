import logging
import os

from rest_framework import generics, status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenRefreshView
from rest_framework_simplejwt.exceptions import TokenError
from django.contrib.auth.models import User
from django.http import JsonResponse
from django.conf import settings
from django.middleware.csrf import get_token
from django.views.decorators.csrf import ensure_csrf_cookie
from core.utils import env_bool
from core.http_client import request_with_backoff
import requests

from authentication.serializers import RegisterSerializer
from authentication.tokens import delete_jwt_cookies
from authentication.throttles import LoginRateThrottle, RefreshRateThrottle, RegisterRateThrottle

logger = logging.getLogger(__name__)

REFRESH_COOKIE_NAME = "refresh_token"
DEFAULT_REFRESH_MAX_AGE = 0


def _get_refresh_cookie_kwargs():
    """Build keyword arguments for setting the refresh token cookie."""
    secure = env_bool("REFRESH_COOKIE_SECURE", not settings.DEBUG)
    default_samesite = "None" if secure else "Lax"
    samesite = os.getenv("REFRESH_COOKIE_SAMESITE", default_samesite)
    max_age_setting = os.getenv("REFRESH_TOKEN_MAX_AGE")
    max_age = DEFAULT_REFRESH_MAX_AGE

    if max_age_setting is not None:
        cleaned_value = max_age_setting.strip().lower()
        if cleaned_value in {"session", "none", ""}:
            max_age = 0
        else:
            try:
                max_age = int(cleaned_value)
            except ValueError:
                logger.warning(
                    "Invalid REFRESH_TOKEN_MAX_AGE value '%s'; falling back to session cookie.",
                    max_age_setting,
                )
                max_age = 0

    cookie_kwargs = {
        "httponly": True,
        "secure": secure,
        "samesite": samesite,
        "path": "/",
    }

    if max_age > 0:
        cookie_kwargs["max_age"] = max_age

    cookie_domain = os.getenv("REFRESH_COOKIE_DOMAIN")
    if cookie_domain:
        cookie_kwargs["domain"] = cookie_domain

    return cookie_kwargs


def set_refresh_cookie(response, token: str):
    """Attach the refresh token cookie to the response."""
    response.set_cookie(REFRESH_COOKIE_NAME, token, **_get_refresh_cookie_kwargs())


def clear_refresh_cookie(response):
    """Remove the refresh token cookie from the response."""
    base_kwargs = _get_refresh_cookie_kwargs()
    delete_kwargs = {k: v for k, v in base_kwargs.items() if k in {"path", "domain", "samesite"}}
    response.delete_cookie(REFRESH_COOKIE_NAME, **delete_kwargs)


def verify_recaptcha(token):
    """Verify the reCAPTCHA token with Google's API"""
    try:
        url = "https://www.google.com/recaptcha/api/siteverify"
        data = {"secret": settings.RECAPTCHA_PRIVATE_KEY, "response": token}
        result = request_with_backoff(
            method="POST",
            url=url,
            data=data,
            allow_retry=False,
            max_attempts=1,
        )
        response = result.response
        result = response.json()
        return (
            result.get("success", False)
            and result.get("score", 0) >= settings.RECAPTCHA_REQUIRED_SCORE
        )
    except requests.Timeout:
        logger.warning("reCAPTCHA verification timed out")
        return False
    except Exception as exc:
        logger.error("reCAPTCHA verification error: %s", exc)
        return False


@ensure_csrf_cookie
def get_csrf_token(request):
    """Retrieve and return a CSRF token for the client."""
    token = get_token(request)
    return JsonResponse({"csrfToken": token})


class LogoutView(APIView):
    """Handles user logout by clearing JWT cookies."""

    permission_classes = [AllowAny]

    def post(self, request):
        """Handle POST requests to log out the user and clear cookies."""
        refresh_token = request.COOKIES.get(REFRESH_COOKIE_NAME)

        if refresh_token:
            try:
                token_obj = RefreshToken(refresh_token)
                token_obj.blacklist()
            except Exception as exc:
                logger.info("Logout refresh blacklist failed (best-effort): %s", exc)

        response = JsonResponse({"message": "Logout successful."})
        response = delete_jwt_cookies(response)
        clear_refresh_cookie(response)
        return response


class LoginSecureView(APIView):
    """Enhanced login view that uses HttpOnly cookies for refresh tokens and returns access tokens."""

    permission_classes = [AllowAny]
    throttle_classes = [LoginRateThrottle]

    def post(self, request):
        """Handle POST requests to authenticate users and issue tokens."""
        username = request.data.get("username")
        password = request.data.get("password")

        logger.info("Login attempt for username: %s", username)

        if not username or not password:
            logger.warning("Login attempt with missing credentials")
            return Response({"detail": "Username and password are required."}, status=400)

        try:
            user = User.objects.get(username=username)
            if not user.check_password(password):
                logger.warning("Invalid password for %s", username)
                return Response({"detail": "Invalid username or password."}, status=401)

            refresh = RefreshToken.for_user(user)
            access_token = str(refresh.access_token)
            refresh_token = str(refresh)

            logger.info("Successful login for %s", username)

            response = Response(
                {
                    "access": access_token,
                    "user": {
                        "id": user.id,
                        "username": user.username,
                        "email": user.email,
                        "first_name": user.first_name,
                        "last_name": user.last_name,
                        "is_staff": user.is_staff,
                        "is_superuser": user.is_superuser,
                    },
                }
            )

            set_refresh_cookie(response, refresh_token)

            from django.utils.timezone import now

            user.last_login = now()
            user.save(update_fields=["last_login"])

            return response

        except User.DoesNotExist:
            logger.warning("Login attempt for non-existent user: %s", username)
            return Response({"detail": "Invalid username or password."}, status=401)
        except Exception as exc:
            logger.error("Login error: %s", exc)
            return Response({"detail": "An error occurred during login."}, status=500)


class RegisterSecureView(generics.CreateAPIView):
    """Enhanced registration view that uses HttpOnly cookies for refresh tokens."""

    serializer_class = RegisterSerializer
    permission_classes = [AllowAny]
    throttle_classes = [RegisterRateThrottle]

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()

        refresh = RefreshToken.for_user(user)
        access_token = str(refresh.access_token)

        response = Response(
            {
                "access": access_token,
                "user": {
                    "id": user.id,
                    "username": user.username,
                    "email": user.email,
                    "first_name": user.first_name,
                    "last_name": user.last_name,
                    "is_staff": user.is_staff,
                    "is_superuser": user.is_superuser,
                },
                "next": "/all-topics",
            },
            status=status.HTTP_201_CREATED,
        )

        set_refresh_cookie(response, str(refresh))

        return response


class VerifyAuthView(APIView):
    """Verify authentication using DRF's built-in authentication pipeline."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        return Response(
            {
                "isAuthenticated": True,
                "user": {
                    "id": user.id,
                    "username": user.username,
                    "email": user.email,
                    "is_staff": user.is_staff,
                    "is_superuser": user.is_superuser,
                },
            }
        )


class CustomTokenRefreshView(TokenRefreshView):
    """Custom token refresh view that extracts the refresh token from cookies."""

    permission_classes = [AllowAny]
    throttle_classes = [RefreshRateThrottle]

    def post(self, request, *args, **kwargs):
        refresh_token = request.COOKIES.get(REFRESH_COOKIE_NAME)

        if not refresh_token:
            logger.error("No refresh token cookie provided for refresh endpoint")
            return Response({"detail": "No refresh token provided."}, status=400)

        serializer = self.get_serializer(data={"refresh": refresh_token})

        try:
            serializer.is_valid(raise_exception=True)
        except TokenError as exc:
            logger.error("Token refresh error: %s", exc)
            response = Response({"detail": str(exc)}, status=401)
            clear_refresh_cookie(response)
            return response
        except Exception as exc:
            logger.error("Unexpected error during token refresh: %s", exc, exc_info=True)
            return Response(
                {"detail": "An error occurred during token refresh."},
                status=500,
            )

        try:
            import jwt
            from rest_framework_simplejwt.settings import api_settings

            decoded_token = jwt.decode(
                refresh_token,
                settings.SECRET_KEY,
                algorithms=[api_settings.ALGORITHM],
                options={"verify_signature": False},
            )
            user_id = decoded_token.get("user_id")

            if user_id:
                User.objects.get(id=user_id)
        except User.DoesNotExist:
            logger.error("Token refresh attempted for missing user id=%s", user_id)
            response = Response(
                {"detail": "User not found", "code": "user_not_found"},
                status=401,
            )
            clear_refresh_cookie(response)
            return response
        except TokenError as exc:
            logger.warning("Refresh token blacklisted during user validation: %s", exc)
            response = Response({"detail": "Token is blacklisted."}, status=401)
            clear_refresh_cookie(response)
            return response
        except Exception as exc:
            logger.warning(
                "Could not validate user from refresh token (non-critical): %s",
                exc,
            )

        response_data = serializer.validated_data
        access_token = response_data.get("access")

        if not access_token:
            logger.error("Token refresh failed to provide an access token")
            return Response({"detail": "Token refresh failed."}, status=401)

        response = Response({"access": access_token}, status=status.HTTP_200_OK)

        if settings.SIMPLE_JWT.get("ROTATE_REFRESH_TOKENS", False):
            new_refresh_token = response_data.get("refresh")
            if new_refresh_token:
                set_refresh_cookie(response, new_refresh_token)
                logger.info("Refresh token rotated and cookie updated")
        else:
            set_refresh_cookie(response, refresh_token)

        return response

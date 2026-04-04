import logging
import os

from rest_framework import generics, status
from rest_framework.serializers import ValidationError
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenRefreshView
from rest_framework_simplejwt.exceptions import TokenError
from django.contrib.auth.models import User

from authentication.user_display import user_display_dict
from django.http import JsonResponse
from django.conf import settings
from django.middleware.csrf import get_token
from django.views.decorators.csrf import ensure_csrf_cookie
from core.utils import env_bool
from core.http_client import request_with_backoff
import requests

from authentication.serializers import RegisterSerializer
from authentication.tokens import delete_jwt_cookies
from authentication.throttles import (
    LoginRateThrottle,
    RefreshRateThrottle,
    RegisterRateThrottle,
)

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


def _recaptcha_required():
    """True if any reCAPTCHA backend is configured (Enterprise or legacy v3)."""
    if getattr(settings, "RECAPTCHA_DISABLED", False):
        return False
    if (
        getattr(settings, "RECAPTCHA_SITE_KEY", "").strip()
        and getattr(settings, "RECAPTCHA_ENTERPRISE_PROJECT_ID", "").strip()
        and getattr(settings, "RECAPTCHA_ENTERPRISE_API_KEY", "").strip()
    ):
        return True
    return bool(getattr(settings, "RECAPTCHA_PRIVATE_KEY", "").strip())


def _is_mobile_auth_client(request):
    """Native apps cannot run reCAPTCHA; send client_type or platform with value 'mobile'."""
    ct = (request.data.get("client_type") or "").strip().lower()
    plat = (request.data.get("platform") or "").strip().lower()
    return ct == "mobile" or plat == "mobile"


def verify_recaptcha_enterprise(token, expected_action, request):
    """Verify reCAPTCHA Enterprise token via createAssessment API. Returns True if valid and score OK."""
    project_id = getattr(settings, "RECAPTCHA_ENTERPRISE_PROJECT_ID", "").strip()
    api_key = getattr(settings, "RECAPTCHA_ENTERPRISE_API_KEY", "").strip()
    site_key = getattr(settings, "RECAPTCHA_SITE_KEY", "").strip()
    if not project_id or not api_key or not site_key:
        return False
    try:
        url = f"https://recaptchaenterprise.googleapis.com/v1/projects/{project_id}/assessments"
        user_agent = request.META.get("HTTP_USER_AGENT", "") or ""
        xff = request.META.get("HTTP_X_FORWARDED_FOR")
        user_ip = (xff.split(",")[0].strip() if xff else None) or request.META.get(
            "REMOTE_ADDR", ""
        )
        payload = {
            "event": {
                "token": token,
                "siteKey": site_key,
                "expectedAction": expected_action,
                "userAgent": user_agent,
                "userIpAddress": user_ip,
            }
        }
        result = request_with_backoff(
            method="POST",
            url=url,
            params={"key": api_key},
            json=payload,
            allow_retry=False,
            max_attempts=1,
        )
        resp = result.response
        if resp.status_code != 200:
            logger.warning(
                "reCAPTCHA Enterprise API error: status=%s url=%s body=%s",
                resp.status_code,
                url,
                resp.text[:800],
            )
            if resp.status_code == 403:
                logger.warning(
                    "reCAPTCHA Enterprise 403: use Google Cloud **project ID** in "
                    "RECAPTCHA_ENTERPRISE_PROJECT_ID (not a site key or internal id); "
                    "ensure the API key allows recaptchaenterprise.googleapis.com. "
                    "Local bypass: RECAPTCHA_DISABLED=1 in backend/.env."
                )
            return False
        body = resp.json()
        token_props = body.get("tokenProperties") or {}
        risk = body.get("riskAnalysis") or {}
        if not token_props.get("valid", False):
            logger.warning(
                "reCAPTCHA Enterprise token invalid: invalidReason=%s full_token_props=%s",
                token_props.get("invalidReason", "unknown"),
                token_props,
            )
            return False
        if token_props.get("action") != expected_action:
            logger.warning(
                "reCAPTCHA Enterprise action mismatch: got %s expected %s",
                token_props.get("action"),
                expected_action,
            )
            return False
        score = risk.get("score")
        required = getattr(settings, "RECAPTCHA_REQUIRED_SCORE", 0.3)
        if score is not None and score < required:
            logger.warning(
                "reCAPTCHA Enterprise score too low: score=%.2f required=%.2f",
                score,
                required,
            )
            return False
        return True
    except requests.Timeout:
        logger.warning("reCAPTCHA Enterprise verification timed out")
        return False
    except Exception as exc:
        logger.error("reCAPTCHA Enterprise verification error: %s", exc, exc_info=True)
        return False


def verify_recaptcha(token):
    """Verify the reCAPTCHA v3 token with Google's siteverify API (legacy)."""
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
        body = response.json()
        success = body.get("success", False)
        score = body.get("score")
        required = getattr(settings, "RECAPTCHA_REQUIRED_SCORE", 0.5)

        if not success:
            logger.warning(
                "reCAPTCHA verify failed: success=False error-codes=%s",
                body.get("error-codes", []),
            )
            return False
        if score is not None and score < required:
            logger.warning(
                "reCAPTCHA score too low: score=%.2f required=%.2f",
                score,
                required,
            )
            return False
        return True
    except requests.Timeout:
        logger.warning("reCAPTCHA verification timed out")
        return False
    except Exception as exc:
        logger.error("reCAPTCHA verification error: %s", exc, exc_info=True)
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
        refresh_token = request.COOKIES.get(REFRESH_COOKIE_NAME) or (
            (request.data.get("refresh") or "").strip() or None
        )

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

        # reCAPTCHA: when configured (Enterprise or legacy v3), require valid token (web only)
        if _recaptcha_required() and not _is_mobile_auth_client(request):
            token = (request.data.get("recaptcha_token") or "").strip()
            if not token:
                logger.warning("Login rejected: recaptcha_token missing")
                return Response(
                    {
                        "detail": "Security verification is required. Please refresh the page and try again, or sign in with Google.",
                        "code": "recaptcha_missing",
                    },
                    status=400,
                )
            if getattr(settings, "RECAPTCHA_ENTERPRISE_PROJECT_ID", "").strip():
                if not verify_recaptcha_enterprise(token, "login", request):
                    logger.warning("Login rejected: recaptcha Enterprise verification failed")
                    return Response(
                        {
                            "detail": "Security verification failed. Please try again.",
                            "code": "recaptcha_failed",
                        },
                        status=400,
                    )
            elif not verify_recaptcha(token):
                logger.warning("Login rejected: recaptcha verification failed")
                return Response(
                    {
                        "detail": "Security verification failed. Please try again.",
                        "code": "recaptcha_failed",
                    },
                    status=400,
                )

        logger.info("Login attempt for username: %s", username)

        if not username or not password:
            logger.warning("Login attempt with missing credentials")
            return Response(
                {"detail": "Username and password are required.", "code": "missing_credentials"},
                status=400,
            )

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
                    "refresh": refresh_token,
                    "user": user_display_dict(
                        user, include_id=True, include_email=True, include_staff=True
                    ),
                }
            )

            set_refresh_cookie(response, refresh_token)

            from django.utils.timezone import now

            user.last_login = now()
            user.save(update_fields=["last_login"])

            return response

        except User.DoesNotExist:
            logger.warning("Login attempt for non-existent user: %s", username)
            return Response(
                {"detail": "Invalid username or password.", "code": "invalid_credentials"},
                status=401,
            )
        except Exception as exc:
            logger.exception("Login error: %s", exc)
            return Response(
                {"detail": "An error occurred during login.", "code": "server_error"},
                status=500,
            )


class RegisterSecureView(generics.CreateAPIView):
    """Enhanced registration view that uses HttpOnly cookies for refresh tokens."""

    serializer_class = RegisterSerializer
    permission_classes = [AllowAny]
    throttle_classes = [RegisterRateThrottle]

    def create(self, request, *args, **kwargs):
        email = (request.data.get("email") or "").strip()
        username = (request.data.get("username") or "").strip()
        logger.info(
            "Register attempt email=%s username=%s", email or "(empty)", username or "(empty)"
        )

        # reCAPTCHA: when configured (Enterprise or legacy v3), require valid token (web only)
        if _recaptcha_required() and not _is_mobile_auth_client(request):
            token = (request.data.get("recaptcha_token") or "").strip()
            if not token:
                logger.warning("Register rejected: recaptcha_token missing")
                return Response(
                    {
                        "detail": "Security verification is required. Please refresh the page and try again, or sign in with Google.",
                        "code": "recaptcha_missing",
                    },
                    status=400,
                )
            if getattr(settings, "RECAPTCHA_ENTERPRISE_PROJECT_ID", "").strip():
                if not verify_recaptcha_enterprise(token, "register", request):
                    logger.warning("Register rejected: recaptcha Enterprise verification failed")
                    return Response(
                        {
                            "detail": "Security verification failed. Please try again.",
                            "code": "recaptcha_failed",
                        },
                        status=400,
                    )
            elif not verify_recaptcha(token):
                logger.warning("Register rejected: recaptcha verification failed")
                return Response(
                    {
                        "detail": "Security verification failed. Please try again.",
                        "code": "recaptcha_failed",
                    },
                    status=400,
                )

        serializer = self.get_serializer(data=request.data)
        try:
            serializer.is_valid(raise_exception=True)
        except ValidationError:
            errs = serializer.errors
            logger.warning("Register validation failed: %s", errs)
            for _field, msgs in errs.items():
                if msgs and isinstance(msgs, (list, tuple)):
                    msg = msgs[0] if isinstance(msgs[0], str) else str(msgs[0])
                    return Response(
                        {"detail": msg, "errors": errs, "code": "validation_error"},
                        status=status.HTTP_400_BAD_REQUEST,
                    )
            return Response(
                {
                    "detail": "Invalid registration data.",
                    "errors": errs,
                    "code": "validation_error",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            user = serializer.save()
        except Exception as exc:
            logger.exception("Register save failed: %s", exc)
            return Response(
                {
                    "detail": "Account could not be created. Please try again or use Sign in with Google.",
                    "code": "server_error",
                },
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        refresh = RefreshToken.for_user(user)
        access_token = str(refresh.access_token)
        logger.info("Register success user_id=%s username=%s", user.id, user.username)

        response = Response(
            {
                "access": access_token,
                "refresh": str(refresh),
                "user": user_display_dict(
                    user, include_id=True, include_email=True, include_staff=True
                ),
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
                "user": user_display_dict(
                    user, include_id=True, include_email=True, include_staff=True
                ),
            }
        )


class CustomTokenRefreshView(TokenRefreshView):
    """Refresh access tokens using refresh JWT from JSON body or httpOnly cookie."""

    permission_classes = [AllowAny]
    throttle_classes = [RefreshRateThrottle]

    def post(self, request, *args, **kwargs):
        refresh_token = (request.data.get("refresh") or "").strip() or request.COOKIES.get(
            REFRESH_COOKIE_NAME
        )

        if not refresh_token:
            logger.error("No refresh token in request body or cookies for refresh endpoint")
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

        payload = {"access": access_token}
        new_refresh_token = response_data.get("refresh")
        if new_refresh_token:
            payload["refresh"] = new_refresh_token

        response = Response(payload, status=status.HTTP_200_OK)

        if settings.SIMPLE_JWT.get("ROTATE_REFRESH_TOKENS", False):
            if new_refresh_token:
                set_refresh_cookie(response, new_refresh_token)
                logger.info("Refresh token rotated and cookie updated")
        else:
            set_refresh_cookie(response, refresh_token)

        return response

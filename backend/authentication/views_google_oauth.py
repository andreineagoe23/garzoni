"""
Google OAuth 2.0 flow for login and register.
- GET /api/auth/google/ redirects to Google consent.
- GET /api/auth/google/callback/ exchanges code, creates or gets user, issues JWT, redirects to frontend.
"""

import logging
import os
import urllib.parse

import requests
from django.conf import settings
from django.contrib.auth.models import User
from django.shortcuts import redirect
from django.utils import timezone
from rest_framework.permissions import AllowAny
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken

from core.utils import env_bool

logger = logging.getLogger(__name__)

REFRESH_COOKIE_NAME = "refresh_token"


def _get_refresh_cookie_kwargs():
    """Build keyword arguments for setting the refresh token cookie (mirrors views_auth)."""
    secure = env_bool("REFRESH_COOKIE_SECURE", not settings.DEBUG)
    default_samesite = "None" if secure else "Lax"
    samesite = os.getenv("REFRESH_COOKIE_SAMESITE", default_samesite)
    max_age_setting = os.getenv("REFRESH_TOKEN_MAX_AGE")
    max_age = 0
    if max_age_setting is not None:
        cleaned = max_age_setting.strip().lower()
        if cleaned not in {"session", "none", ""}:
            try:
                max_age = int(max_age_setting)
            except ValueError:
                pass
    cookie_kwargs = {
        "httponly": True,
        "secure": secure,
        "samesite": samesite,
        "path": "/",
    }
    if max_age > 0:
        cookie_kwargs["max_age"] = max_age
    if os.getenv("REFRESH_COOKIE_DOMAIN"):
        cookie_kwargs["domain"] = os.getenv("REFRESH_COOKIE_DOMAIN")
    return cookie_kwargs


def _set_refresh_cookie(response, token: str):
    """Attach the refresh token cookie to the response."""
    response.set_cookie(REFRESH_COOKIE_NAME, token, **_get_refresh_cookie_kwargs())


GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo"
SCOPES = "openid email profile"


def _get_google_config():
    client_id = getattr(settings, "GOOGLE_OAUTH_CLIENT_ID", "") or ""
    client_secret = getattr(settings, "GOOGLE_OAUTH_CLIENT_SECRET", "") or ""
    return client_id.strip(), client_secret.strip()


class GoogleOAuthInitView(APIView):
    """Redirect the user to Google's OAuth consent screen."""

    permission_classes = [AllowAny]

    def get(self, request):
        client_id, _ = _get_google_config()
        if not client_id:
            logger.warning("Google OAuth not configured: GOOGLE_OAUTH_CLIENT_ID missing")
            frontend_url = getattr(settings, "FRONTEND_URL", "").rstrip("/")
            return redirect(f"{frontend_url}/login?error=oauth_not_configured")

        redirect_uri = request.build_absolute_uri("/api/auth/google/callback/")
        state = request.GET.get("state", "")
        params = {
            "client_id": client_id,
            "redirect_uri": redirect_uri,
            "response_type": "code",
            "scope": SCOPES,
            "access_type": "offline",
            "prompt": "consent",
        }
        if state:
            params["state"] = state
        url = f"{GOOGLE_AUTH_URL}?{urllib.parse.urlencode(params)}"
        return redirect(url)


class GoogleOAuthCallbackView(APIView):
    """Exchange authorization code for tokens, get or create user, issue JWT, redirect to frontend."""

    permission_classes = [AllowAny]

    def get(self, request):
        code = request.GET.get("code")
        state = request.GET.get("state", "")
        error = request.GET.get("error")
        frontend_url = (getattr(settings, "FRONTEND_URL", "") or "").rstrip("/")

        if error:
            logger.warning("Google OAuth error from callback: %s", error)
            return redirect(f"{frontend_url}/login?error=oauth_denied")

        if not code:
            logger.warning("Google OAuth callback missing code")
            return redirect(f"{frontend_url}/login?error=oauth_missing_code")

        client_id, client_secret = _get_google_config()
        if not client_id or not client_secret:
            logger.warning("Google OAuth not configured")
            return redirect(f"{frontend_url}/login?error=oauth_not_configured")

        redirect_uri = request.build_absolute_uri("/api/auth/google/callback/")

        # Exchange code for tokens
        token_data = {
            "code": code,
            "client_id": client_id,
            "client_secret": client_secret,
            "redirect_uri": redirect_uri,
            "grant_type": "authorization_code",
        }
        try:
            token_resp = requests.post(
                GOOGLE_TOKEN_URL,
                data=token_data,
                headers={"Accept": "application/json"},
                timeout=10,
            )
            token_resp.raise_for_status()
            token_json = token_resp.json()
        except requests.RequestException as e:
            logger.exception("Google token exchange failed: %s", e)
            return redirect(f"{frontend_url}/login?error=oauth_token_failed")

        access_token = token_json.get("access_token")
        if not access_token:
            logger.warning("Google token response missing access_token")
            return redirect(f"{frontend_url}/login?error=oauth_token_failed")

        # Fetch user info
        try:
            userinfo_resp = requests.get(
                GOOGLE_USERINFO_URL,
                headers={"Authorization": f"Bearer {access_token}"},
                timeout=10,
            )
            userinfo_resp.raise_for_status()
            userinfo = userinfo_resp.json()
        except requests.RequestException as e:
            logger.exception("Google userinfo failed: %s", e)
            return redirect(f"{frontend_url}/login?error=oauth_userinfo_failed")

        email = (userinfo.get("email") or "").strip()
        if not email:
            logger.warning("Google userinfo missing email")
            return redirect(f"{frontend_url}/login?error=oauth_no_email")

        given_name = (userinfo.get("given_name") or "").strip()
        family_name = (userinfo.get("family_name") or "").strip()
        picture = (userinfo.get("picture") or "").strip()

        # Get or create Django User (username must be unique; use email as base)
        user = User.objects.filter(email__iexact=email).first()
        is_new_user = False
        if user:
            # Login: update last_login
            user.last_login = timezone.now()
            user.save(update_fields=["last_login"])
            # Optionally update profile picture
            if picture and hasattr(user, "profile"):
                if user.profile.profile_avatar != picture:
                    user.profile.profile_avatar = picture
                    user.profile.save(update_fields=["profile_avatar"])
        else:
            is_new_user = True
            # Register: create user with unusable password
            base_username = email.split("@")[0].replace(".", "_")[:25]
            username = base_username
            suffix = 0
            while User.objects.filter(username=username).exists():
                suffix += 1
                username = f"{base_username}_{suffix}"[:30]
            user = User(
                username=username,
                email=email,
                first_name=given_name,
                last_name=family_name,
            )
            user.set_unusable_password()
            user.save()
            # Profile is created by post_save signal; set avatar if we have one
            if picture and hasattr(user, "profile"):
                user.profile.profile_avatar = picture
                user.profile.save(update_fields=["profile_avatar"])

        refresh = RefreshToken.for_user(user)
        access_jwt = str(refresh.access_token)

        # New users go to onboarding; existing use state or default to all-topics
        if is_new_user:
            next_path = "onboarding"
        else:
            next_path = (state.strip() or "all-topics").strip() or "all-topics"
        next_path = next_path.lstrip("/")
        fragment = f"access={urllib.parse.quote(access_jwt)}&next={urllib.parse.quote(next_path)}"
        redirect_to = f"{frontend_url}/auth/callback#{fragment}"

        response = redirect(redirect_to)
        _set_refresh_cookie(response, str(refresh))
        return response

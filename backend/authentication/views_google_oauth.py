"""
Google OAuth 2.0 flow for login and register.
- GET /api/auth/google/ redirects to Google consent.
- GET /api/auth/google/callback exchanges code, creates or gets user, issues JWT, redirects to frontend.
- POST /api/auth/google/verify-credential/ accepts Google One Tap / Sign-in button ID token,
  verifies it, creates or gets user, issues JWT, returns JSON (for in-page sign-in without redirect).
"""

import logging
import os
import re
import secrets
import time
import urllib.parse

import requests
from django.conf import settings
from django.contrib.auth.models import User
from django.core.cache import cache
from django.shortcuts import redirect
from django.utils import timezone
from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken

from authentication.user_display import user_display_dict
from authentication.views_auth import _get_refresh_cookie_kwargs
from core.utils import env_bool

logger = logging.getLogger(__name__)

GOOGLE_TOKENINFO_URL = "https://oauth2.googleapis.com/tokeninfo"
REFRESH_COOKIE_NAME = "refresh_token"

# Allowed Google token issuers
_GOOGLE_ISSUERS = {"accounts.google.com", "https://accounts.google.com"}

# Only allow relative paths or whitelisted destinations as post-login redirect
_ALLOWED_NEXT_RE = re.compile(r'^[a-zA-Z0-9_\-/]*$')
_MAX_NEXT_LEN = 100


def _sanitize_next(next_path: str, default: str = "all-topics") -> str:
    """Return a safe relative path for post-login redirect, or the default."""
    if not next_path:
        return default
    cleaned = next_path.strip().lstrip("/")[:_MAX_NEXT_LEN]
    if not _ALLOWED_NEXT_RE.match(cleaned):
        logger.warning("Unsafe next path rejected")
        return default
    return cleaned


def _set_refresh_cookie(response, token: str):
    """Attach the refresh token cookie to the response (uses shared cookie builder)."""
    response.set_cookie(REFRESH_COOKIE_NAME, token, **_get_refresh_cookie_kwargs())


GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo"
SCOPES = "openid email profile"

_STATE_CACHE_PREFIX = "oauth_state:"
_STATE_TTL = 600  # 10 minutes


def _generate_state(next_path: str = "") -> str:
    """Generate a signed, opaque state token and store it in cache."""
    nonce = secrets.token_urlsafe(32)
    payload = f"{nonce}:{next_path}"
    state = urllib.parse.quote(payload, safe="")
    cache.set(f"{_STATE_CACHE_PREFIX}{nonce}", next_path or "", _STATE_TTL)
    return state


def _consume_state(state: str):
    """
    Validate and consume the state token.  Returns next_path on success, or
    raises ValueError if state is missing, malformed, or already used.
    """
    if not state:
        raise ValueError("Missing OAuth state parameter")
    try:
        payload = urllib.parse.unquote(state)
        nonce, _, next_path = payload.partition(":")
    except Exception:
        raise ValueError("Malformed OAuth state parameter")
    cache_key = f"{_STATE_CACHE_PREFIX}{nonce}"
    stored = cache.get(cache_key)
    if stored is None:
        raise ValueError("OAuth state expired or already used")
    # Consume (one-time use)
    cache.delete(cache_key)
    return stored or next_path or "all-topics"


def _get_google_config():
    client_id = getattr(settings, "GOOGLE_OAUTH_CLIENT_ID", "") or ""
    client_secret = getattr(settings, "GOOGLE_OAUTH_CLIENT_SECRET", "") or ""
    return client_id.strip(), client_secret.strip()


def _verify_google_id_token(credential: str, client_id: str) -> dict:
    """
    Verify a Google ID token via the tokeninfo endpoint.
    Validates: audience, issuer, expiry, and email_verified.
    Returns the token payload dict on success, raises ValueError on failure.
    """
    try:
        token_resp = requests.get(
            GOOGLE_TOKENINFO_URL,
            params={"id_token": credential},
            timeout=10,
        )
        token_resp.raise_for_status()
        payload = token_resp.json()
    except requests.RequestException as e:
        logger.exception("Google tokeninfo request failed")
        raise ValueError("Google credential verification failed") from e

    # Validate audience
    aud = payload.get("aud") or payload.get("azp")
    if aud != client_id:
        logger.warning("Google token audience mismatch")
        raise ValueError("Invalid credential audience")

    # Validate issuer
    iss = payload.get("iss", "")
    if iss not in _GOOGLE_ISSUERS:
        logger.warning("Google token issuer mismatch: got %s", iss)
        raise ValueError("Invalid credential issuer")

    # Validate expiry
    exp = payload.get("exp")
    if exp is not None:
        try:
            if int(exp) < int(time.time()):
                raise ValueError("Google credential has expired")
        except (TypeError, ValueError) as exc:
            raise ValueError("Invalid expiry in Google credential") from exc

    # Validate email verified
    if payload.get("email_verified") not in (True, "true"):
        logger.warning("Google token: unverified email")
        raise ValueError("Google account email is not verified")

    return payload


class GoogleOAuthInitView(APIView):
    """Redirect the user to Google's OAuth consent screen."""

    permission_classes = [AllowAny]

    def get(self, request):
        client_id, _ = _get_google_config()
        if not client_id:
            logger.warning("Google OAuth not configured: GOOGLE_OAUTH_CLIENT_ID missing")
            frontend_url = getattr(settings, "FRONTEND_URL", "").rstrip("/")
            return redirect(f"{frontend_url}/login?error=oauth_not_configured")

        next_path = _sanitize_next(request.GET.get("next", ""))
        state = _generate_state(next_path)

        # Always build redirect URI from settings in production to prevent open redirect
        backend_url = getattr(settings, "BACKEND_URL", "").rstrip("/")
        if backend_url:
            redirect_uri = f"{backend_url}/api/auth/google/callback"
        else:
            redirect_uri = request.build_absolute_uri("/api/auth/google/callback")

        params = {
            "client_id": client_id,
            "redirect_uri": redirect_uri,
            "response_type": "code",
            "scope": SCOPES,
            "access_type": "offline",
            "prompt": "consent",
            "state": state,
        }
        url = f"{GOOGLE_AUTH_URL}?{urllib.parse.urlencode(params)}"
        return redirect(url)


class GoogleOAuthCallbackView(APIView):
    """Exchange authorization code for tokens, get or create user, issue JWT, redirect to frontend."""

    permission_classes = [AllowAny]

    def get(self, request):
        code = request.GET.get("code")
        raw_state = request.GET.get("state", "")
        error = request.GET.get("error")
        frontend_url = (getattr(settings, "FRONTEND_URL", "") or "").rstrip("/")

        if error:
            logger.warning("Google OAuth error from callback: %s", error)
            return redirect(f"{frontend_url}/login?error=oauth_denied")

        if not code:
            logger.warning("Google OAuth callback missing code")
            return redirect(f"{frontend_url}/login?error=oauth_missing_code")

        # SECURITY: validate and consume the state parameter (prevents CSRF)
        try:
            next_path = _consume_state(raw_state)
        except ValueError as exc:
            logger.warning("Google OAuth state validation failed: %s", exc)
            return redirect(f"{frontend_url}/login?error=oauth_invalid_state")

        client_id, client_secret = _get_google_config()
        if not client_id or not client_secret:
            logger.warning("Google OAuth not configured")
            return redirect(f"{frontend_url}/login?error=oauth_not_configured")

        # Redirect URI must match what was sent to Google exactly
        backend_url = getattr(settings, "BACKEND_URL", "").rstrip("/")
        if backend_url:
            redirect_uri = f"{backend_url}/api/auth/google/callback"
        else:
            redirect_uri = request.build_absolute_uri("/api/auth/google/callback")

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
            logger.exception("Google token exchange failed")
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
            logger.exception("Google userinfo failed")
            return redirect(f"{frontend_url}/login?error=oauth_userinfo_failed")

        email = (userinfo.get("email") or "").strip()
        if not email:
            logger.warning("Google userinfo missing email")
            return redirect(f"{frontend_url}/login?error=oauth_no_email")

        # SECURITY: reject unverified Google email addresses
        if not userinfo.get("verified_email", False):
            logger.warning("Google OAuth: unverified email rejected")
            return redirect(f"{frontend_url}/login?error=oauth_email_unverified")

        given_name = (userinfo.get("given_name") or "").strip()
        family_name = (userinfo.get("family_name") or "").strip()
        picture = (userinfo.get("picture") or "").strip()

        user, is_new_user = _get_or_create_google_user(email, given_name, family_name, picture)

        refresh = RefreshToken.for_user(user)
        access_jwt = str(refresh.access_token)

        if is_new_user:
            resolved_next = "onboarding"
        else:
            resolved_next = _sanitize_next(next_path)

        # Pass access token in URL fragment (stripped by AuthCallback immediately on load)
        fragment = f"access={urllib.parse.quote(access_jwt)}&next={urllib.parse.quote(resolved_next)}"
        redirect_to = f"{frontend_url}/auth/callback#{fragment}"

        response = redirect(redirect_to)
        _set_refresh_cookie(response, str(refresh))
        return response


def _get_or_create_google_user(email: str, given_name: str, family_name: str, picture: str):
    """
    Get existing user by email or create one. Returns (user, is_new_user).
    Used by both OAuth callback and One Tap / credential verification.
    """
    user = User.objects.filter(email__iexact=email).first()
    is_new_user = False
    if user:
        user.last_login = timezone.now()
        user.save(update_fields=["last_login"])
        if picture and hasattr(user, "profile"):
            if user.profile.profile_avatar != picture:
                user.profile.profile_avatar = picture
                user.profile.save(update_fields=["profile_avatar"])
    else:
        is_new_user = True
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
        if picture and hasattr(user, "profile"):
            user.profile.profile_avatar = picture
            user.profile.save(update_fields=["profile_avatar"])
    return user, is_new_user


class GoogleCredentialAuthView(APIView):
    """
    Verify Google One Tap / Sign-in button ID token and issue our JWT.
    POST body: { "credential": "<id_token>", "state": "all-topics" (optional) }
    Returns: { "access": "<jwt>", "user": {...}, "next": "all-topics" } and sets refresh cookie.
    """

    permission_classes = [AllowAny]

    def post(self, request):
        credential = (request.data.get("credential") or "").strip()
        state = (request.data.get("state") or "").strip() or "all-topics"

        if not credential:
            return Response(
                {"detail": "Missing credential.", "code": "missing_credential"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        client_id, _ = _get_google_config()
        if not client_id:
            logger.warning("Google OAuth not configured")
            return Response(
                {"detail": "Google sign-in is not configured.", "code": "oauth_not_configured"},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        # Verify ID token: audience, issuer, expiry, email_verified
        try:
            payload = _verify_google_id_token(credential, client_id)
        except ValueError as exc:
            return Response(
                {"detail": str(exc), "code": "invalid_credential"},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        email = (payload.get("email") or "").strip()
        if not email:
            return Response(
                {"detail": "Google account has no email we can use.", "code": "oauth_no_email"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        given_name = (payload.get("given_name") or "").strip()
        family_name = (payload.get("family_name") or "").strip()
        picture = (payload.get("picture") or "").strip()

        user, is_new_user = _get_or_create_google_user(email, given_name, family_name, picture)

        refresh = RefreshToken.for_user(user)
        access_jwt = str(refresh.access_token)
        next_path = "onboarding" if is_new_user else _sanitize_next(state)

        response = Response(
            {
                "access": access_jwt,
                "user": user_display_dict(
                    user, include_id=True, include_email=True, include_staff=True
                ),
                "next": next_path,
            },
            status=status.HTTP_200_OK,
        )
        _set_refresh_cookie(response, str(refresh))
        return response

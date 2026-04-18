"""
Google OAuth 2.0 flow for login and register.
- GET /api/auth/google/ redirects to Google consent.
- GET /api/auth/google/callback exchanges code, creates or gets user, issues JWT, redirects to frontend.
  redirect_uri = {FRONTEND_URL or GOOGLE_OAUTH_REDIRECT_BASE}/api/auth/google/callback.
  In DEBUG only, may use the request Host (see GOOGLE_OAUTH_REDIRECT_FROM_REQUEST) so LAN/dev
  matches Google Console. In production this is ignored so init (often hitting Railway directly)
  and callback (often hitting the public domain via a proxy) always share the same redirect_uri.
  After Google, the user is sent to the SPA origin embedded in OAuth `state` (v1.* JSON) when that
  origin is allowlisted (FRONTEND_URL, CORS_ALLOWED_ORIGINS*, loopback); otherwise FRONTEND_URL.
- POST /api/auth/google/verify-credential/ accepts Google One Tap / Sign-in button ID token,
  verifies it, creates or gets user, issues JWT, returns JSON (for in-page sign-in without redirect).
"""

import base64
import json
import logging
import os
import re
import urllib.parse

import requests
from django.conf import settings
from django.contrib.auth.models import User
from django.shortcuts import redirect
from django.utils import timezone
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework import status
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken

from authentication.user_display import user_display_dict
from core.utils import env_bool, env_csv

logger = logging.getLogger(__name__)

# OAuth state version: embeds post-login SPA origin so callback redirects match where the user started
# (settings.FRONTEND_URL alone often points at production when .env is shared).
_GOOGLE_OAUTH_STATE_PREFIX = "v1."
_NEXT_PATH_PATTERN = re.compile(r"^[a-zA-Z0-9][a-zA-Z0-9\-_/]*$")


def _normalize_browser_origin(value: str) -> str | None:
    """Return scheme://host[:port] or None if not a plain origin URL."""
    raw = (value or "").strip().rstrip("/")
    if not raw:
        return None
    parsed = urllib.parse.urlparse(raw)
    if parsed.scheme not in ("http", "https"):
        return None
    if not parsed.netloc or parsed.username is not None or parsed.password is not None:
        return None
    if parsed.path not in ("", "/"):
        return None
    if parsed.params or parsed.query or parsed.fragment:
        return None
    host = parsed.hostname
    if not host:
        return None
    return f"{parsed.scheme}://{parsed.netloc}".rstrip("/")


def _is_loopback_origin(norm: str) -> bool:
    parsed = urllib.parse.urlparse(norm + "/")
    host = (parsed.hostname or "").lower()
    return host in ("localhost", "127.0.0.1", "::1")


def _candidate_allowed_return_origins() -> set[str]:
    out: set[str] = set()
    front = _normalize_browser_origin(getattr(settings, "FRONTEND_URL", "") or "")
    if front:
        out.add(front)
    for item in env_csv("GOOGLE_OAUTH_ALLOWED_RETURN_ORIGINS_CSV"):
        n = _normalize_browser_origin(item)
        if n:
            out.add(n)
    cors = getattr(settings, "CORS_ALLOWED_ORIGINS", None) or []
    if isinstance(cors, (list, tuple)):
        for item in cors:
            if isinstance(item, str):
                n = _normalize_browser_origin(item)
                if n:
                    out.add(n)
    return out


def _safe_return_origin(origin: str | None) -> str | None:
    """If origin is in the allowlist, return normalized origin; else None.

    Loopback (localhost / 127.0.0.1 / ::1) is always allowed so a local SPA can use
    VITE_BACKEND_URL against a hosted API (Railway) without FRONTEND_URL matching localhost.
    """
    norm = _normalize_browser_origin(origin or "")
    if not norm:
        return None
    if norm in _candidate_allowed_return_origins():
        return norm
    if _is_loopback_origin(norm):
        return norm
    return None


def _sanitize_next_path(value: str, default: str = "all-topics") -> str:
    v = (value or "").strip().lstrip("/")
    if not v or ".." in v or "//" in v or ":" in v:
        return default
    if not _NEXT_PATH_PATTERN.fullmatch(v):
        return default
    return v


def _decode_v1_oauth_state(raw: str) -> dict | None:
    if not raw.startswith(_GOOGLE_OAUTH_STATE_PREFIX):
        return None
    b64 = raw[len(_GOOGLE_OAUTH_STATE_PREFIX) :]
    pad = "=" * ((4 - len(b64) % 4) % 4)
    try:
        data = json.loads(base64.urlsafe_b64decode((b64 + pad).encode("ascii")))
    except (ValueError, json.JSONDecodeError, UnicodeDecodeError):
        return None
    if not isinstance(data, dict):
        return None
    return data


def _parse_google_oauth_state(raw_state: str) -> tuple[str, str | None]:
    """
    Returns (next_path, return_origin_or_none).
    Legacy state is a single path segment (e.g. all-topics, onboarding).
    v1.* states are base64url JSON: {"next":"...","origin":"https://host:port"}.
    """
    raw = (raw_state or "").strip()
    if not raw:
        return "all-topics", None
    data = _decode_v1_oauth_state(raw)
    if data is not None:
        next_path = str(data.get("next") or data.get("n") or "all-topics").strip()
        origin = str(data.get("origin") or data.get("o") or "").strip() or None
        return _sanitize_next_path(next_path), origin
    return _sanitize_next_path(raw), None


def _resolve_post_google_frontend_url(return_origin: str | None) -> str:
    """Where to send the browser after Google OAuth (must stay on an allowlisted SPA origin)."""
    configured = (getattr(settings, "FRONTEND_URL", "") or "").rstrip("/")
    picked = _safe_return_origin(return_origin)
    return picked or configured


GOOGLE_TOKENINFO_URL = "https://oauth2.googleapis.com/tokeninfo"

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
# Must stay within UserProfile.profile_avatar max_length (see authentication migrations).
GOOGLE_PROFILE_PICTURE_MAX_LEN = 2000
SCOPES = "openid email profile"


def _get_google_config():
    client_id = getattr(settings, "GOOGLE_OAUTH_CLIENT_ID", "") or ""
    client_secret = getattr(settings, "GOOGLE_OAUTH_CLIENT_SECRET", "") or ""
    return client_id.strip(), client_secret.strip()


def _google_oauth_redirect_uri(request=None):
    """Callback URL registered with Google; must match Authorized redirect URIs in Google Cloud."""
    override = (getattr(settings, "GOOGLE_OAUTH_REDIRECT_BASE", "") or "").strip()
    if override:
        base = override.rstrip("/")
    elif (
        settings.DEBUG
        and request is not None
        and env_bool(
            "GOOGLE_OAUTH_REDIRECT_FROM_REQUEST",
            True,
        )
    ):
        xf_proto = (request.META.get("HTTP_X_FORWARDED_PROTO") or "").strip().lower()
        scheme = xf_proto if xf_proto in ("http", "https") else request.scheme
        try:
            host = request.get_host()
        except Exception:
            host = ""
        base = (
            f"{scheme}://{host}".rstrip("/")
            if host and scheme
            else (getattr(settings, "FRONTEND_URL", "") or "").rstrip("/")
        )
    else:
        base = (getattr(settings, "FRONTEND_URL", "") or "").rstrip("/")
    return f"{base}/api/auth/google/callback"


class GoogleOAuthInitView(APIView):
    """Redirect the user to Google's OAuth consent screen."""

    permission_classes = [AllowAny]

    def get(self, request):
        client_id, _ = _get_google_config()
        if not client_id:
            logger.warning("Google OAuth not configured: GOOGLE_OAUTH_CLIENT_ID missing")
            frontend_url = getattr(settings, "FRONTEND_URL", "").rstrip("/")
            return redirect(f"{frontend_url}/login?error=oauth_not_configured")

        redirect_uri = _google_oauth_redirect_uri(request)
        logger.info("Google OAuth redirect_uri=%s", redirect_uri)
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
        raw_state = request.GET.get("state", "")
        state_next, return_origin = _parse_google_oauth_state(raw_state)
        frontend_url = _resolve_post_google_frontend_url(return_origin)

        code = request.GET.get("code")
        error = request.GET.get("error")

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

        redirect_uri = _google_oauth_redirect_uri(request)

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
            body = ""
            if isinstance(e, requests.HTTPError) and e.response is not None:
                body = (e.response.text or "")[:800]
            logger.exception(
                "Google token exchange failed: %s redirect_uri=%s body=%r",
                e,
                redirect_uri,
                body,
            )
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

        user, is_new_user = _get_or_create_google_user(email, given_name, family_name, picture)

        refresh = RefreshToken.for_user(user)
        access_jwt = str(refresh.access_token)

        # New users go to onboarding; existing use state or default to all-topics
        if is_new_user:
            next_path = "onboarding"
        else:
            next_path = (state_next.strip() or "all-topics").strip() or "all-topics"
        next_path = next_path.lstrip("/")
        refresh_jwt = str(refresh)
        fragment = (
            f"access={urllib.parse.quote(access_jwt)}"
            f"&refresh={urllib.parse.quote(refresh_jwt)}"
            f"&next={urllib.parse.quote(next_path)}"
        )
        redirect_to = f"{frontend_url}/auth/callback#{fragment}"

        response = redirect(redirect_to)
        _set_refresh_cookie(response, str(refresh))
        return response


def _get_or_create_google_user(email: str, given_name: str, family_name: str, picture: str):
    """
    Get existing user by email or create one. Returns (user, is_new_user).
    Used by both OAuth callback and One Tap / credential verification.
    """
    if picture:
        picture = picture[:GOOGLE_PROFILE_PICTURE_MAX_LEN]
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

        allowed_ids = getattr(settings, "GOOGLE_OAUTH_ALLOWED_CLIENT_IDS", None) or []
        if not allowed_ids:
            logger.warning("Google OAuth not configured (no allowed client IDs)")
            return Response(
                {"detail": "Google sign-in is not configured.", "code": "oauth_not_configured"},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        # Verify ID token with Google tokeninfo
        try:
            token_resp = requests.get(
                GOOGLE_TOKENINFO_URL,
                params={"id_token": credential},
                timeout=10,
            )
            token_resp.raise_for_status()
            payload = token_resp.json()
        except requests.RequestException as e:
            logger.exception("Google tokeninfo failed: %s", e)
            return Response(
                {"detail": "Invalid or expired Google credential.", "code": "invalid_credential"},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        # Audience must be one of our OAuth client IDs (web, iOS, Android)
        aud = payload.get("aud") or payload.get("azp")
        if aud not in allowed_ids:
            logger.warning("Google token audience mismatch: got %s", aud)
            return Response(
                {"detail": "Invalid credential audience.", "code": "invalid_credential"},
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
        next_path = "onboarding" if is_new_user else (state or "all-topics")
        next_path = next_path.lstrip("/")

        response = Response(
            {
                "access": access_jwt,
                "refresh": str(refresh),
                "user": user_display_dict(
                    user, include_id=True, include_email=True, include_staff=True
                ),
                "next": next_path,
            },
            status=status.HTTP_200_OK,
        )
        _set_refresh_cookie(response, str(refresh))
        return response

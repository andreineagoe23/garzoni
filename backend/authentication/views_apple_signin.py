"""
Sign in with Apple for native apps: verify identity JWT, create or load user, issue SimpleJWT.
POST /api/auth/apple/verify-identity/  { "identity_token": "...", "state": "all-topics" (optional),
  "first_name", "last_name" (optional; only sent on first authorization from the client) }
"""

import logging

import jwt
from django.conf import settings
from django.contrib.auth.models import User
from django.utils import timezone
from jwt import PyJWKClient
from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken

from authentication.user_display import user_display_dict
from authentication.views_google_oauth import _set_refresh_cookie

logger = logging.getLogger(__name__)

APPLE_JWKS_URL = "https://appleid.apple.com/auth/keys"
APPLE_ISSUER = "https://appleid.apple.com"


def _enqueue_cio_login_sync(user_id: int) -> None:
    """Refresh last_active_at on the CIO profile after Apple login."""
    try:
        from notifications.tasks import safe_enqueue_sync_user_to_customer_io

        safe_enqueue_sync_user_to_customer_io(user_id)
    except Exception:
        logger.warning(
            "CIO sync enqueue failed for user_id=%s on apple login", user_id, exc_info=True
        )


# Cached at module level — reuses fetched keys across requests.
# lifespan=3600: Apple rotates JWKS rarely; default 300s causes a live network
# round-trip every 5 minutes which can take 30s+ if Apple's endpoint is slow.
_apple_jwks_client = PyJWKClient(APPLE_JWKS_URL, cache_keys=True, lifespan=3600)


def _decode_apple_identity_token(token: str, allowed_audiences: list) -> dict:
    signing_key = _apple_jwks_client.get_signing_key_from_jwt(token)
    # Use algorithm from the JWK itself — hardcoding "ES256" fails in PyJWT 2.4+
    # when the key's algorithm attribute doesn't match the algorithms list.
    alg = getattr(signing_key, "algorithm_name", None) or "ES256"
    return jwt.decode(
        token,
        signing_key.key,
        algorithms=[alg],
        audience=allowed_audiences,
        issuer=APPLE_ISSUER,
    )


def _get_or_create_apple_user(
    sub: str,
    email: str | None,
    first_name: str,
    last_name: str,
) -> tuple[User, bool]:
    """
    Resolve user by apple_sub, or by email with linking, or create. Returns (user, is_new_user).
    """
    from authentication.models import UserProfile

    email_clean = (email or "").strip() or None

    profile = UserProfile.objects.select_related("user").filter(apple_sub=sub).first()
    if profile:
        user = profile.user
        update_fields = ["last_login"]
        # Backfill email if Apple now shares it but we stored "" on a prior login
        # (Apple hides email on first auth when user picks "Hide My Email" without
        # consenting to share). Private-relay addresses (*@privaterelay.appleid.com)
        # are deliverable through Apple's forwarder — store them as real emails.
        if email_clean and not (user.email or "").strip():
            user.email = email_clean
            update_fields.append("email")
        # Backfill missing display name if Apple shared one on this login.
        if first_name and not (user.first_name or "").strip():
            user.first_name = first_name[:150]
            update_fields.append("first_name")
        if last_name and not (user.last_name or "").strip():
            user.last_name = last_name[:150]
            update_fields.append("last_name")
        user.last_login = timezone.now()
        user.save(update_fields=update_fields)
        _enqueue_cio_login_sync(user.pk)
        return user, False

    if email_clean:
        user = User.objects.filter(email__iexact=email_clean).first()
        if user:
            prof = user.profile
            if prof.apple_sub and prof.apple_sub != sub:
                raise ValueError("apple_email_conflict")
            if not prof.apple_sub:
                prof.apple_sub = sub
                prof.save(update_fields=["apple_sub"])
            user.last_login = timezone.now()
            user.save(update_fields=["last_login"])
            _enqueue_cio_login_sync(user.pk)
            return user, False

    is_new_user = True

    def _ascii_slug(text: str, max_len: int = 12) -> str:
        """Lowercase ASCII-only slug from arbitrary text."""
        return "".join(c.lower() for c in text if c.isascii() and c.isalnum())[:max_len]

    import secrets as _secrets

    # Priority: given name → email local part (skip Apple relay garbage) → fallback
    base_name = _ascii_slug(first_name) if first_name else ""
    if not base_name and email_clean and "privaterelay.appleid.com" not in email_clean:
        base_name = _ascii_slug(email_clean.split("@")[0])
    username_base = base_name or "user"

    username = f"{username_base}_{_secrets.token_hex(4)}"
    while User.objects.filter(username=username).exists():
        username = f"{username_base}_{_secrets.token_hex(4)}"

    user = User(
        username=username,
        email=email_clean or "",
        first_name=first_name[:150] if first_name else "",
        last_name=last_name[:150] if last_name else "",
    )
    user.set_unusable_password()
    user.save()
    user.profile.apple_sub = sub
    user.profile.save(update_fields=["apple_sub"])
    return user, is_new_user


class AppleIdentityAuthView(APIView):
    """
    Verify Apple identity token from the iOS/Android Sign in with Apple SDK.
    """

    permission_classes = [AllowAny]

    def post(self, request):
        raw_token = (request.data.get("identity_token") or "").strip()
        state = (request.data.get("state") or "").strip() or "all-topics"
        first_name = (request.data.get("first_name") or "").strip()
        last_name = (request.data.get("last_name") or "").strip()

        if not raw_token:
            return Response(
                {"detail": "Missing identity_token.", "code": "missing_token"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        audiences = getattr(settings, "APPLE_SIGNIN_ALLOWED_AUDIENCES", None) or []
        if not audiences:
            logger.warning(
                "Apple Sign In not configured (set APPLE_SIGNIN_AUDIENCES_CSV and/or APPLE_SIGNIN_BUNDLE_ID)"
            )
            return Response(
                {"detail": "Apple sign-in is not configured.", "code": "oauth_not_configured"},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        try:
            claims = _decode_apple_identity_token(raw_token, audiences)
        except jwt.exceptions.PyJWTError as e:
            logger.warning(
                "Apple JWT verification failed (%s): %s — audiences_configured=%r",
                type(e).__name__,
                e,
                audiences,
            )
            return Response(
                {"detail": "Invalid or expired Apple credential.", "code": "invalid_credential"},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        sub = (claims.get("sub") or "").strip()
        if not sub:
            return Response(
                {"detail": "Apple token missing subject.", "code": "invalid_credential"},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        email = (claims.get("email") or "").strip() or None

        try:
            user, is_new_user = _get_or_create_apple_user(sub, email, first_name, last_name)
        except ValueError as e:
            if str(e) == "apple_email_conflict":
                return Response(
                    {
                        "detail": "This email is already linked to a different Apple ID.",
                        "code": "apple_email_conflict",
                    },
                    status=status.HTTP_409_CONFLICT,
                )
            logger.exception("Unexpected ValueError in Apple Sign In user lookup")
            return Response(
                {"detail": "Sign in failed. Please try again.", "code": "server_error"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )
        except Exception:
            logger.exception("Unexpected error in Apple Sign In user lookup")
            return Response(
                {"detail": "Sign in failed. Please try again.", "code": "server_error"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        refresh = RefreshToken.for_user(user)
        access_jwt = str(refresh.access_token)
        if is_new_user:
            next_path = "onboarding"
        else:
            next_path = (state.strip() or "all-topics").strip() or "all-topics"
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

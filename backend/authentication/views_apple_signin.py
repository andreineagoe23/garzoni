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


def _decode_apple_identity_token(token: str, allowed_audiences: list) -> dict:
    jwks = PyJWKClient(APPLE_JWKS_URL)
    signing_key = jwks.get_signing_key_from_jwt(token)
    return jwt.decode(
        token,
        signing_key.key,
        algorithms=["ES256"],
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

    profile = UserProfile.objects.select_related("user").filter(apple_sub=sub).first()
    if profile:
        user = profile.user
        user.last_login = timezone.now()
        user.save(update_fields=["last_login"])
        return user, False

    email_clean = (email or "").strip() or None
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
            return user, False

    is_new_user = True
    safe_sub = "".join(c if c.isalnum() else "_" for c in sub)[:25] or "apple"
    username = safe_sub
    suffix = 0
    while User.objects.filter(username=username).exists():
        suffix += 1
        username = f"{safe_sub}_{suffix}"[:30]

    email_final = email_clean or f"apple_{sub}@signin.placeholder.local"
    user = User(
        username=username,
        email=email_final,
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
            logger.warning("Apple JWT verification failed: %s", e)
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

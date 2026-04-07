from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.decorators import api_view, permission_classes
from django.contrib.auth import update_session_auth_hash
from django.contrib.auth.models import User
from django.utils.http import urlsafe_base64_encode, urlsafe_base64_decode
from django.utils.encoding import force_bytes, force_str
from django.contrib.auth.tokens import PasswordResetTokenGenerator
from django.core.mail import EmailMultiAlternatives
from django.template.loader import render_to_string
from django.utils.html import strip_tags
from django.conf import settings
from django.core import signing
from django.http import HttpResponse

from authentication.throttles import PasswordResetRateThrottle
from authentication.models import UserProfile


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def change_password(request):
    """Allow logged-in users to change their password."""
    user = request.user
    current_password = request.data.get("current_password")
    new_password = request.data.get("new_password")
    confirm_password = request.data.get("confirm_password")

    if not user.check_password(current_password):
        return Response({"error": "Current password is incorrect."}, status=400)

    if new_password != confirm_password:
        return Response({"error": "New passwords do not match."}, status=400)

    if len(new_password) < 8:
        return Response({"error": "Password must be at least 8 characters."}, status=400)

    user.set_password(new_password)
    user.save()
    update_session_auth_hash(request, user)

    return Response({"message": "Password changed successfully."}, status=200)


@api_view(["DELETE"])
@permission_classes([IsAuthenticated])
def delete_account(request):
    """Delete the currently authenticated user's account."""
    user = request.user
    try:
        user.delete()
        return Response({"message": "Account deleted successfully."}, status=200)
    except Exception as exc:
        return Response({"error": str(exc)}, status=500)


class PasswordResetRequestView(APIView):
    """Handle password reset requests by generating a reset token and sending an email with the reset link."""

    permission_classes = [AllowAny]
    throttle_classes = [PasswordResetRateThrottle]

    def post(self, request):
        """Process password reset requests by validating the email and sending a reset link."""
        email = request.data.get("email")
        if not email:
            return Response({"error": "Email is required."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            user = User.objects.get(email=email)
        except User.DoesNotExist:
            return Response({"message": "Password reset link sent."}, status=status.HTTP_200_OK)

        token = PasswordResetTokenGenerator().make_token(user)
        uid = urlsafe_base64_encode(force_bytes(user.pk))
        reset_link = f"{settings.FRONTEND_URL}/password-reset/{uid}/{token}"

        context = {
            "user": user,
            "reset_link": reset_link,
        }
        subject = "Password Reset Request"
        html_content = render_to_string("emails/password_reset.html", context)
        text_content = strip_tags(html_content)

        email_message = EmailMultiAlternatives(
            subject, text_content, settings.DEFAULT_FROM_EMAIL, [user.email]
        )
        email_message.attach_alternative(html_content, "text/html")
        email_message.send()

        return Response({"message": "Password reset link sent."}, status=status.HTTP_200_OK)


class PasswordResetConfirmView(APIView):
    """Handle password reset confirmation by validating the token and updating the user's password."""

    permission_classes = [AllowAny]

    def get(self, request, uidb64, token):
        """Validate the reset token and user ID to ensure the reset process can proceed."""
        try:
            uid = force_str(urlsafe_base64_decode(uidb64))
            user = User.objects.get(pk=uid)
        except (TypeError, ValueError, OverflowError, User.DoesNotExist):
            return Response(
                {"error": "Invalid user ID or token."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if PasswordResetTokenGenerator().check_token(user, token):
            return Response(
                {"message": "Token is valid, proceed with password reset."},
                status=status.HTTP_200_OK,
            )
        return Response({"error": "Invalid token."}, status=status.HTTP_400_BAD_REQUEST)

    def post(self, request, uidb64, token):
        """Reset the user's password after validating the token and ensuring the passwords match."""
        try:
            uid = force_str(urlsafe_base64_decode(uidb64))
            user = User.objects.get(pk=uid)
        except (TypeError, ValueError, OverflowError, User.DoesNotExist):
            return Response(
                {"error": "Invalid user ID or token."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not PasswordResetTokenGenerator().check_token(user, token):
            return Response(
                {"error": "Invalid or expired token."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        new_password = request.data.get("new_password")
        confirm_password = request.data.get("confirm_password")

        if not new_password or not confirm_password or new_password != confirm_password:
            return Response(
                {"error": "Passwords do not match."}, status=status.HTTP_400_BAD_REQUEST
            )

        user.set_password(new_password)
        user.save()

        return Response({"message": "Password reset successful."}, status=status.HTTP_200_OK)


class EmailUnsubscribeView(APIView):
    """
    One-click unsubscribe endpoint used by reminder emails.
    This disables reminder emails for the user profile tied to the signed token.
    """

    permission_classes = [AllowAny]

    def get(self, request):
        token = request.query_params.get("token", "").strip()
        if not token:
            return HttpResponse(
                "<h2>Missing token</h2><p>The unsubscribe link is invalid.</p>",
                status=400,
                content_type="text/html",
            )
        try:
            payload = signing.loads(
                token, salt="garzoni.email.unsubscribe", max_age=60 * 60 * 24 * 365
            )
            profile_id = payload.get("profile_id")
            profile = UserProfile.objects.select_related("user").get(id=profile_id)
        except Exception:
            return HttpResponse(
                "<h2>Invalid link</h2><p>This unsubscribe link is invalid or has expired.</p>",
                status=400,
                content_type="text/html",
            )

        profile.email_reminder_preference = "none"
        profile.save(update_fields=["email_reminder_preference"])

        frontend = getattr(settings, "FRONTEND_URL", "https://garzoni.app").rstrip("/")
        html = f"""
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Unsubscribed</title>
  </head>
  <body style="margin:0;padding:0;background:#0B0F14;color:#E5E7EB;font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial;">
    <div style="max-width:640px;margin:40px auto;padding:0 16px;">
      <div style="border:1px solid rgba(255,255,255,0.10);border-radius:16px;overflow:hidden;background:#111827;">
        <div style="padding:18px 20px;background:linear-gradient(135deg, rgba(29,83,48,0.60), rgba(11,15,20,0.20));border-bottom:1px solid rgba(255,255,255,0.10);">
          <div style="font-size:14px;font-weight:800;color:#E6C87A;text-transform:uppercase;">Garzoni</div>
          <div style="margin-top:4px;font-size:20px;font-weight:900;color:#FFFFFF;">You’re unsubscribed</div>
        </div>
        <div style="padding:18px 20px;font-size:15px;line-height:1.6;">
          <p style="margin:0 0 12px 0;">We won’t send you reminder emails anymore.</p>
          <p style="margin:0 0 18px 0;color:rgba(229,231,235,0.78);font-size:13px;">
            You can re-enable reminders anytime in Settings.
          </p>
          <a href="{frontend}/settings"
             style="display:inline-block;background:#1D5330;color:#FFFFFF;text-decoration:none;font-weight:800;padding:12px 16px;border-radius:12px;">
            Open Settings
          </a>
        </div>
      </div>
    </div>
  </body>
</html>
"""
        return HttpResponse(html, status=200, content_type="text/html")

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

from authentication.throttles import PasswordResetRateThrottle


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
                {"error": "Invalid user ID or token."}, status=status.HTTP_400_BAD_REQUEST
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
                {"error": "Invalid user ID or token."}, status=status.HTTP_400_BAD_REQUEST
            )

        if not PasswordResetTokenGenerator().check_token(user, token):
            return Response(
                {"error": "Invalid or expired token."}, status=status.HTTP_400_BAD_REQUEST
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

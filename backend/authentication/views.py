# authentication/views.py
from rest_framework import generics, status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.decorators import api_view, permission_classes, action
from rest_framework import viewsets
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenRefreshView
from rest_framework_simplejwt.exceptions import TokenError
from django.contrib.auth.models import User
from django.contrib.auth import update_session_auth_hash
from django.http import JsonResponse
from django.conf import settings
from django.middleware.csrf import get_token
from django.views.decorators.csrf import ensure_csrf_cookie
from django.utils import timezone
from django.db import models
import logging
import requests
import os

from authentication.models import UserProfile, FriendRequest, Referral
from authentication.serializers import (
    RegisterSerializer, UserProfileSerializer, FriendRequestSerializer,
    UserSearchSerializer, UserProfileSettingsSerializer
)
from authentication.tokens import delete_jwt_cookies
from authentication.entitlements import (
    check_and_consume_entitlement,
    entitlement_usage_snapshot,
    get_entitlements_for_user,
)
from education.models import LessonCompletion
from core.utils import env_bool

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
    delete_kwargs = {
        k: v
        for k, v in base_kwargs.items()
        if k in {"path", "domain", "samesite"}
    }
    response.delete_cookie(REFRESH_COOKIE_NAME, **delete_kwargs)


def verify_recaptcha(token):
    """Verify the reCAPTCHA token with Google's API"""
    try:
        url = "https://www.google.com/recaptcha/api/siteverify"
        data = {
            "secret": settings.RECAPTCHA_PRIVATE_KEY,
            "response": token
        }
        response = requests.post(url, data=data)
        result = response.json()
        return result.get("success", False) and result.get("score", 0) >= settings.RECAPTCHA_REQUIRED_SCORE
    except Exception as e:
        logger.error(f"reCAPTCHA verification error: {str(e)}")
        return False


@ensure_csrf_cookie
def get_csrf_token(request):
    """Retrieve and return a CSRF token for the client."""
    token = get_token(request)
    return JsonResponse({"csrfToken": token})


class UserProfileView(APIView):
    """View to handle user profile data retrieval and updates."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        """Retrieve and return the user's profile data."""
        user_profile = UserProfile.objects.get(user=request.user)

        # Get the current month's activity data
        today = timezone.now().date()
        first_day = today.replace(day=1)
        last_day = (first_day + timezone.timedelta(days=32)).replace(day=1) - timezone.timedelta(days=1)
        
        # Get all lesson completions for the current month
        lesson_completions = LessonCompletion.objects.filter(
            user_progress__user=request.user,
            completed_at__date__gte=first_day,
            completed_at__date__lte=last_day
        ).values('completed_at__date').annotate(count=models.Count('id'))

        # Create a dictionary of dates with completion counts
        activity_calendar = {
            str(date): 0 for date in [first_day + timezone.timedelta(days=x) for x in range((last_day - first_day).days + 1)]
        }
        
        for completion in lesson_completions:
            activity_calendar[str(completion['completed_at__date'])] = completion['count']

        # Add current month information
        current_month = {
            'first_day': first_day.isoformat(),
            'last_day': last_day.isoformat(),
            'month_name': first_day.strftime('%B'),
            'year': first_day.year
        }

        return Response({
            "user_data": {
                "first_name": request.user.first_name,
                "last_name": request.user.last_name,
                "email": request.user.email,
                "earned_money": user_profile.earned_money,
                "points": user_profile.points,
                "streak": user_profile.streak,
                "profile_avatar": user_profile.profile_avatar,
                "dark_mode": user_profile.dark_mode,
                "email_reminder_preference": user_profile.email_reminder_preference,
                "has_paid": user_profile.has_paid
            },
            "activity_calendar": activity_calendar,
            "current_month": current_month
        })

    def patch(self, request):
        """Update specific fields in the user's profile."""
        user_profile = request.user.profile
        email_reminder_preference = request.data.get('email_reminder_preference')
        if email_reminder_preference is not None:
            user_profile.email_reminder_preference = email_reminder_preference
            user_profile.save()
        return Response({"message": "Profile updated successfully."})


class EntitlementsView(APIView):
    """Expose the current user's plan and entitlement limits."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        entitlements = get_entitlements_for_user(request.user)
        entitlements["usage"] = entitlement_usage_snapshot(request.user)
        return Response(entitlements)


class ConsumeEntitlementView(APIView):
    """Consume a unit from an entitlement if the user is allowed to use it."""

    permission_classes = [IsAuthenticated]

    def post(self, request):
        feature = request.data.get("feature")
        if not feature:
            return Response({"error": "Feature is required."}, status=status.HTTP_400_BAD_REQUEST)

        allowed, meta = check_and_consume_entitlement(request.user, feature)
        status_code = status.HTTP_200_OK

        if not allowed:
            status_code = (
                status.HTTP_402_PAYMENT_REQUIRED
                if meta.get("reason") == "upgrade"
                else status.HTTP_429_TOO_MANY_REQUESTS
            )

        response_payload = {
            "feature": feature,
            "allowed": allowed,
            **{k: v for k, v in meta.items() if k != "error"},
        }

        if not allowed:
            response_payload["error"] = meta.get("error", "Feature unavailable.")

        return Response(response_payload, status=status_code)


class LogoutView(APIView):
    """Handles user logout by clearing JWT cookies."""

    permission_classes = [IsAuthenticated]

    def post(self, request):
        """Handle POST requests to log out the user and clear cookies."""
        response = JsonResponse({"message": "Logout successful."})
        response = delete_jwt_cookies(response)
        clear_refresh_cookie(response)
        return response


class LoginSecureView(APIView):
    """Enhanced login view that uses HttpOnly cookies for refresh tokens and returns access tokens."""
    
    permission_classes = [AllowAny]
    
    def post(self, request):
        """Handle POST requests to authenticate users and issue tokens."""
        username = request.data.get('username')
        password = request.data.get('password')
        
        logger.info(f"Login attempt for username: {username}")
        
        if not username or not password:
            logger.warning("Login attempt with missing credentials")
            return Response({"detail": "Username and password are required."}, status=400)
        
        try:
            user = User.objects.get(username=username)
            if not user.check_password(password):
                logger.warning(f"Invalid password for {username}")
                return Response({"detail": "Invalid username or password."}, status=401)
                
            # Create tokens
            refresh = RefreshToken.for_user(user)
            access_token = str(refresh.access_token)
            refresh_token = str(refresh)
            
            logger.info(f"Successful login for {username}")
            
            # Create response with access token in body
            response = Response({
                "access": access_token,
                "user": {
                    "id": user.id,
                    "username": user.username,
                    "email": user.email,
                    "first_name": user.first_name,
                    "last_name": user.last_name,
                    "is_staff": user.is_staff,
                    "is_superuser": user.is_superuser
                }
            })
            
            # Set refresh token as HttpOnly cookie
            set_refresh_cookie(response, refresh_token)
            
            # Update last login
            from django.utils.timezone import now
            user.last_login = now()
            user.save(update_fields=['last_login'])
            
            return response
            
        except User.DoesNotExist:
            logger.warning(f"Login attempt for non-existent user: {username}")
            return Response({"detail": "Invalid username or password."}, status=401)
        except Exception as e:
            logger.error(f"Login error: {str(e)}")
            return Response({"detail": "An error occurred during login."}, status=500)


class RegisterSecureView(generics.CreateAPIView):
    """Enhanced registration view that uses HttpOnly cookies for refresh tokens."""
    
    serializer_class = RegisterSerializer
    permission_classes = [AllowAny]

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()

        # Generate tokens
        refresh = RefreshToken.for_user(user)
        access_token = str(refresh.access_token)

        # Create response with access token
        response = Response({
            "access": access_token,
            "user": {
                "id": user.id,
                "username": user.username,
                "email": user.email,
                "first_name": user.first_name,
                "last_name": user.last_name,
                "is_staff": user.is_staff,
                "is_superuser": user.is_superuser
            },
            "next": "/all-topics"  # Redirect to all topics after registration
        }, status=status.HTTP_201_CREATED)

        # Set refresh token in HttpOnly cookie
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
    
    def post(self, request, *args, **kwargs):
        refresh_token = (
            request.COOKIES.get(REFRESH_COOKIE_NAME)
            or request.data.get("refresh")
            or request.headers.get("X-Refresh-Token")
        )

        if not refresh_token:
            logger.error("No refresh token provided for refresh endpoint")
            return Response({"detail": "No refresh token provided."}, status=400)

        serializer = self.get_serializer(data={"refresh": refresh_token})

        try:
            serializer.is_valid(raise_exception=True)
        except TokenError as exc:
            logger.error(f"Token refresh error: {exc}")
            response = Response({"detail": str(exc)}, status=401)
            clear_refresh_cookie(response)
            return response
        except Exception as exc:
            logger.error(f"Unexpected error during token refresh: {exc}", exc_info=True)
            return Response(
                {"detail": "An error occurred during token refresh."},
                status=500,
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


class UserSettingsView(APIView):
    """API view to retrieve and update user settings, including profile and preferences."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        """Handle GET requests to fetch the user's current settings."""
        user_profile = UserProfile.objects.get(user=request.user)
        return Response({
            "email_reminder_preference": user_profile.email_reminder_preference,
            "dark_mode": user_profile.dark_mode,
            "profile": {
                "username": request.user.username,
                "email": request.user.email,
                "first_name": request.user.first_name,
                "last_name": request.user.last_name,
                "dark_mode": user_profile.dark_mode,
            },
        })

    def patch(self, request):
        """Handle PATCH requests to update the user's settings."""
        user = request.user
        user_profile = user.profile

        # Update profile data
        profile_data = request.data.get('profile', {})
        if profile_data:
            user.username = profile_data.get('username', user.username)
            user.email = profile_data.get('email', user.email)
            user.first_name = profile_data.get('first_name', user.first_name)
            user.last_name = profile_data.get('last_name', user.last_name)
            user.save()

        # Update other settings
        dark_mode = request.data.get('dark_mode')
        if dark_mode is not None:
            user_profile.dark_mode = dark_mode

        email_reminder_preference = request.data.get('email_reminder_preference')
        if email_reminder_preference in dict(UserProfile.REMINDER_CHOICES):
            user_profile.email_reminder_preference = email_reminder_preference

        user_profile.save()
        
        # Return updated settings
        return Response({
            "message": "Settings updated successfully.",
            "dark_mode": user_profile.dark_mode,
            "email_reminder_preference": user_profile.email_reminder_preference
        })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def update_avatar(request):
    """Update the user's avatar with a valid DiceBear URL."""
    avatar_url = request.data.get('profile_avatar')

    if not avatar_url or not (
        avatar_url.startswith('https://avatars.dicebear.com/') or
        avatar_url.startswith('https://api.dicebear.com/')
    ):
        return Response(
            {"error": "Invalid avatar URL. Only DiceBear avatars are allowed."},
            status=status.HTTP_400_BAD_REQUEST
        )

    user_profile = request.user.profile
    user_profile.profile_avatar = avatar_url
    user_profile.save()

    return Response({"status": "success", "avatar_url": avatar_url})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def change_password(request):
    """Allow logged-in users to change their password."""
    user = request.user
    current_password = request.data.get('current_password')
    new_password = request.data.get('new_password')
    confirm_password = request.data.get('confirm_password')

    if not user.check_password(current_password):
        return Response({"error": "Current password is incorrect."}, status=400)

    if new_password != confirm_password:
        return Response({"error": "New passwords do not match."}, status=400)

    if len(new_password) < 8:
        return Response({"error": "Password must be at least 8 characters."}, status=400)

    user.set_password(new_password)
    user.save()
    update_session_auth_hash(request, user)  # Keep the user logged in

    return Response({"message": "Password changed successfully."}, status=200)


@api_view(["DELETE"])
@permission_classes([IsAuthenticated])
def delete_account(request):
    """Delete the currently authenticated user's account."""
    user = request.user
    try:
        user.delete()
        return Response({"message": "Account deleted successfully."}, status=200)
    except Exception as e:
        return Response({"error": str(e)}, status=500)


from rest_framework import viewsets
from django.utils.http import urlsafe_base64_encode, urlsafe_base64_decode
from django.utils.encoding import force_bytes, force_str
from django.contrib.auth.tokens import PasswordResetTokenGenerator
from django.core.mail import EmailMultiAlternatives
from django.template.loader import render_to_string
from django.utils.html import strip_tags


class PasswordResetRequestView(APIView):
    """Handle password reset requests by generating a reset token and sending an email with the reset link."""

    permission_classes = [AllowAny]

    def post(self, request):
        """Process password reset requests by validating the email and sending a reset link."""
        email = request.data.get('email')
        if not email:
            return Response({"error": "Email is required."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            user = User.objects.get(email=email)
            token = PasswordResetTokenGenerator().make_token(user)
            uid = urlsafe_base64_encode(force_bytes(user.pk))
            reset_link = f"{settings.FRONTEND_URL}/password-reset/{uid}/{token}"

            # Render the email content
            context = {
                'user': user,
                'reset_link': reset_link,
            }
            subject = "Password Reset Request"
            html_content = render_to_string("emails/password_reset.html", context)
            text_content = strip_tags(html_content)

            # Send the email
            email_message = EmailMultiAlternatives(subject, text_content, settings.DEFAULT_FROM_EMAIL, [user.email])
            email_message.attach_alternative(html_content, "text/html")
            email_message.send()

            return Response({"message": "Password reset link sent."}, status=status.HTTP_200_OK)
        except User.DoesNotExist:
            return Response({"error": "No user found with this email."}, status=status.HTTP_404_NOT_FOUND)


class PasswordResetConfirmView(APIView):
    """Handle password reset confirmation by validating the token and updating the user's password."""

    permission_classes = [AllowAny]

    def get(self, request, uidb64, token):
        """Validate the reset token and user ID to ensure the reset process can proceed."""
        try:
            uid = force_str(urlsafe_base64_decode(uidb64))
            user = User.objects.get(pk=uid)
        except (TypeError, ValueError, OverflowError, User.DoesNotExist):
            return Response({"error": "Invalid user ID or token."}, status=status.HTTP_400_BAD_REQUEST)

        if PasswordResetTokenGenerator().check_token(user, token):
            return Response({"message": "Token is valid, proceed with password reset."}, status=status.HTTP_200_OK)
        else:
            return Response({"error": "Invalid token."}, status=status.HTTP_400_BAD_REQUEST)

    def post(self, request, uidb64, token):
        """Reset the user's password after validating the token and ensuring the passwords match."""
        try:
            uid = force_str(urlsafe_base64_decode(uidb64))
            user = User.objects.get(pk=uid)
        except (TypeError, ValueError, OverflowError, User.DoesNotExist):
            return Response({"error": "Invalid user ID or token."}, status=status.HTTP_400_BAD_REQUEST)

        if not PasswordResetTokenGenerator().check_token(user, token):
            return Response({"error": "Invalid or expired token."}, status=status.HTTP_400_BAD_REQUEST)

        new_password = request.data.get("new_password")
        confirm_password = request.data.get("confirm_password")

        if not new_password or new_password != confirm_password:
            return Response({"error": "Passwords do not match."}, status=status.HTTP_400_BAD_REQUEST)

        user.set_password(new_password)
        user.save()

        return Response({"message": "Password reset successful."}, status=status.HTTP_200_OK)


class FriendRequestView(viewsets.ViewSet):
    """Handle friend request functionality, including sending, accepting, and rejecting requests."""

    permission_classes = [IsAuthenticated]

    def list(self, request):
        """Retrieve all pending friend requests for the authenticated user."""
        requests = FriendRequest.objects.filter(
            receiver=request.user,
            status='pending'
        )
        serializer = FriendRequestSerializer(requests, many=True)
        return Response(serializer.data)

    def create(self, request):
        """Send a friend request to another user."""
        receiver_id = request.data.get("receiver")

        if not receiver_id:
            return Response({"error": "Receiver ID is required"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            receiver = User.objects.get(id=receiver_id)

            if request.user == receiver:
                return Response({"error": "You cannot send a request to yourself"}, status=status.HTTP_400_BAD_REQUEST)

            existing_request = FriendRequest.objects.filter(sender=request.user, receiver=receiver, status="pending")
            if existing_request.exists():
                return Response({"error": "Friend request already sent"}, status=status.HTTP_400_BAD_REQUEST)

            FriendRequest.objects.create(sender=request.user, receiver=receiver)
            return Response({"message": "Friend request sent successfully"}, status=status.HTTP_201_CREATED)

        except User.DoesNotExist:
            return Response({"error": "User not found"}, status=status.HTTP_404_NOT_FOUND)

    def update(self, request, pk=None):
        """Accept or reject a friend request."""
        action = request.data.get("action")

        if action not in ["accept", "reject"]:
            return Response({"error": "Invalid action"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            friend_request = FriendRequest.objects.get(id=pk, receiver=request.user)

            if action == "accept":
                friend_request.status = "accepted"
                friend_request.save()
                return Response({"message": "Friend request accepted."}, status=status.HTTP_200_OK)

            elif action == "reject":
                friend_request.status = "rejected"
                friend_request.save()
                return Response({"message": "Friend request rejected."}, status=status.HTTP_200_OK)

        except FriendRequest.DoesNotExist:
            return Response({"error": "Friend request not found."}, status=status.HTTP_404_NOT_FOUND)

    @action(detail=False, methods=['get'])
    def get_sent_requests(self, request):
        """Retrieve all friend requests sent by the authenticated user."""
        requests = FriendRequest.objects.filter(sender=request.user)
        serializer = FriendRequestSerializer(requests, many=True)
        return Response(serializer.data)
        
    @action(detail=False, methods=['get'])
    def get_friends(self, request):
        """Retrieve all accepted friends of the authenticated user."""
        friends_ids = FriendRequest.objects.filter(
            models.Q(sender=request.user, status="accepted") | 
            models.Q(receiver=request.user, status="accepted")
        ).values_list(
            'receiver', 'sender'
        )
        
        # Flatten and remove duplicates
        user_ids = []
        for receiver_id, sender_id in friends_ids:
            if receiver_id != request.user.id:
                user_ids.append(receiver_id)
            if sender_id != request.user.id:
                user_ids.append(sender_id)
                
        friends = User.objects.filter(id__in=user_ids)
        serializer = UserSearchSerializer(friends, many=True)
        return Response(serializer.data)


class FriendsLeaderboardView(APIView):
    """Retrieve a leaderboard of the authenticated user's friends based on their points."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        """Fetch the top friends of the authenticated user sorted by points."""
        friends = User.objects.filter(
            id__in=FriendRequest.objects.filter(
                sender=request.user, status="accepted"
            ).values_list('receiver', flat=True)
        ).select_related('profile').order_by('-profile__points')[:10]

        leaderboard_data = []
        for friend in friends:
            leaderboard_data.append({
                "user": {
                    "id": friend.id,
                    "username": friend.username,
                    "profile_avatar": friend.profile.profile_avatar
                },
                "points": friend.profile.points
            })

        return Response(leaderboard_data)


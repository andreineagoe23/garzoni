import logging
from django.db import transaction

from rest_framework import generics, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.decorators import api_view, permission_classes

from authentication.user_display import user_display_dict
from authentication.models import UserProfile, UserEmailPreference
from authentication.serializers import (
    UserProfileSettingsSerializer,
    FinancialProfileSerializer,
    UserEmailPreferenceSerializer,
)
from authentication.services.profile import (
    build_activity_heatmap,
    build_profile_payload,
    invalidate_profile_cache,
)
from notifications.tasks import safe_enqueue_sync_user_to_customer_io

logger = logging.getLogger(__name__)


class UserProfileView(generics.GenericAPIView):
    """View to handle user profile data retrieval and updates."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        """Retrieve and return the user's profile data."""
        user_profile = UserProfile.objects.select_related("user").get(user=request.user)
        payload = build_profile_payload(request.user, user_profile)
        return Response(payload)

    def patch(self, request):
        """Update specific fields in the user's profile."""
        try:
            user_profile = request.user.profile
            payload = {}
            if "email_reminder_preference" in request.data:
                payload["email_reminder_preference"] = request.data.get("email_reminder_preference")
            if "subscription_plan_id" in request.data:
                payload["subscription_plan_id"] = request.data.get("subscription_plan_id")
            serializer = UserProfileSettingsSerializer(user_profile, data=payload, partial=True)
            serializer.is_valid(raise_exception=True)
            serializer.save()
            try:
                invalidate_profile_cache(request.user)
            except Exception:
                logger.warning(
                    "invalidate_profile_cache failed user_id=%s",
                    request.user.id,
                    exc_info=True,
                )
            uid = request.user.id
            transaction.on_commit(lambda: safe_enqueue_sync_user_to_customer_io(uid))
            return Response({"message": "Profile updated successfully."})
        except Exception as exc:
            # Sentry disabled (paid in production)
            # from django.conf import settings
            # if getattr(settings, "SENTRY_DSN", None):
            #     import sentry_sdk
            #     sentry_sdk.set_tag("error_type", "profile_update")
            #     sentry_sdk.capture_exception(exc)
            raise


class UserSettingsView(generics.GenericAPIView):
    """API view to retrieve and update user settings, including profile and preferences."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        """Handle GET requests to fetch the user's current settings."""
        user_profile = UserProfile.objects.get(user=request.user)
        # Legacy row-missing accounts get the same GDPR-safe service defaults as
        # a fresh signup: transactional prefs ON, marketing OFF (explicit opt-in
        # via the signup checkbox or the settings UI).
        email_prefs, _ = UserEmailPreference.objects.get_or_create(
            user=request.user,
            defaults={
                "reminders": True,
                "streak_alerts": True,
                "weekly_digest": True,
                "billing_alerts": True,
                "push_notifications": True,
                "reminder_frequency": "weekly",
                "marketing": False,
            },
        )
        return Response(
            {
                "email_reminder_preference": user_profile.email_reminder_preference,
                "dark_mode": user_profile.dark_mode,
                "sound_enabled": user_profile.sound_enabled,
                "animations_enabled": user_profile.animations_enabled,
                "email_preferences": UserEmailPreferenceSerializer(email_prefs).data,
                "profile": {
                    **user_display_dict(request.user, include_email=True),
                    "dark_mode": user_profile.dark_mode,
                },
            }
        )

    def patch(self, request):
        """Handle PATCH requests to update the user's settings."""
        try:
            user = request.user
            user_profile = user.profile

            profile_data = request.data.get("profile", {})
            if profile_data:
                user.username = profile_data.get("username", user.username)
                user.email = profile_data.get("email", user.email)
                user.first_name = profile_data.get("first_name", user.first_name)
                user.last_name = profile_data.get("last_name", user.last_name)
                user.save()

            dark_mode = request.data.get("dark_mode")
            if dark_mode is not None:
                user_profile.dark_mode = dark_mode
            sound_enabled = request.data.get("sound_enabled")
            if sound_enabled is not None:
                user_profile.sound_enabled = sound_enabled
            animations_enabled = request.data.get("animations_enabled")
            if animations_enabled is not None:
                user_profile.animations_enabled = animations_enabled

            email_reminder_preference = request.data.get("email_reminder_preference")
            if email_reminder_preference in dict(UserProfile.REMINDER_CHOICES):
                user_profile.email_reminder_preference = email_reminder_preference

            user_profile.save()
            email_preferences_payload = request.data.get("email_preferences")
            email_prefs, _ = UserEmailPreference.objects.get_or_create(
                user=user,
                defaults={
                    "reminders": True,
                    "streak_alerts": True,
                    "weekly_digest": True,
                    "billing_alerts": True,
                    "push_notifications": True,
                    "reminder_frequency": "weekly",
                    "marketing": False,
                },
            )
            if email_preferences_payload:
                email_serializer = UserEmailPreferenceSerializer(
                    email_prefs, data=email_preferences_payload, partial=True
                )
                email_serializer.is_valid(raise_exception=True)
                email_serializer.save()
                if email_prefs.reminder_frequency in dict(UserProfile.REMINDER_CHOICES):
                    user_profile.email_reminder_preference = email_prefs.reminder_frequency
                if not email_prefs.reminders:
                    user_profile.email_reminder_preference = "none"
                user_profile.save(update_fields=["email_reminder_preference"])
            elif email_reminder_preference in dict(UserProfile.REMINDER_CHOICES):
                email_prefs.reminder_frequency = email_reminder_preference
                email_prefs.reminders = email_reminder_preference != "none"
                email_prefs.save(update_fields=["reminder_frequency", "reminders", "updated_at"])
            try:
                invalidate_profile_cache(request.user)
            except Exception:
                logger.warning(
                    "invalidate_profile_cache failed user_id=%s",
                    request.user.id,
                    exc_info=True,
                )
            uid = request.user.id
            transaction.on_commit(lambda: safe_enqueue_sync_user_to_customer_io(uid))

            return Response(
                {
                    "message": "Settings updated successfully.",
                    "dark_mode": user_profile.dark_mode,
                    "email_reminder_preference": user_profile.email_reminder_preference,
                    "sound_enabled": user_profile.sound_enabled,
                    "animations_enabled": user_profile.animations_enabled,
                    "email_preferences": UserEmailPreferenceSerializer(email_prefs).data,
                }
            )
        except Exception as exc:
            # Sentry disabled (paid in production)
            # from django.conf import settings
            # if getattr(settings, "SENTRY_DSN", None):
            #     import sentry_sdk
            #     sentry_sdk.set_tag("error_type", "profile_update")
            #     sentry_sdk.capture_exception(exc)
            raise


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def update_avatar(request):
    """Update the user's avatar with a valid DiceBear URL."""
    avatar_url = request.data.get("profile_avatar")

    if not avatar_url or not (
        avatar_url.startswith("https://avatars.dicebear.com/")
        or avatar_url.startswith("https://api.dicebear.com/")
        or avatar_url.startswith("https://res.cloudinary.com/")
    ):
        return Response(
            {"error": "Invalid avatar URL. Only DiceBear and Cloudinary avatars are allowed."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    user_profile = request.user.profile
    user_profile.profile_avatar = avatar_url
    user_profile.save()
    try:
        invalidate_profile_cache(request.user)
    except Exception:
        logger.warning(
            "invalidate_profile_cache failed user_id=%s",
            request.user.id,
            exc_info=True,
        )

    return Response({"status": "success", "avatar_url": avatar_url})


class ActivityHeatmapView(generics.GenericAPIView):
    """Returns per-day activity counts for the last N days (default 60)."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            days = max(1, min(int(request.query_params.get("days", 60)), 365))
        except (TypeError, ValueError):
            days = 60
        data = build_activity_heatmap(request.user, days=days)
        return Response(data)


class FinancialProfileView(APIView):
    """GET/PUT a single financial profile source of truth."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        user_profile = request.user.profile
        serializer = FinancialProfileSerializer(user_profile)
        return Response(serializer.data)

    def put(self, request):
        user_profile = request.user.profile
        serializer = FinancialProfileSerializer(user_profile, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        try:
            invalidate_profile_cache(request.user)
        except Exception:
            logger.warning(
                "invalidate_profile_cache failed user_id=%s",
                request.user.id,
                exc_info=True,
            )
        uid = request.user.id
        transaction.on_commit(lambda: safe_enqueue_sync_user_to_customer_io(uid))
        return Response(serializer.data)

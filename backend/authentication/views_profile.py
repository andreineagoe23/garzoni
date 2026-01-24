from rest_framework import generics, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.decorators import api_view, permission_classes

from authentication.models import UserProfile
from authentication.serializers import UserProfileSettingsSerializer
from authentication.services.profile import build_profile_payload, invalidate_profile_cache


class UserProfileView(generics.GenericAPIView):
    """View to handle user profile data retrieval and updates."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        """Retrieve and return the user's profile data."""
        user_profile = UserProfile.objects.select_related("user", "subscription_plan").get(
            user=request.user
        )
        payload = build_profile_payload(request.user, user_profile)
        return Response(payload)

    def patch(self, request):
        """Update specific fields in the user's profile."""
        user_profile = request.user.profile
        payload = {}
        if "email_reminder_preference" in request.data:
            payload["email_reminder_preference"] = request.data.get("email_reminder_preference")
        serializer = UserProfileSettingsSerializer(user_profile, data=payload, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        invalidate_profile_cache(request.user)
        return Response({"message": "Profile updated successfully."})


class UserSettingsView(generics.GenericAPIView):
    """API view to retrieve and update user settings, including profile and preferences."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        """Handle GET requests to fetch the user's current settings."""
        user_profile = UserProfile.objects.get(user=request.user)
        return Response(
            {
                "email_reminder_preference": user_profile.email_reminder_preference,
                "dark_mode": user_profile.dark_mode,
                "profile": {
                    "username": request.user.username,
                    "email": request.user.email,
                    "first_name": request.user.first_name,
                    "last_name": request.user.last_name,
                    "dark_mode": user_profile.dark_mode,
                },
            }
        )

    def patch(self, request):
        """Handle PATCH requests to update the user's settings."""
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

        email_reminder_preference = request.data.get("email_reminder_preference")
        if email_reminder_preference in dict(UserProfile.REMINDER_CHOICES):
            user_profile.email_reminder_preference = email_reminder_preference

        user_profile.save()
        invalidate_profile_cache(request.user)

        return Response(
            {
                "message": "Settings updated successfully.",
                "dark_mode": user_profile.dark_mode,
                "email_reminder_preference": user_profile.email_reminder_preference,
            }
        )


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def update_avatar(request):
    """Update the user's avatar with a valid DiceBear URL."""
    avatar_url = request.data.get("profile_avatar")

    if not avatar_url or not (
        avatar_url.startswith("https://avatars.dicebear.com/")
        or avatar_url.startswith("https://api.dicebear.com/")
    ):
        return Response(
            {"error": "Invalid avatar URL. Only DiceBear avatars are allowed."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    user_profile = request.user.profile
    user_profile.profile_avatar = avatar_url
    user_profile.save()
    invalidate_profile_cache(request.user)

    return Response({"status": "success", "avatar_url": avatar_url})

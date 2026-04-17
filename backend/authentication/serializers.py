# authentication/serializers.py
from rest_framework import serializers
from django.contrib.auth.models import User

from authentication.user_display import normalize_display_string
from authentication.models import UserProfile, Referral, FriendRequest, UserEmailPreference


# Serializer for user registration, including optional referral code handling.
class RegisterSerializer(serializers.ModelSerializer):
    referral_code = serializers.CharField(write_only=True, required=False, allow_blank=True)

    class Meta:
        model = User
        fields = [
            "username",
            "password",
            "email",
            "first_name",
            "last_name",
            "referral_code",
        ]
        extra_kwargs = {"password": {"write_only": True}}

    def validate_referral_code(self, value):
        cleaned_code = (value or "").strip()
        if not cleaned_code:
            return ""
        exists = UserProfile.objects.filter(referral_code__iexact=cleaned_code).exists()
        if not exists:
            raise serializers.ValidationError("Invalid referral code.")
        return cleaned_code

    def create(self, validated_data):
        referral_code = validated_data.pop("referral_code", None)

        # Only create User here - profile is created by signal
        user = User.objects.create_user(**validated_data)

        # Access profile created by signal
        user_profile = user.profile
        user_profile.save()

        if referral_code:
            referrer_profile = UserProfile.objects.get(referral_code__iexact=referral_code)
            Referral.objects.create(
                referrer=referrer_profile.user,
                referred_user=user,
                referral_code=referrer_profile.referral_code,
            )
            referrer_profile.add_points(100)
            user_profile.add_points(50)

        return user


class UserProfileSettingsSerializer(serializers.ModelSerializer):
    """
    Serializer for user profile settings.
    Includes fields for managing user preferences such as email reminders.
    """

    subscription_plan_id = serializers.ChoiceField(
        choices=["starter", "plus", "pro"],
        required=False,
        allow_null=True,
    )

    class Meta:
        model = UserProfile
        fields = ["email_reminder_preference", "subscription_plan_id"]


class UserEmailPreferenceSerializer(serializers.ModelSerializer):
    class Meta:
        model = UserEmailPreference
        fields = [
            "reminders",
            "streak_alerts",
            "weekly_digest",
            "billing_alerts",
            "marketing",
            "push_notifications",
            "reminder_frequency",
        ]


ALLOWED_GOAL_TYPES = {
    "save",
    "emergency",
    "savings",
    "invest",
    "wealth",
    "portfolio",
    "debt",
    "loan",
    "mortgage",
    "retirement",
    "education",
    "other",
}
ALLOWED_TIMEFRAMES = {
    "",
    "short",
    "medium",
    "long",
    "1-3",
    "3-5",
    "5-10",
    "10+",
    "1-3 years",
    "3-5 years",
    "5+ years",
}
ALLOWED_RISK_COMFORT = {"", "low", "medium", "high", "conservative", "moderate", "aggressive"}
ALLOWED_INCOME_RANGE = {
    "",
    "under_30k",
    "30k_50k",
    "50k_80k",
    "80k_120k",
    "120k_plus",
    "prefer_not",
}
ALLOWED_SAVINGS_RATE = {"", "low", "medium", "high", "0-5", "5-10", "10-20", "20+"}
ALLOWED_INVESTING_EXPERIENCE = {"", "new", "beginner", "intermediate", "advanced", "experienced"}


class FinancialProfileSerializer(serializers.ModelSerializer):
    """Serializer for the user's financial profile (tools source of truth). Validates allowed values."""

    class Meta:
        model = UserProfile
        fields = [
            "goal_types",
            "timeframe",
            "risk_comfort",
            "income_range",
            "savings_rate_estimate",
            "investing_experience",
        ]

    def validate_goal_types(self, value):
        if not isinstance(value, list):
            raise serializers.ValidationError("Must be a list of strings.")
        for g in value:
            if not isinstance(g, str) or not g.strip():
                continue
            if ALLOWED_GOAL_TYPES and g.strip().lower() not in {
                x.lower() for x in ALLOWED_GOAL_TYPES
            }:
                pass  # allow unknown for flexibility; optionally restrict: raise ValidationError
        return [str(x).strip().lower() for x in value if isinstance(x, str) and str(x).strip()][:20]

    def validate_timeframe(self, value):
        if value is None or value == "":
            return ""
        v = str(value).strip().lower()
        if len(v) > 32:
            raise serializers.ValidationError("Max 32 characters.")
        return v

    def validate_risk_comfort(self, value):
        if value is None or value == "":
            return ""
        v = str(value).strip().lower()
        if len(v) > 32:
            raise serializers.ValidationError("Max 32 characters.")
        return v

    def validate_income_range(self, value):
        if value is None or value == "":
            return ""
        v = str(value).strip()
        if len(v) > 64:
            raise serializers.ValidationError("Max 64 characters.")
        return v

    def validate_savings_rate_estimate(self, value):
        if value is None or value == "":
            return ""
        v = str(value).strip()
        if len(v) > 32:
            raise serializers.ValidationError("Max 32 characters.")
        return v

    def validate_investing_experience(self, value):
        if value is None or value == "":
            return ""
        v = str(value).strip().lower()
        if len(v) > 32:
            raise serializers.ValidationError("Max 32 characters.")
        return v


class UserProfileSerializer(serializers.ModelSerializer):
    """
    Serializer for the UserProfile model.
    Provides a detailed representation of a user's profile, including user details, preferences,
    earned money, points, profile picture, badges, referral code, and dark mode preference.
    """

    user = serializers.SerializerMethodField()
    balance = serializers.SerializerMethodField()
    badges = serializers.SerializerMethodField()
    referral_code = serializers.CharField(read_only=True)

    class Meta:
        model = UserProfile
        fields = [
            "user",
            "email_reminder_preference",
            "earned_money",
            "points",
            "profile_picture",
            "profile_avatar",
            "generated_images",
            "balance",
            "badges",
            "referral_code",
            "dark_mode",
        ]

    def get_balance(self, obj):
        return float(obj.earned_money)

    def get_user(self, obj):
        from authentication.user_display import user_display_dict

        d = user_display_dict(obj.user, include_id=True, include_email=True)
        return {
            "id": d["id"],
            "username": d["username"],
            "email": d["email"],
            "first_name": d["first_name"],
            "last_name": d["last_name"],
        }

    def get_badges(self, obj):
        from gamification.serializers import UserBadgeSerializer

        badges = obj.user.earned_badges.all()
        return UserBadgeSerializer(badges, many=True, context=self.context).data


class ReferralSerializer(serializers.ModelSerializer):
    """
    Serializer for the Referral model.
    Tracks referrals made by users, including details about the referred user and the timestamp of the referral.
    """

    referred_user = serializers.SerializerMethodField()
    created_at = serializers.DateTimeField(format="%Y-%m-%d %H:%M:%S")

    class Meta:
        model = Referral
        fields = ["referred_user", "created_at"]

    def get_referred_user(self, obj):
        from authentication.user_display import user_display_dict

        d = user_display_dict(obj.referred_user, include_id=True)
        return {"id": d["id"], "username": d["username"]}


class UserSearchSerializer(serializers.ModelSerializer):
    """
    Serializer for the User model.
    Provides a minimal representation of a user, including their ID and username, for search purposes.
    """

    username = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ["id", "username"]

    def get_username(self, obj):
        return normalize_display_string(obj.username)


class FriendRequestSerializer(serializers.ModelSerializer):
    """
    Serializer for the FriendRequest model.
    Represents friend requests between users, including details about the sender, receiver, status, and timestamp.
    """

    sender = serializers.SerializerMethodField()
    receiver = serializers.SerializerMethodField()

    class Meta:
        model = FriendRequest
        fields = ["id", "sender", "receiver", "status", "created_at"]

    def get_sender(self, obj):
        from authentication.user_display import user_display_dict

        d = user_display_dict(obj.sender, include_id=True)
        return {"id": d["id"], "username": d["username"]}

    def get_receiver(self, obj):
        from authentication.user_display import user_display_dict

        d = user_display_dict(obj.receiver, include_id=True)
        return {"id": d["id"], "username": d["username"]}

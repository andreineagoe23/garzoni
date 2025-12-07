# authentication/serializers.py
from rest_framework import serializers
from django.contrib.auth.models import User
from authentication.models import UserProfile, Referral, FriendRequest

# Serializer for user registration, including optional referral code handling.
class RegisterSerializer(serializers.ModelSerializer):
    referral_code = serializers.CharField(write_only=True, required=False, allow_blank=True)

    class Meta:
        model = User
        fields = ['username', 'password', 'email', 'first_name', 'last_name', 'referral_code']
        extra_kwargs = {'password': {'write_only': True}}

    def create(self, validated_data):
        referral_code = validated_data.pop('referral_code', None)

        # Only create User here - profile is created by signal
        user = User.objects.create_user(**validated_data)

        # Access profile created by signal
        user_profile = user.profile
        user_profile.save()

        if referral_code:
            try:
                referrer_profile = UserProfile.objects.get(referral_code=referral_code)
                Referral.objects.create(referrer=referrer_profile.user, referred_user=user)
                referrer_profile.add_points(100)
                user_profile.add_points(50)
            except UserProfile.DoesNotExist:
                pass

        return user


class UserProfileSettingsSerializer(serializers.ModelSerializer):
    """
    Serializer for user profile settings. 
    Includes fields for managing user preferences such as email reminders.
    """
    class Meta:
        model = UserProfile
        fields = ['email_reminder_preference']


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
            "user", "email_reminder_preference", "earned_money", "points", "profile_picture",
            "profile_avatar", "generated_images", "balance", "badges", "referral_code", "dark_mode"
        ]

    def get_balance(self, obj):
        return float(obj.earned_money)

    def get_user(self, obj):
        return {
            "id": obj.user.id,
            "username": obj.user.username,
            "email": obj.user.email,
            "first_name": obj.user.first_name,
            "last_name": obj.user.last_name
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
        fields = ['referred_user', 'created_at']

    def get_referred_user(self, obj):
        return {
            "id": obj.referred_user.id,
            "username": obj.referred_user.username
        }


class UserSearchSerializer(serializers.ModelSerializer):
    """
    Serializer for the User model.
    Provides a minimal representation of a user, including their ID and username, for search purposes.
    """
    class Meta:
        model = User
        fields = ['id', 'username']


class FriendRequestSerializer(serializers.ModelSerializer):
    """
    Serializer for the FriendRequest model.
    Represents friend requests between users, including details about the sender, receiver, status, and timestamp.
    """
    sender = serializers.SerializerMethodField()
    receiver = serializers.SerializerMethodField()

    class Meta:
        model = FriendRequest
        fields = ['id', 'sender', 'receiver', 'status', 'created_at']

    def get_sender(self, obj):
        return {
            "id": obj.sender.id,
            "username": obj.sender.username
        }

    def get_receiver(self, obj):
        return {
            "id": obj.receiver.id,
            "username": obj.receiver.username
        }


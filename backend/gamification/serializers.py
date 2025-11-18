# gamification/serializers.py
from rest_framework import serializers
from gamification.models import Badge, UserBadge, Mission, MissionCompletion
from authentication.models import UserProfile


class BadgeSerializer(serializers.ModelSerializer):
    """
    Serializer for the Badge model.
    Represents badges that users can earn, including details such as name, description, image URL, criteria type, threshold, and badge level.
    """
    image_url = serializers.SerializerMethodField()

    class Meta:
        model = Badge
        fields = ['id', 'name', 'description', 'image_url', 'criteria_type', 'threshold', 'badge_level']

    def get_image_url(self, obj):
        """
        Returns the absolute URL of the badge image if it exists.
        """
        if obj.image:
            request = self.context.get('request')
            return request.build_absolute_uri(obj.image.url)
        return None


class UserBadgeSerializer(serializers.ModelSerializer):
    """
    Serializer for the UserBadge model.
    Represents badges earned by users, including details about the badge and the timestamp when it was earned.
    """
    badge = BadgeSerializer(read_only=True)

    class Meta:
        model = UserBadge
        fields = ['badge', 'earned_at']


class MissionCompletionSerializer(serializers.ModelSerializer):
    """
    Serializer for the MissionCompletion model. 
    Tracks the progress and status of a user's mission, including goal type and target.
    """
    goal_type = serializers.CharField(source="mission.goal_type")
    target = serializers.SerializerMethodField()

    class Meta:
        model = MissionCompletion
        fields = ["id", "mission", "goal_type", "target", "progress", "status"]

    def get_target(self, obj):
        return obj.mission.goal_reference.get('target', 100) if obj.mission.goal_reference else 100


class LeaderboardSerializer(serializers.ModelSerializer):
    """
    Serializer for the leaderboard, representing user rankings based on points. 
    Includes user details and their total points.
    """
    user = serializers.SerializerMethodField()

    class Meta:
        model = UserProfile
        fields = ['user', 'points']

    def get_user(self, obj):
        return {
            "id": obj.user.id,
            "username": obj.user.username,
            "email": obj.user.email,
            "profile_avatar": obj.profile_avatar
        }


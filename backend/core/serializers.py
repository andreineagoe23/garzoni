# core/serializers.py
from rest_framework import serializers
from django.contrib.auth.models import User
from .models import ( UserProfile, Course, Lesson, Quiz, Path, UserProgress, Questionnaire, Tool, Mission, MissionCompletion, 
SimulatedSavingsAccount, Question, UserResponse, PathRecommendation, Reward, UserPurchase, Badge, UserBadge )

class RegisterSerializer(serializers.ModelSerializer):
    wants_personalized_path = serializers.BooleanField(write_only=True, required=False)

    class Meta:
        model = User
        fields = ['username', 'password', 'email', 'first_name', 'last_name', 'wants_personalized_path']
        extra_kwargs = {'password': {'write_only': True}}

    def create(self, validated_data):
        wants_personalized_path = validated_data.pop('wants_personalized_path', False)
        user = User.objects.create_user(**validated_data)
        UserProfile.objects.create(user=user)

        # Update UserProfile with the user's choice
        user.userprofile.wants_personalized_path = wants_personalized_path
        user.userprofile.save()
        return user



class QuizSerializer(serializers.ModelSerializer):
    class Meta:
        model = Quiz
        fields = ['id', 'course', 'title', 'question', 'choices', 'correct_answer']

class LessonSerializer(serializers.ModelSerializer):
    quizzes = QuizSerializer(many=True, read_only=True)

    class Meta:
        model = Lesson
        fields = [
            'id', 'course', 'title', 'detailed_content', 'quizzes', 
            'short_description', 'image', 'video_url', 'exercise_type', 'exercise_data'
        ]

class CourseSerializer(serializers.ModelSerializer):
    lessons = LessonSerializer(many=True, read_only=True)
    quizzes = QuizSerializer(many=True, read_only=True)
    image = serializers.SerializerMethodField() 
    completed_lessons = serializers.SerializerMethodField()
    total_lessons = serializers.SerializerMethodField()

    class Meta:
        model = Course
        fields = ['id', 'path', 'title', 'description', 'lessons', 'quizzes', 'image', 'completed_lessons', 'total_lessons']

    def get_image(self, obj):
        if obj.image:
            request = self.context.get('request')
            return request.build_absolute_uri(obj.image.url)
        return None

    def get_completed_lessons(self, obj):
        user = self.context['request'].user
        if user.is_authenticated:
            progress = UserProgress.objects.filter(user=user, course=obj).first()
            return progress.completed_lessons.count() if progress else 0
        return 0

    def get_total_lessons(self, obj):
        return obj.lessons.count()

class PathSerializer(serializers.ModelSerializer):
    courses = CourseSerializer(many=True, read_only=True)

    class Meta:
        model = Path
        fields = ['id', 'title', 'description', 'courses', 'image']

class UserProgressSerializer(serializers.ModelSerializer):
    class Meta:
        model = UserProgress
        fields = ['id', 'user', 'course', 'completed_lessons', 'is_course_complete']
        read_only_fields = ['user']


class LeaderboardSerializer(serializers.ModelSerializer):
    user = serializers.SerializerMethodField()

    class Meta:
        model = UserProfile
        fields = ['user', 'points']

    def get_user(self, obj):
        return {
            "id": obj.user.id,
            "username": obj.user.username,
            "email": obj.user.email,
        }

class UserProfileSettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model = UserProfile
        fields = ['email_reminders']

class QuestionnaireSerializer(serializers.ModelSerializer):
    class Meta:
        model = Questionnaire
        fields = ['goal', 'experience', 'preferred_style']

class ToolSerializer(serializers.ModelSerializer):
    class Meta:
        model = Tool
        fields = ['id', 'name', 'description', 'url', 'category', 'icon']


class MissionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Mission
        fields = ['id', 'name', 'description', 'points_reward', 'mission_type', 'goal_type', 'goal_reference']


class MissionCompletionSerializer(serializers.ModelSerializer):
    goal_type = serializers.CharField(source="mission.goal_type")

    class Meta:
        model = MissionCompletion
        fields = [
            "id",
            "mission",
            "goal_type",  # Include goal_type in the response
            "progress",
            "status",
        ]

class SimulatedSavingsAccountSerializer(serializers.ModelSerializer):
    class Meta:
        model = SimulatedSavingsAccount
        fields = ["id", "user", "balance"]

class QuestionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Question
        fields = '__all__'

class UserResponseSerializer(serializers.ModelSerializer):
    class Meta:
        model = UserResponse
        fields = '__all__'

class PathRecommendationSerializer(serializers.ModelSerializer):
    class Meta:
        model = PathRecommendation
        fields = '__all__'


class RewardSerializer(serializers.ModelSerializer):
    class Meta:
        model = Reward
        fields = ['id', 'name', 'description', 'cost', 'type', 'image', 'donation_organization']

class UserPurchaseSerializer(serializers.ModelSerializer):
    reward = RewardSerializer(read_only=True) 

    class Meta:
        model = UserPurchase
        fields = ['id', 'reward', 'purchased_at']
        read_only_fields = ['reward', 'purchased_at']

    def create(self, validated_data):

        reward = validated_data.get('reward')
        return UserPurchase.objects.create(
            user=self.context['request'].user,
            reward=reward
        )

class BadgeSerializer(serializers.ModelSerializer):
    image_url = serializers.SerializerMethodField()

    class Meta:
        model = Badge
        fields = ['id', 'name', 'description', 'image_url', 'criteria_type', 'threshold', 'badge_level']

    def get_image_url(self, obj):
        if obj.image:
            request = self.context.get('request')
            return request.build_absolute_uri(obj.image.url)
        return None

class UserBadgeSerializer(serializers.ModelSerializer):
    badge = BadgeSerializer(read_only=True)
    
    class Meta:
        model = UserBadge
        fields = ['badge', 'earned_at']

class UserProfileSerializer(serializers.ModelSerializer):
    user = serializers.SerializerMethodField()
    balance = serializers.SerializerMethodField()
    badges = UserBadgeSerializer(many=True, read_only=True, source='user.earned_badges')

    class Meta:
        model = UserProfile
        fields = [
            "user", "email_reminders", "earned_money", "points", "profile_picture",
            "profile_avatar", "generated_images", "balance", "badges"
        ]

    def get_balance(self, obj):
        return float(obj.earned_money)

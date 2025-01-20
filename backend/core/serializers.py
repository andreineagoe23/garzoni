# core/serializers.py
from rest_framework import serializers
from django.contrib.auth.models import User
from .models import UserProfile, Course, Lesson, Quiz, Path, UserProgress, Questionnaire, Tool, Mission, MissionCompletion, SimulatedSavingsAccount, Question, UserResponse, PathRecommendation

class RegisterSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['username', 'password', 'email', 'first_name', 'last_name']
        extra_kwargs = {'password': {'write_only': True}}

    def create(self, validated_data):
        user = User.objects.create_user(
            username=validated_data['username'],
            password=validated_data['password'],
            email=validated_data['email'],
            first_name=validated_data['first_name'],
            last_name=validated_data['last_name']
        )
        UserProfile.objects.create(user=user)
        return user

# serializers.py
class UserProfileSerializer(serializers.ModelSerializer):
    user = serializers.SerializerMethodField()

    class Meta:
        model = UserProfile
        fields = ["user", "email_reminders", "earned_money", "points", "profile_picture", "profile_avatar", "generated_images"]

    def get_user(self, obj):
        return {
            "id": obj.user.id,
            "username": obj.user.username,
            "email": obj.user.email,
        }


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

    class Meta:
        model = Course
        fields = ['id', 'path', 'title', 'description', 'lessons', 'quizzes']

class PathSerializer(serializers.ModelSerializer):
    courses = CourseSerializer(many=True, read_only=True)

    class Meta:
        model = Path
        fields = ['id', 'title', 'description', 'courses']

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
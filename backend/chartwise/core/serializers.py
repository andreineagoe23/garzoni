# core/serializers.py
from rest_framework import serializers
from django.contrib.auth.models import User
from .models import UserProfile, Course, Lesson, Quiz, Path
from .models import UserProgress

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
        return user

class UserProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = UserProfile
        fields = '__all__'

class PathSerializer(serializers.ModelSerializer):
    courses = serializers.StringRelatedField(many=True, read_only=True)

    class Meta:
        model = Path
        fields = ['id', 'title', 'description', 'courses']

class CourseSerializer(serializers.ModelSerializer):
    lessons = serializers.StringRelatedField(many=True, read_only=True)

    class Meta:
        model = Course
        fields = ['id', 'path', 'title', 'description', 'lessons']

class LessonSerializer(serializers.ModelSerializer):
    quizzes = serializers.StringRelatedField(many=True, read_only=True)

    class Meta:
        model = Lesson
        fields = ['id', 'course', 'title', 'content', 'quizzes']

class QuizSerializer(serializers.ModelSerializer):
    class Meta:
        model = Quiz
        fields = '__all__'

class UserProgressSerializer(serializers.ModelSerializer):
    class Meta:
        model = UserProgress
        fields = ['id', 'user', 'course', 'completed_lessons', 'is_course_complete']
        read_only_fields = ['user']  # Auto-assign user based on the logged-in user

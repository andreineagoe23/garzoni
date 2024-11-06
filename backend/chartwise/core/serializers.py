# core/serializers.py
from rest_framework import serializers
from django.contrib.auth.models import User
from .models import UserProfile, Course, Lesson, Quiz, Path, UserProgress

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

class UserProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = UserProfile
        fields = '__all__'

class QuizSerializer(serializers.ModelSerializer):
    class Meta:
        model = Quiz
        fields = '__all__'

class LessonSerializer(serializers.ModelSerializer):
    quizzes = QuizSerializer(many=True, read_only=True)  # Changed for detailed quiz info

    class Meta:
        model = Lesson
        fields = ['id', 'course', 'title', 'content', 'quizzes', 'short_description', 'image']

class CourseSerializer(serializers.ModelSerializer):
    lessons = LessonSerializer(many=True, read_only=True)  # Changed for detailed lesson info

    class Meta:
        model = Course
        fields = ['id', 'path', 'title', 'description', 'lessons']

class PathSerializer(serializers.ModelSerializer):
    courses = CourseSerializer(many=True, read_only=True)  # Changed for detailed course info

    class Meta:
        model = Path
        fields = ['id', 'title', 'description', 'courses']

class UserProgressSerializer(serializers.ModelSerializer):
    class Meta:
        model = UserProgress
        fields = ['id', 'user', 'course', 'completed_lessons', 'is_course_complete']
        read_only_fields = ['user']

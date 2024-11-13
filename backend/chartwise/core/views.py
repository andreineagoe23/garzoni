from rest_framework import viewsets, serializers, generics, status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.decorators import action
from django.contrib.auth.models import User
from .models import UserProfile, Course, Lesson, Quiz, Path, UserProgress
from .serializers import (
    UserProfileSerializer, CourseSerializer, LessonSerializer, 
    QuizSerializer, PathSerializer, RegisterSerializer, UserProgressSerializer
)

# User profile view
class UserProfileView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        # Get the logged-in user's data
        user = request.user
        user_data = {
            "first_name": user.first_name,
            "last_name": user.last_name,
            "email": user.email,
            "username": user.username,
        }
        return Response(user_data)


# User registration view
class RegisterView(generics.CreateAPIView):
    serializer_class = RegisterSerializer
    permission_classes = [AllowAny]

class PathViewSet(viewsets.ModelViewSet):
    queryset = Path.objects.all()
    serializer_class = PathSerializer

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

class UserProfileViewSet(viewsets.ModelViewSet):
    queryset = UserProfile.objects.all()
    serializer_class = UserProfileSerializer

class CourseViewSet(viewsets.ModelViewSet):
    queryset = Course.objects.all()
    serializer_class = CourseSerializer

class LessonViewSet(viewsets.ModelViewSet):
    queryset = Lesson.objects.all()
    serializer_class = LessonSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        queryset = super().get_queryset()
        course_id = self.request.query_params.get("course", None)
        if course_id:
            queryset = queryset.filter(course_id=course_id)
        return queryset

    @action(detail=False, methods=["get"], permission_classes=[IsAuthenticated])
    def with_progress(self, request):
        course_id = request.query_params.get("course", None)
        if not course_id:
            return Response({"error": "Course ID is required."}, status=400)

        lessons = self.get_queryset().filter(course_id=course_id)
        user_progress = UserProgress.objects.filter(user=request.user, course_id=course_id).first()

        completed_count = user_progress.completed_lessons if user_progress else 0
        lesson_data = []
        
        for i, lesson in enumerate(lessons):
            lesson_data.append({
                "id": lesson.id,
                "title": lesson.title,
                "short_description": lesson.short_description,
                "accessible": i <= completed_count,
            })
        
        return Response(lesson_data)


class QuizViewSet(viewsets.ModelViewSet):
    queryset = Quiz.objects.all()
    serializer_class = QuizSerializer


class UserProgressViewSet(viewsets.ModelViewSet):
    queryset = UserProgress.objects.all()
    serializer_class = UserProgressSerializer
    permission_classes = [IsAuthenticated]

    @action(detail=False, methods=['post'], url_path='complete')
    def complete(self, request):
        lesson_id = request.data.get('lesson_id')
        if not lesson_id:
            return Response({"error": "lesson_id is required"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            lesson = Lesson.objects.get(id=lesson_id)
        except Lesson.DoesNotExist:
            return Response({"error": "Lesson not found"}, status=status.HTTP_404_NOT_FOUND)

        # Proceed with marking the lesson as completed for the logged-in user
        user_progress, created = UserProgress.objects.get_or_create(
            user=request.user,
            course=lesson.course
        )

        user_progress.completed_lessons += 1
        if user_progress.completed_lessons == lesson.course.lessons.count():
            user_progress.is_course_complete = True
        user_progress.save()

        return Response({"status": "Lesson completed", "is_course_complete": user_progress.is_course_complete}, status=status.HTTP_200_OK)
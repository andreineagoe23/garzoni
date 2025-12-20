# education/serializers.py
from rest_framework import serializers
from education.models import (
    Path,
    Course,
    Lesson,
    LessonSection,
    Quiz,
    UserProgress,
    LessonCompletion,
    QuizCompletion,
    Exercise,
    UserExerciseProgress,
    Questionnaire,
    Question,
    UserResponse,
    PathRecommendation,
)


# Serializer for quizzes, including fields for course association and question details.
class QuizSerializer(serializers.ModelSerializer):
    class Meta:
        model = Quiz
        fields = ["id", "course", "title", "question", "choices", "correct_answer"]


# Serializer for lesson sections, supporting various content types like text, video, and exercises.
class LessonSectionSerializer(serializers.ModelSerializer):
    content_type = serializers.CharField()
    updated_by = serializers.SerializerMethodField()

    class Meta:
        model = LessonSection
        fields = [
            "id",
            "order",
            "title",
            "content_type",
            "text_content",
            "video_url",
            "exercise_type",
            "exercise_data",
            "is_published",
            "updated_at",
            "updated_by",
        ]

    def get_updated_by(self, obj):
        return obj.updated_by.username if obj.updated_by else None


class LessonSectionWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model = LessonSection
        fields = [
            "id",
            "lesson",
            "order",
            "title",
            "content_type",
            "text_content",
            "video_url",
            "exercise_type",
            "exercise_data",
            "is_published",
        ]
        read_only_fields = ["id", "lesson"]


# Serializer for lessons, including sections and a computed field for completion status.
class LessonSerializer(serializers.ModelSerializer):
    sections = LessonSectionSerializer(many=True, read_only=True)
    is_completed = serializers.SerializerMethodField()

    class Meta:
        model = Lesson
        fields = ["id", "title", "short_description", "sections", "is_completed"]

    def get_is_completed(self, obj):
        completed_lesson_ids = self.context.get("completed_lesson_ids", [])
        return obj.id in completed_lesson_ids


class CourseSerializer(serializers.ModelSerializer):
    """
    Serializer for the Course model. Includes fields for the associated path title,
    lessons, quizzes, and computed fields for the course image, completed lessons,
    and total lessons. Provides a detailed representation of a course.
    """

    path_title = serializers.CharField(source="path.title")
    lessons = LessonSerializer(many=True, read_only=True)
    quizzes = QuizSerializer(many=True, read_only=True)
    image = serializers.SerializerMethodField()
    completed_lessons = serializers.SerializerMethodField()
    total_lessons = serializers.SerializerMethodField()

    class Meta:
        model = Course
        fields = [
            "id",
            "path",
            "path_title",
            "title",
            "description",
            "lessons",
            "quizzes",
            "image",
            "completed_lessons",
            "total_lessons",
        ]

    def get_image(self, obj):
        if obj.image:
            request = self.context.get("request")
            return request.build_absolute_uri(obj.image.url)
        return None

    def get_completed_lessons(self, obj):
        user = self.context["request"].user
        if user.is_authenticated:
            progress = UserProgress.objects.filter(user=user, course=obj).first()
            return progress.completed_lessons.count() if progress else 0
        return 0

    def get_total_lessons(self, obj):
        return obj.lessons.count()


class PathSerializer(serializers.ModelSerializer):
    """
    Serializer for the Path model. Includes fields for the title, description,
    associated courses, and the path image. Provides a detailed representation of a learning path.
    """

    courses = CourseSerializer(many=True, read_only=True)

    class Meta:
        model = Path
        fields = ["id", "title", "description", "courses", "image"]


class UserProgressSerializer(serializers.ModelSerializer):
    """
    Serializer for the UserProgress model. Tracks the user's progress in a course,
    including completed lessons and whether the course is complete.
    """

    class Meta:
        model = UserProgress
        fields = ["id", "user", "course", "completed_lessons", "is_course_complete"]
        read_only_fields = ["user"]


class QuestionnaireSerializer(serializers.ModelSerializer):
    """
    Serializer for the Questionnaire model.
    Captures user preferences and experiences, including goals, experience level, and preferred learning style.
    """

    class Meta:
        model = Questionnaire
        fields = ["goal", "experience", "preferred_style"]


class QuestionSerializer(serializers.ModelSerializer):
    """
    Serializer for the Question model.
    Represents questions with details such as text, type, options, explanation, and order.
    """

    class Meta:
        model = Question
        fields = ["id", "text", "type", "options", "explanation", "order"]
        read_only_fields = ["id", "created_at"]


class UserResponseSerializer(serializers.ModelSerializer):
    """
    Serializer for the UserResponse model.
    Captures user responses to questions, including the user, question, and their answer.
    """

    class Meta:
        model = UserResponse
        fields = ["user", "question", "answer"]
        read_only_fields = ["user"]


class PathRecommendationSerializer(serializers.ModelSerializer):
    """
    Serializer for the PathRecommendation model.
    Provides a representation of recommended learning paths for users.
    """

    class Meta:
        model = PathRecommendation
        fields = "__all__"


class ExerciseSerializer(serializers.ModelSerializer):
    """
    Serializer for the Exercise model.
    Represents exercises with details such as type, question, exercise data, category, and difficulty level.
    """

    class Meta:
        model = Exercise
        fields = [
            "id",
            "type",
            "question",
            "exercise_data",
            "category",
            "difficulty",
            "version",
            "is_published",
            "misconception_tags",
            "error_patterns",
        ]


class UserExerciseProgressSerializer(serializers.ModelSerializer):
    """
    Serializer for the UserExerciseProgress model.
    Tracks a user's progress in exercises, including the exercise details, completion status,
    number of attempts, and the user's answer.
    """

    class Meta:
        model = UserExerciseProgress
        fields = ["exercise", "completed", "attempts", "user_answer"]
        read_only_fields = ["user"]

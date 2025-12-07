# education/views.py
from rest_framework import viewsets, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.decorators import action, api_view, permission_classes
from django.utils import timezone
from django.db import transaction
from django.db.models import F, Prefetch
from decimal import Decimal
from collections import defaultdict
import json
import logging
import stripe
from django.conf import settings

from education.models import (
    Path, Course, Lesson, LessonSection, Quiz, UserProgress,
    LessonCompletion, QuizCompletion, Exercise, UserExerciseProgress,
    Question, UserResponse
)
from education.serializers import (
    PathSerializer,
    CourseSerializer,
    LessonSerializer,
    LessonSectionSerializer,
    LessonSectionWriteSerializer,
    QuizSerializer,
    UserProgressSerializer,
    ExerciseSerializer,
    QuestionSerializer,
)
from education.permissions import IsStaffOrSuperuser
from education.utils import log_admin_action
from authentication.models import UserProfile
from gamification.models import MissionCompletion

logger = logging.getLogger(__name__)


class PathViewSet(viewsets.ModelViewSet):
    """ViewSet to manage paths, including listing and retrieving paths."""

    queryset = Path.objects.all()
    serializer_class = PathSerializer
    permission_classes = [IsAuthenticated]

    def list(self, request, *args, **kwargs):
        """Handle GET requests to list all paths."""
        return super().list(request, *args, **kwargs)


class CourseViewSet(viewsets.ModelViewSet):
    """ViewSet to manage courses, including listing, retrieving, and updating course data."""
    queryset = Course.objects.all()
    serializer_class = CourseSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        """Filter courses by path if path_id is provided."""
        queryset = Course.objects.all()
        path_id = self.request.query_params.get('path', None)
        if path_id:
            queryset = queryset.filter(path_id=path_id)
        return queryset


class LessonViewSet(viewsets.ModelViewSet):
    """ViewSet to manage lessons, including tracking progress and marking sections as complete."""
    queryset = Lesson.objects.all()
    serializer_class = LessonSerializer
    permission_classes = [IsAuthenticated]

    def get_permissions(self):
        admin_actions = {
            "create",
            "update",
            "partial_update",
            "destroy",
            "add_section",
            "update_section",
            "delete_section",
            "reorder_sections",
        }

        if getattr(self, "action", None) in admin_actions:
            permissions = [IsAuthenticated, IsStaffOrSuperuser]
        else:
            permissions = [IsAuthenticated]

        return [permission() for permission in permissions]

    @action(detail=True, methods=['post'])
    def complete_section(self, request, pk=None):
        """Mark a specific section of a lesson as completed."""
        lesson = self.get_object()
        section_id = request.data.get('section_id')

        # Track progress
        progress, _ = UserProgress.objects.get_or_create(
            user=request.user,
            course=lesson.course
        )
        try:
            section = LessonSection.objects.get(id=section_id)
            if not section.is_published and not (
                request.user.is_staff or request.user.is_superuser
            ):
                return Response({"error": "Section not available."}, status=403)
            progress.completed_sections.add(section)
            progress.save()
            return Response({"message": "Section completed!"})
        except LessonSection.DoesNotExist:
            return Response({"error": "Section not found"}, status=400)

    @action(detail=False, methods=["get"], permission_classes=[IsAuthenticated])
    def with_progress(self, request):
        """Retrieve lessons with progress information for a specific course."""
        course_id = request.query_params.get("course", None)
        if not course_id:
            return Response({"error": "Course ID is required."}, status=400)

        include_unpublished = (
            request.query_params.get("include_unpublished") == "true"
            and (request.user.is_staff or request.user.is_superuser)
        )

        try:
            user_progress = UserProgress.objects.get(
                user=request.user,
                course_id=course_id
            )
            completed_lesson_ids = list(user_progress.completed_lessons.values_list('id', flat=True))
            completed_sections = list(user_progress.completed_sections.values_list('id', flat=True))
        except UserProgress.DoesNotExist:
            completed_lesson_ids = []
            completed_sections = []

        section_queryset = LessonSection.objects.all()
        if not include_unpublished:
            section_queryset = section_queryset.filter(is_published=True)

        lessons = (
            self.get_queryset()
            .filter(course_id=course_id)
            .prefetch_related(
                Prefetch("sections", queryset=section_queryset.order_by("order"))
            )
        )
        serializer = self.get_serializer(
            lessons,
            many=True,
            context={'completed_lesson_ids': completed_lesson_ids, 'request': request}
        )
        lesson_data = serializer.data

        for lesson in lesson_data:
            total = len(lesson['sections'])
            completed = sum(1 for s in lesson['sections'] if s['id'] in completed_sections)
            lesson['total_sections'] = total
            lesson['completed_sections'] = completed
            lesson['progress'] = f"{(completed / total * 100) if total > 0 else 0}%"

        return Response(lesson_data)

    @action(detail=True, methods=["post"], url_path="sections/reorder")
    def reorder_sections(self, request, pk=None):
        lesson = self.get_object()
        new_order = request.data.get("order", [])

        if not isinstance(new_order, list):
            return Response({"error": "Order must be a list"}, status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            for index, section_id in enumerate(new_order, start=1):
                LessonSection.objects.filter(id=section_id, lesson=lesson).update(
                    order=index, updated_by=request.user
                )

        ordered_sections = lesson.sections.order_by("order")

        log_admin_action(
            user=request.user,
            action="reordered_sections",
            target_type="Lesson",
            target_id=lesson.id,
            metadata={"order": new_order},
        )

        return Response(
            {
                "sections": LessonSectionSerializer(
                    ordered_sections, many=True, context={"request": request}
                ).data
            }
        )

    @action(detail=True, methods=["post"], url_path="sections")
    def add_section(self, request, pk=None):
        lesson = self.get_object()
        data = request.data.copy()
        order = data.get("order")

        if order is None:
            order = lesson.sections.count() + 1

        data["order"] = order
        serializer = LessonSectionWriteSerializer(data=data)
        serializer.is_valid(raise_exception=True)

        with transaction.atomic():
            LessonSection.objects.filter(lesson=lesson, order__gte=order).update(
                order=F("order") + 1
            )
            section = serializer.save(lesson=lesson, updated_by=request.user)

        log_admin_action(
            user=request.user,
            action="created_section",
            target_type="LessonSection",
            target_id=section.id,
            metadata={"lesson_id": lesson.id},
        )

        return Response(
            LessonSectionSerializer(section, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )

    @action(
        detail=True,
        methods=["patch"],
        url_path="sections/(?P<section_id>\\d+)",
    )
    def update_section(self, request, pk=None, section_id=None):
        lesson = self.get_object()

        try:
            section = lesson.sections.get(id=section_id)
        except LessonSection.DoesNotExist:
            return Response({"error": "Section not found"}, status=status.HTTP_404_NOT_FOUND)

        serializer = LessonSectionWriteSerializer(
            section, data=request.data, partial=True
        )
        serializer.is_valid(raise_exception=True)

        desired_order = serializer.validated_data.get("order")

        with transaction.atomic():
            if desired_order is not None and desired_order != section.order:
                LessonSection.objects.filter(
                    lesson=lesson, order__gte=desired_order
                ).exclude(id=section.id).update(order=F("order") + 1)

            section = serializer.save(updated_by=request.user)

        log_admin_action(
            user=request.user,
            action="updated_section",
            target_type="LessonSection",
            target_id=section.id,
            metadata={"lesson_id": lesson.id},
        )

        return Response(
            LessonSectionSerializer(section, context={"request": request}).data
        )

    @action(
        detail=True,
        methods=["delete"],
        url_path="sections/(?P<section_id>\\d+)",
    )
    def delete_section(self, request, pk=None, section_id=None):
        lesson = self.get_object()

        try:
            section = lesson.sections.get(id=section_id)
        except LessonSection.DoesNotExist:
            return Response({"error": "Section not found"}, status=status.HTTP_404_NOT_FOUND)

        section_order = section.order
        section_id = section.id
        section.delete()

        LessonSection.objects.filter(lesson=lesson, order__gt=section_order).update(
            order=F("order") - 1
        )

        log_admin_action(
            user=request.user,
            action="deleted_section",
            target_type="LessonSection",
            target_id=section_id,
            metadata={"lesson_id": lesson.id},
        )

        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=False, methods=['post'], permission_classes=[IsAuthenticated])
    def complete(self, request):
        """Mark a lesson as completed and update the user's progress and streak."""
        lesson_id = request.data.get('lesson_id')
        user = request.user

        try:
            lesson = Lesson.objects.get(id=lesson_id)
            user_progress, created = UserProgress.objects.get_or_create(
                user=user, course=lesson.course
            )

            # Mark lesson complete
            LessonCompletion.objects.get_or_create(
                user_progress=user_progress,
                lesson=lesson
            )

            # Update global streak inside UserProfile
            user_profile = user.profile
            user_profile.update_streak()

            user_profile.add_money(Decimal('5.00'))
            user_profile.add_points(10)

            total_lessons = lesson.course.lessons.count()
            completed_lessons = user_progress.completed_lessons.count()
            if completed_lessons == total_lessons:
                user_progress.mark_course_complete()

            return Response({"message": "Lesson completed!"}, status=status.HTTP_200_OK)
        except Lesson.DoesNotExist:
            return Response({"error": "Lesson not found."}, status=status.HTTP_404_NOT_FOUND)


class QuizViewSet(viewsets.ModelViewSet):
    """ViewSet to manage quizzes, including retrieving and completing quizzes."""

    queryset = Quiz.objects.all()
    serializer_class = QuizSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        """Retrieve quizzes for a specific course."""
        course_id = self.request.query_params.get("course")
        if not course_id:
            return Quiz.objects.none()

        quizzes = Quiz.objects.filter(course_id=course_id)
        return quizzes

    @action(detail=False, methods=["post"], permission_classes=[IsAuthenticated])
    def complete(self, request):
        """Mark a quiz as completed and reward the user if the answer is correct."""
        quiz_id = request.data.get("quiz_id")
        selected_answer = request.data.get("selected_answer")

        try:
            quiz = Quiz.objects.get(id=quiz_id)
            if quiz.correct_answer == selected_answer:
                QuizCompletion.objects.get_or_create(user=request.user, quiz=quiz)

                user_profile = request.user.profile
                user_profile.add_money(Decimal('10.00'))
                user_profile.add_points(20)
                user_profile.save()

                return Response({
                    "message": "Quiz completed!",
                    "correct": True,
                    "earned_money": 10.00
                }, status=status.HTTP_200_OK)
            else:
                return Response({
                    "message": "Incorrect answer. Please try again.",
                    "correct": False
                }, status=status.HTTP_200_OK)
        except Quiz.DoesNotExist:
            return Response({"error": "Quiz not found."}, status=status.HTTP_404_NOT_FOUND)


class UserProgressViewSet(viewsets.ModelViewSet):
    """ViewSet to manage user progress, including tracking lessons, courses, and paths."""

    queryset = UserProgress.objects.all()
    serializer_class = UserProgressSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        """Filter progress by the authenticated user."""
        return UserProgress.objects.filter(user=self.request.user)

    @action(detail=False, methods=['post'], url_path='complete')
    def complete(self, request):
        """Mark a lesson as completed and update the user's progress and streak."""
        lesson_id = request.data.get('lesson_id')
        if not lesson_id:
            return Response({"error": "lesson_id is required"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            lesson = Lesson.objects.get(id=lesson_id)
            course = lesson.course
            user_profile = request.user.profile
            user_progress, created = UserProgress.objects.get_or_create(user=request.user, course=course)

            user_progress.completed_lessons.add(lesson)
            user_profile.add_money(Decimal('5.00'))
            user_profile.save()

            total_lessons = course.lessons.count()
            completed_lessons = user_progress.completed_lessons.count()
            if completed_lessons == total_lessons:
                user_profile.add_money(Decimal('50.00'))
                user_profile.add_points(50)
                user_profile.save()

                user_progress.is_course_complete = True
                user_progress.course_completed_at = timezone.now()
                user_progress.save()

                # Check for complete_path mission updates
                path_missions = MissionCompletion.objects.filter(
                    user=request.user,
                    mission__goal_type="complete_path",
                    status__in=["not_started", "in_progress"]
                )
                for mission_completion in path_missions:
                    mission_completion.update_progress()

                # Also reward full path if completed
                path = course.path
                if path:
                    courses_in_path = Course.objects.filter(path=path)
                    completed_courses = UserProgress.objects.filter(
                        user=request.user,
                        course__in=courses_in_path,
                        is_course_complete=True
                    ).count()

                    if completed_courses == courses_in_path.count():
                        user_profile.add_money(Decimal('100.00'))
                        user_profile.add_points(100)
                        user_profile.save()

            user_progress.update_streak()

            # Update lesson-related missions
            lesson_missions = MissionCompletion.objects.filter(
                user=request.user,
                mission__goal_type="complete_lesson",
                status__in=["not_started", "in_progress"]
            )
            for mission_completion in lesson_missions:
                mission_completion.update_progress()

            return Response(
                {"status": "Lesson completed", "streak": user_progress.user.profile.streak},
                status=status.HTTP_200_OK
            )

        except Lesson.DoesNotExist:
            return Response({"error": "Lesson not found"}, status=status.HTTP_404_NOT_FOUND)

    @action(detail=False, methods=["get"])
    def progress_summary(self, request):
        """Retrieve a summary of the user's progress across all courses and paths."""
        user = request.user
        progress_data = []

        user_progress = UserProgress.objects.filter(user=user)
        for progress in user_progress:
            total_lessons = progress.course.lessons.count()
            completed_lessons = progress.completed_lessons.count()
            percent_complete = (completed_lessons / total_lessons) * 100 if total_lessons > 0 else 0

            progress_data.append({
                "path": progress.course.path.title if progress.course.path else None,
                "course": progress.course.title,
                "percent_complete": percent_complete,
            })

        return Response({
            "overall_progress": sum(d["percent_complete"] for d in progress_data) / len(progress_data) if progress_data else 0,
            "paths": progress_data
        })

    @action(detail=False, methods=['post'], url_path='complete_section')
    def complete_section(self, request):
        """Mark a specific section of a lesson as completed."""
        section_id = request.data.get('section_id')
        user = request.user
        try:
            section = LessonSection.objects.get(id=section_id)
            if not section.is_published and not (
                user.is_staff or user.is_superuser
            ):
                return Response({"error": "Section not available."}, status=403)
            progress, _ = UserProgress.objects.get_or_create(
                user=user,
                course=section.lesson.course
            )
            progress.completed_sections.add(section)
            progress.save()
            return Response({"status": "Section completed"})
        except LessonSection.DoesNotExist:
            return Response({"error": "Invalid section"}, status=400)


class ExerciseViewSet(viewsets.ModelViewSet):
    """Manage exercises, including filtering by type, category, and difficulty."""

    queryset = Exercise.objects.all()
    serializer_class = ExerciseSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        queryset = Exercise.objects.all()
        exercise_type = self.request.query_params.get('type', None)
        category = self.request.query_params.get('category', None)
        difficulty = self.request.query_params.get('difficulty', None)

        if exercise_type:
            queryset = queryset.filter(type=exercise_type)
        if category:
            queryset = queryset.filter(category=category)
        if difficulty:
            queryset = queryset.filter(difficulty=difficulty)

        return queryset

    @action(detail=False, methods=['get'])
    def categories(self, request):
        """Get all unique exercise categories."""
        categories = Exercise.objects.values_list('category', flat=True).distinct()
        return Response(list(categories))

    @action(detail=True, methods=['post'])
    def submit(self, request, pk=None):
        """Submit an answer for an exercise."""
        exercise = self.get_object()
        user_answer = request.data.get('user_answer')

        if user_answer is None:
            return Response(
                {'error': 'User answer is required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Get or create user progress
        progress, created = UserExerciseProgress.objects.get_or_create(
            user=request.user,
            exercise=exercise
        )

        # Update progress
        progress.attempts += 1
        progress.user_answer = user_answer
        progress.last_attempt = timezone.now()

        # Check if answer is correct - normalize JSON for comparison
        correct_answer = exercise.correct_answer
        # Normalize both answers to JSON strings for comparison
        try:
            correct_json = json.dumps(correct_answer, sort_keys=True) if correct_answer is not None else None
            user_json = json.dumps(user_answer, sort_keys=True) if user_answer is not None else None
            is_correct = correct_json == user_json
        except (TypeError, ValueError):
            # Fallback to direct comparison if JSON serialization fails
            is_correct = correct_answer == user_answer

        if is_correct:
            progress.completed = True

        progress.save()

        return Response({
            'correct': is_correct,
            'attempts': progress.attempts,
            'explanation': getattr(exercise, 'explanation', None)
        })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_exercise_progress(request, exercise_id):
    """Retrieve the progress of a specific exercise for the authenticated user."""
    try:
        exercise = Exercise.objects.get(id=exercise_id)
        progress = UserExerciseProgress.objects.filter(
            user=request.user,
            exercise=exercise
        ).first()

        if progress:
            return Response({
                "completed": progress.completed,
                "attempts": progress.attempts,
                "user_answer": progress.user_answer
            })
        else:
            return Response({"completed": False, "attempts": 0, "user_answer": None})
    except Exercise.DoesNotExist:
        return Response({"error": "Exercise not found."}, status=404)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def reset_exercise(request):
    """Reset exercise progress for a user."""
    exercise_id = request.data.get("exercise_id")
    section_id = request.data.get("section_id")
    
    if not exercise_id and not section_id:
        return Response({"error": "Either exercise_id or section_id is required"}, status=400)

    try:
        if section_id:
            # If section_id is provided, find the exercise through the section
            section = LessonSection.objects.get(id=section_id)
            exercise = Exercise.objects.filter(section=section).first()
            if not exercise:
                return Response({"error": "No exercise found for this section"}, status=404)
            exercise_id = exercise.id

        progress = UserExerciseProgress.objects.get(
            user=request.user, exercise_id=exercise_id
        )
        progress.attempts = 0
        progress.completed = False
        progress.user_answer = None
        progress.save()
        return Response({"message": "Progress reset successfully."}, status=200)
    except (UserExerciseProgress.DoesNotExist, LessonSection.DoesNotExist, Exercise.DoesNotExist):
        return Response({"error": "No progress found to reset."}, status=404)


class EnhancedQuestionnaireView(APIView):
    """API view to handle the enhanced questionnaire functionality, including fetching questions, submitting answers, and generating personalized paths."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        """Handle GET requests to fetch questionnaire questions."""
        questions = Question.objects.filter(is_active=True).order_by('order')
        serializer = QuestionSerializer(questions, many=True)
        return Response(serializer.data)

    def post(self, request):
        """Handle POST requests to submit questionnaire answers and initiate payment for personalized paths."""
        try:
            user = request.user
            user_profile = user.profile
            answers = request.data.get('answers', {})

            if not answers:
                return Response({"error": "No answers provided"}, status=400)

            with transaction.atomic():
                for qid, answer in answers.items():
                    try:
                        question = Question.objects.get(id=qid)
                        # Validate budget allocation sum
                        if question.type == 'budget_allocation':
                            total = sum(int(v) for v in answer.values())
                            if total != 100:
                                return Response(
                                    {"error": "Budget allocation must total 100%"},
                                    status=400
                                )

                        UserResponse.objects.update_or_create(
                            user=user,
                            question=question,
                            defaults={'answer': answer}
                        )
                    except Question.DoesNotExist:
                        logger.error(f"Question {qid} not found")
                        continue

                user_profile.recommended_courses = []
                user_profile.is_questionnaire_completed = True
                user_profile.save()

            # If user has already paid, allow them to update questionnaire and redirect to personalized path
            if user_profile.has_paid:
                return Response({
                    "success": True,
                    "redirect": "/personalized-path",
                    "message": "Questionnaire updated successfully"
                }, status=200)

            # Configure Stripe with your API key
            stripe.api_key = settings.STRIPE_SECRET_KEY

            # Create Stripe Checkout Session
            checkout_session = stripe.checkout.Session.create(
                payment_method_types=['card'],
                line_items=[{
                    'price': 'price_1R9sQlBi8QnQXyou7cLlu0wF',
                    'quantity': 1,
                }],
                mode='payment',
                success_url=f'{settings.FRONTEND_URL}/#/personalized-path?session_id={{CHECKOUT_SESSION_ID}}',
                cancel_url=f'{settings.FRONTEND_URL}/#/questionnaire',
                metadata={'user_id': str(request.user.id)},
                client_reference_id=str(request.user.id)
            )

            return Response({
                "success": True,
                "redirect_url": checkout_session.url
            }, status=200)

        except Exception as e:
            logger.error(f"Stripe error: {str(e)}")
            return Response({"error": "Payment processing failed"}, status=500)


class PersonalizedPathView(APIView):
    """API view to provide personalized learning paths for users based on their responses and preferences."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        """Retrieve personalized course recommendations for the user."""
        try:
            user_profile = UserProfile.objects.get(user=request.user)

            if not user_profile.has_paid:
                return Response({
                    "error": "Payment required for personalized path",
                    "redirect": "/payment-required"
                }, status=403)

            # Generate recommendations if not already present
            if not user_profile.recommended_courses:
                self.generate_recommendations(user_profile)

            recommended_courses = Course.objects.filter(
                id__in=user_profile.recommended_courses
            ).order_by('order')

            serializer = CourseSerializer(
                recommended_courses,
                many=True,
                context={'request': request}
            )

            # Cache control headers
            response = Response({
                "courses": serializer.data,
                "message": "Recommended courses based on your financial goals:"
            })
            response['Cache-Control'] = 'no-store, max-age=0'
            return response

        except Exception as e:
            logger.critical(f"Critical error in personalized path: {str(e)}", exc_info=True)
            return Response(
                {"error": "We're having trouble generating recommendations. Our team has been notified."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    def generate_recommendations(self, user_profile):
        """Generate personalized course recommendations based on user responses."""
        responses = UserResponse.objects.filter(user=user_profile.user)
        path_weights = self.calculate_path_weights(responses)
        sorted_paths = sorted(path_weights.items(), key=lambda x: x[1], reverse=True)[:3]

        recommended_courses = self.get_recommended_courses(sorted_paths)
        user_profile.recommended_courses = [c.id for c in recommended_courses]
        user_profile.save()

    def calculate_path_weights(self, responses):
        """Calculate weights for different learning paths based on user responses."""
        path_weights = defaultdict(int)
        try:
            for response in responses:
                answer = response.answer
                try:
                    if response.question.type == 'budget_allocation' and isinstance(answer, str):
                        answer = json.loads(answer)
                except json.JSONDecodeError:
                    logger.error(f"Invalid JSON answer for question {response.question.id}")
                    continue

                if response.question.id == 1:
                    if isinstance(answer, str):
                        self.handle_risk_question(answer.lower().strip(), path_weights)

                elif response.question.id == 3:
                    if isinstance(answer, str):
                        answer = [a.strip().lower() for a in answer.split(',')]
                    self.handle_investment_question(answer, path_weights)

                elif response.question.id == 4:
                    self.handle_budget_question(answer, path_weights)

        except Exception as e:
            logger.error(f"Error calculating path weights: {str(e)}", exc_info=True)

        return path_weights

    def handle_risk_question(self, answer, weights):
        """Adjust path weights based on the user's risk tolerance."""
        risk_map = {
            'very uncomfortable': 0,
            'uncomfortable': 1,
            'neutral': 2,
            'comfortable': 3,
            'very comfortable': 4
        }
        normalized_answer = answer.lower().strip()
        score = risk_map.get(normalized_answer, 0)
        weights['Investing'] += score * 2
        weights['Cryptocurrency'] += score * 1.5

    def handle_investment_question(self, answer, weights):
        """Adjust path weights based on the user's investment preferences."""
        investment_map = {
            'real estate': 'Real Estate',
            'crypto': 'Cryptocurrency',
            'cryptocurrency': 'Cryptocurrency',
            'stocks': 'Investing',
            'stock market': 'Investing'
        }

        if isinstance(answer, str):
            answer = [a.strip().lower() for a in answer.split(',')]

        for selection in answer:
            normalized = selection.strip().lower()
            path = investment_map.get(normalized)
            if path:
                weights[path] += 3 if path == 'Real Estate' else 2

    def handle_budget_question(self, answer, weights):
        """Adjust path weights based on the user's budget allocation."""
        try:
            if isinstance(answer, str):
                allocation = json.loads(answer)
            else:
                allocation = answer

            allocation = {k.lower().strip(): v for k, v in allocation.items()}

            stock_weight = float(allocation.get('stocks', 0)) * 0.8
            real_estate_weight = float(allocation.get('real estate', 0)) * 0.8
            crypto_weight = float(allocation.get('crypto', 0)) * 1.2

            if stock_weight > 0:
                weights['Investing'] += stock_weight
            if real_estate_weight > 0:
                weights['Real Estate'] += real_estate_weight
            if crypto_weight > 0:
                weights['Cryptocurrency'] += crypto_weight

        except Exception as e:
            logger.error(f"Budget handling error: {str(e)}")

    def get_recommended_courses(self, sorted_paths):
        """Retrieve recommended courses based on the top weighted paths."""
        recommended_courses = []
        try:
            for path_name, _ in sorted_paths[:3]:
                courses = Course.objects.filter(
                    path__title__iexact=path_name,
                    is_active=True
                ).order_by('order')[:2]
                recommended_courses.extend(courses)

            if len(recommended_courses) < 10:
                additional = Course.objects.filter(
                    is_active=True
                ).exclude(id__in=[c.id for c in recommended_courses]
                ).order_by('-popularity')[:10-len(recommended_courses)]
                recommended_courses.extend(additional)

            return recommended_courses[:10]

        except Exception as e:
            logger.error(f"Course fetch error: {str(e)}")
            return Course.objects.filter(is_active=True).order_by('?')[:10]

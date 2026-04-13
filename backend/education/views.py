# education/views.py
from rest_framework import viewsets, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.decorators import action, api_view, permission_classes
from django.utils import timezone
from django.db import transaction
from django.db.models import Count, F, Prefetch
from decimal import Decimal, InvalidOperation
from collections import defaultdict
import json
import logging
import stripe
from django.conf import settings
from finance.utils import record_funnel_event
from authentication.services.profile import invalidate_profile_cache

from education.services.checkpoint_quizzes import ensure_checkpoint_quizzes_for_lesson

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
    Question,
    Mastery,
)
from education.serializers import (
    PathSerializer,
    PathListSerializer,
    CourseSerializer,
    LessonSerializer,
    LessonSectionSerializer,
    LessonSectionWriteSerializer,
    QuizSerializer,
    UserProgressSerializer,
    ExerciseSerializer,
)
from education.permissions import IsStaffOrSuperuser
from education.utils import log_admin_action, resolve_path_access_tier
from education.exercise_visibility import (
    apply_learner_exercise_filters,
    learner_can_access_exercise,
)
from authentication.models import UserProfile
from authentication.entitlements import allowed_plan_tiers, get_user_plan, plan_allows
from onboarding.models import QuestionnaireProgress
from gamification.models import MissionCompletion
from gamification.services.rewards import (
    COINS_COURSE_COMPLETE,
    COINS_LESSON_FIRST_COMPLETION,
    COINS_PATH_COMPLETE,
    COINS_QUIZ_PASS,
    COINS_SECTION_FIRST_COMPLETION,
    XP_COURSE_COMPLETE,
    XP_EXERCISE_ATTEMPT_CAP,
    XP_LESSON_FIRST_COMPLETION,
    XP_PATH_COMPLETE,
    XP_QUIZ_FIRST_COMPLETION_BONUS,
    XP_QUIZ_PASS,
    XP_SECTION_FIRST_COMPLETION,
    grant_reward,
)

logger = logging.getLogger(__name__)


def _catalog_request_force_learner(request) -> bool:
    """True when client asks for the same exercise catalog rules as learners (e.g. mobile/web practice)."""
    v = request.query_params.get("as_learner")
    if v is None:
        return False
    return str(v).strip().lower() in ("1", "true", "yes", "on")


def _user_is_staff(user) -> bool:
    return bool(getattr(user, "is_staff", False) or getattr(user, "is_superuser", False))


def _allowed_path_ids(user):
    if _user_is_staff(user):
        return Path.objects.values_list("id", flat=True)
    plan = get_user_plan(user)
    allowed_tiers = allowed_plan_tiers(plan)
    return [
        path.id
        for path in Path.objects.all().only("id", "title", "access_tier")
        if resolve_path_access_tier(path) in allowed_tiers
    ]


def _user_can_access_path(user, path: Path) -> bool:
    if _user_is_staff(user):
        return True
    plan = get_user_plan(user)
    return plan_allows(plan, resolve_path_access_tier(path))


def _path_access_denied_response(path: Path):
    return Response(
        {
            "error": "Upgrade required to access this learning path.",
            "required_plan": path.access_tier,
        },
        status=403,
    )


# Fields to load for Exercise when DB may lack version/is_published (use .only() to avoid selecting them)
EXERCISE_SAFE_FIELDS = [
    "id",
    "type",
    "question",
    "exercise_data",
    "correct_answer",
    "category",
    "difficulty",
    "misconception_tags",
    "error_patterns",
    "created_at",
    "is_published",
]


class PathViewSet(viewsets.ModelViewSet):
    """ViewSet to manage paths, including listing and retrieving paths."""

    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        if self.action == "list":
            return Path.objects.prefetch_related(
                "translations",
                Prefetch(
                    "courses",
                    queryset=Course.objects.annotate(
                        lesson_count=Count("lessons")
                    ).prefetch_related("translations"),
                ),
            ).order_by("sort_order", "id")
        return Path.objects.prefetch_related("translations").order_by("sort_order", "id")

    def get_serializer_class(self):
        if self.action == "list":
            return PathListSerializer
        return PathSerializer

    def list(self, request, *args, **kwargs):
        """Handle GET requests to list all paths (lightweight list)."""
        return super().list(request, *args, **kwargs)


class CourseViewSet(viewsets.ModelViewSet):
    """ViewSet to manage courses, including listing, retrieving, and updating course data."""

    queryset = Course.objects.select_related("path").prefetch_related(
        "translations",
        "path__translations",
        "lessons__translations",
        "lessons__sections__translations",
    )
    serializer_class = CourseSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        """Filter courses by path if path_id is provided."""
        queryset = Course.objects.select_related("path").prefetch_related(
            "translations",
            "path__translations",
            "lessons__translations",
            "lessons__sections__translations",
        )
        if not _user_is_staff(self.request.user):
            queryset = queryset.filter(path_id__in=_allowed_path_ids(self.request.user))
        path_id = self.request.query_params.get("path", None)
        if path_id:
            queryset = queryset.filter(path_id=path_id)
        return queryset

    def list(self, request, *args, **kwargs):
        path_id = request.query_params.get("path")
        if path_id:
            path = Path.objects.filter(id=path_id).first()
            if path and not _user_can_access_path(request.user, path):
                return _path_access_denied_response(path)
        return super().list(request, *args, **kwargs)

    def retrieve(self, request, *args, **kwargs):
        instance = (
            Course.objects.select_related("path")
            .prefetch_related(
                "translations",
                "path__translations",
                "lessons__translations",
                "lessons__sections__translations",
            )
            .filter(pk=kwargs.get("pk"))
            .first()
        )
        if not instance:
            return Response({"error": "Course not found."}, status=404)
        if instance.path and not _user_can_access_path(request.user, instance.path):
            return _path_access_denied_response(instance.path)
        serializer = self.get_serializer(instance)
        return Response(serializer.data)


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
            "reorder_sections",
        }

        if getattr(self, "action", None) in admin_actions:
            permissions = [IsAuthenticated, IsStaffOrSuperuser]
        else:
            permissions = [IsAuthenticated]

        return [permission() for permission in permissions]

    def get_queryset(self):
        queryset = super().get_queryset()
        if _user_is_staff(self.request.user):
            return queryset
        return queryset.filter(course__path_id__in=_allowed_path_ids(self.request.user))

    @action(detail=True, methods=["post"])
    def complete_section(self, request, pk=None):
        """Mark a specific section of a lesson as completed."""
        lesson = self.get_object()
        section_id = request.data.get("section_id")

        # Track progress
        progress, _ = UserProgress.objects.get_or_create(user=request.user, course=lesson.course)
        try:
            section = LessonSection.objects.get(id=section_id)
            if not section.is_published and not (
                request.user.is_staff or request.user.is_superuser
            ):
                return Response({"error": "Section not available."}, status=403)
            progress.completed_sections.add(section)
            progress.save()
            invalidate_profile_cache(request.user)
            return Response({"message": "Section completed!"})
        except LessonSection.DoesNotExist:
            return Response({"error": "Section not found"}, status=400)

    @action(detail=False, methods=["get"], permission_classes=[IsAuthenticated])
    def with_progress(self, request):
        """Retrieve lessons with progress information for a specific course."""
        course_id = request.query_params.get("course", None)
        if not course_id:
            return Response({"error": "Course ID is required."}, status=400)
        try:
            course = Course.objects.select_related("path").get(id=course_id)
        except Course.DoesNotExist:
            return Response({"error": "Course not found."}, status=404)
        if course.path and not _user_can_access_path(request.user, course.path):
            return _path_access_denied_response(course.path)

        include_unpublished = request.query_params.get("include_unpublished") == "true" and (
            request.user.is_staff or request.user.is_superuser
        )

        try:
            user_progress = UserProgress.objects.get(user=request.user, course_id=course_id)
            completed_lesson_ids = list(
                user_progress.completed_lessons.values_list("id", flat=True)
            )
            completed_sections = list(user_progress.completed_sections.values_list("id", flat=True))
        except UserProgress.DoesNotExist:
            completed_lesson_ids = []
            completed_sections = []

        section_queryset = LessonSection.objects.prefetch_related("translations")
        if not include_unpublished:
            section_queryset = section_queryset.filter(is_published=True)

        lessons = (
            self.get_queryset()
            .filter(course_id=course_id)
            .prefetch_related(
                Prefetch("sections", queryset=section_queryset.order_by("order")),
                "translations",
            )
        )
        serializer = self.get_serializer(
            lessons,
            many=True,
            context={"completed_lesson_ids": completed_lesson_ids, "request": request},
        )
        lesson_data = serializer.data

        for lesson in lesson_data:
            total = len(lesson["sections"])
            completed = sum(1 for s in lesson["sections"] if s["id"] in completed_sections)
            lesson["total_sections"] = total
            lesson["completed_sections"] = completed
            lesson["progress"] = f"{(completed / total * 100) if total > 0 else 0}%"

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
        methods=["patch", "delete"],
        url_path="sections/(?P<section_id>\\d+)",
    )
    def update_section(self, request, pk=None, section_id=None):
        lesson = self.get_object()

        try:
            section = lesson.sections.get(id=section_id)
        except LessonSection.DoesNotExist:
            return Response({"error": "Section not found"}, status=status.HTTP_404_NOT_FOUND)

        # Handle section deletion on the same endpoint to avoid router collisions
        if request.method == "DELETE":
            section_order = section.order
            section_id_value = section.id
            section.delete()

            LessonSection.objects.filter(lesson=lesson, order__gt=section_order).update(
                order=F("order") - 1
            )

            log_admin_action(
                user=request.user,
                action="deleted_section",
                target_type="LessonSection",
                target_id=section_id_value,
                metadata={"lesson_id": lesson.id},
            )

            return Response(status=status.HTTP_204_NO_CONTENT)

        serializer = LessonSectionWriteSerializer(section, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)

        desired_order = serializer.validated_data.get("order")

        with transaction.atomic():
            if desired_order is not None and desired_order != section.order:
                LessonSection.objects.filter(lesson=lesson, order__gte=desired_order).exclude(
                    id=section.id
                ).update(order=F("order") + 1)

            section = serializer.save(updated_by=request.user)

        log_admin_action(
            user=request.user,
            action="updated_section",
            target_type="LessonSection",
            target_id=section.id,
            metadata={"lesson_id": lesson.id},
        )

        return Response(LessonSectionSerializer(section, context={"request": request}).data)

    @action(detail=False, methods=["post"], permission_classes=[IsAuthenticated])
    def complete(self, request):
        """Mark a lesson as completed and update the user's progress and streak."""
        lesson_id = request.data.get("lesson_id")
        user = request.user

        try:
            lesson = Lesson.objects.get(id=lesson_id)
            if lesson.course and lesson.course.path:
                if not _user_can_access_path(user, lesson.course.path):
                    return _path_access_denied_response(lesson.course.path)
            user_progress, created = UserProgress.objects.get_or_create(
                user=user, course=lesson.course
            )

            lc, created_lesson = LessonCompletion.objects.get_or_create(
                user_progress=user_progress, lesson=lesson
            )
            if created_lesson:
                grant_reward(
                    user,
                    f"lesson_first_completion:{user.id}:{lesson.id}",
                    points=XP_LESSON_FIRST_COMPLETION,
                    coins=COINS_LESSON_FIRST_COMPLETION,
                    bump_streak="user_progress",
                    user_progress=user_progress,
                )
                lesson_sections = list(lesson.sections.all())
                if lesson_sections:
                    user_progress.completed_sections.add(*lesson_sections)
                    for section in lesson_sections[:3]:
                        _grant_initial_mastery(user, _extract_section_skill(section))
                lesson_missions = MissionCompletion.objects.filter(
                    user=user,
                    mission__goal_type="complete_lesson",
                    status__in=["not_started", "in_progress"],
                )
                for mission_completion in lesson_missions:
                    mission_completion.update_progress()

            total_lessons = lesson.course.lessons.count()
            completed_lessons = user_progress.completed_lessons.count()
            if completed_lessons == total_lessons and not user_progress.is_course_complete:
                grant_reward(
                    user,
                    f"course_first_complete:{user.id}:{lesson.course_id}",
                    points=XP_COURSE_COMPLETE,
                    coins=COINS_COURSE_COMPLETE,
                    bump_streak="none",
                )
                user_progress.is_course_complete = True
                user_progress.course_completed_at = timezone.now()
                user_progress.save(update_fields=["is_course_complete", "course_completed_at"])
                path_missions = MissionCompletion.objects.filter(
                    user=user,
                    mission__goal_type="complete_path",
                    status__in=["not_started", "in_progress"],
                )
                for mission_completion in path_missions:
                    mission_completion.update_progress()
                path = lesson.course.path
                if path:
                    courses_in_path = Course.objects.filter(path=path)
                    n_courses = courses_in_path.count()
                    if n_courses > 0:
                        completed_path_courses = UserProgress.objects.filter(
                            user=user,
                            course__in=courses_in_path,
                            is_course_complete=True,
                        ).count()
                        if completed_path_courses == n_courses:
                            grant_reward(
                                user,
                                f"path_first_complete:{user.id}:{path.id}",
                                points=XP_PATH_COMPLETE,
                                coins=COINS_PATH_COMPLETE,
                                bump_streak="none",
                            )

            invalidate_profile_cache(user)
            return Response({"message": "Lesson completed!"}, status=status.HTTP_200_OK)
        except Lesson.DoesNotExist:
            return Response({"error": "Lesson not found."}, status=status.HTTP_404_NOT_FOUND)


class QuizViewSet(viewsets.ModelViewSet):
    """ViewSet to manage quizzes, including retrieving and completing quizzes."""

    queryset = Quiz.objects.prefetch_related("translations")
    serializer_class = QuizSerializer
    permission_classes = [IsAuthenticated]

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        course_id = self.request.query_params.get("course")
        user = getattr(self.request, "user", None)
        if course_id and user and user.is_authenticated:
            ctx["quiz_completed_ids"] = frozenset(
                QuizCompletion.objects.filter(
                    user=user, quiz__course_id=course_id
                ).values_list("quiz_id", flat=True)
            )
        else:
            ctx["quiz_completed_ids"] = frozenset()
        return ctx

    def get_queryset(self):
        """Retrieve quizzes for a specific course."""
        course_id = self.request.query_params.get("course")
        if not course_id:
            return Quiz.objects.none()

        quizzes = Quiz.objects.filter(
            course_id=course_id,
            source_lesson_section__isnull=True,
        ).prefetch_related("translations")
        return quizzes

    def list(self, request, *args, **kwargs):
        course_id = request.query_params.get("course")
        if not course_id:
            return Response([], status=status.HTTP_200_OK)
        course = Course.objects.select_related("path").filter(id=course_id).first()
        if not course:
            return Response({"error": "Course not found."}, status=404)
        if course.path and not _user_can_access_path(request.user, course.path):
            return _path_access_denied_response(course.path)
        return super().list(request, *args, **kwargs)

    @action(detail=False, methods=["get"], permission_classes=[IsAuthenticated], url_path="checkpoint")
    def checkpoint(self, request):
        """
        Lesson checkpoint: up to 3 multiple-choice questions materialized from the lesson's
        own exercise sections (Duolingo-style). Empty when the lesson has no suitable MC sections.
        """
        lesson_id = request.query_params.get("lesson")
        if not lesson_id:
            return Response({"error": "lesson is required"}, status=status.HTTP_400_BAD_REQUEST)
        try:
            lesson_id_int = int(lesson_id)
        except (TypeError, ValueError):
            return Response({"error": "lesson must be an integer"}, status=status.HTTP_400_BAD_REQUEST)

        lesson = (
            Lesson.objects.select_related("course", "course__path").filter(pk=lesson_id_int).first()
        )
        if not lesson:
            return Response({"error": "Lesson not found."}, status=status.HTTP_404_NOT_FOUND)
        course = lesson.course
        if course and course.path and not _user_can_access_path(request.user, course.path):
            return _path_access_denied_response(course.path)

        ensure_checkpoint_quizzes_for_lesson(lesson)
        qs = (
            Quiz.objects.filter(lesson=lesson, source_lesson_section__isnull=False)
            .select_related("course", "source_lesson_section")
            .prefetch_related("translations")
            .order_by("source_lesson_section__order")
        )
        completed_ids = frozenset(
            QuizCompletion.objects.filter(user=request.user, quiz__in=qs).values_list(
                "quiz_id", flat=True
            )
        )
        ctx = {**self.get_serializer_context(), "quiz_completed_ids": completed_ids}
        return Response(QuizSerializer(qs, many=True, context=ctx).data)

    @action(detail=False, methods=["post"], permission_classes=[IsAuthenticated])
    def complete(self, request):
        """Mark a quiz as completed and reward the user if the answer is correct."""
        quiz_id = request.data.get("quiz_id")
        selected_answer = request.data.get("selected_answer")

        try:
            quiz = Quiz.objects.get(id=quiz_id)
            if quiz.course and quiz.course.path:
                if not _user_can_access_path(request.user, quiz.course.path):
                    return _path_access_denied_response(quiz.course.path)
            if quiz.correct_answer == selected_answer:
                _qc, created_quiz = QuizCompletion.objects.get_or_create(
                    user=request.user, quiz=quiz
                )
                if not created_quiz:
                    return Response(
                        {
                            "message": "Quiz already completed.",
                            "correct": True,
                            "already_completed": True,
                            "earned_money": 0,
                            "earned_points": 0,
                        },
                        status=status.HTTP_200_OK,
                    )
                total_xp = XP_QUIZ_PASS + XP_QUIZ_FIRST_COMPLETION_BONUS
                grant_reward(
                    request.user,
                    f"quiz_first_pass:{request.user.id}:{quiz.id}",
                    points=total_xp,
                    coins=COINS_QUIZ_PASS,
                    bump_streak="profile",
                )

                logger.info(
                    "quiz_completed",
                    extra={
                        "user_id": request.user.id,
                        "quiz_id": quiz.id,
                        "course_id": quiz.course_id,
                        "xp": total_xp,
                    },
                )

                return Response(
                    {
                        "message": "Quiz completed!",
                        "correct": True,
                        "already_completed": False,
                        "earned_money": float(COINS_QUIZ_PASS),
                        "earned_points": total_xp,
                    },
                    status=status.HTTP_200_OK,
                )
            else:
                return Response(
                    {
                        "message": "Incorrect answer. Please try again.",
                        "correct": False,
                    },
                    status=status.HTTP_200_OK,
                )
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

    @action(detail=False, methods=["post"], url_path="complete")
    def complete(self, request):
        """Mark a lesson as completed and update the user's progress and streak."""
        lesson_id = request.data.get("lesson_id")
        if not lesson_id:
            return Response({"error": "lesson_id is required"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            lesson = Lesson.objects.get(id=lesson_id)
            course = lesson.course
            if course and course.path:
                if not _user_can_access_path(request.user, course.path):
                    return _path_access_denied_response(course.path)

            with transaction.atomic():
                user_progress, _ = UserProgress.objects.select_for_update().get_or_create(
                    user=request.user, course=course
                )
                was_already_course_complete = user_progress.is_course_complete
                was_lesson_new = not user_progress.completed_lessons.filter(pk=lesson.pk).exists()

                if was_lesson_new:
                    user_progress.completed_lessons.add(lesson)
                    lesson_sections = list(lesson.sections.all())
                    if lesson_sections:
                        user_progress.completed_sections.add(*lesson_sections)
                        for section in lesson_sections[:3]:
                            _grant_initial_mastery(
                                request.user, _extract_section_skill(section)
                            )

                    grant_reward(
                        request.user,
                        f"lesson_first_completion:{request.user.id}:{lesson.id}",
                        points=XP_LESSON_FIRST_COMPLETION,
                        coins=COINS_LESSON_FIRST_COMPLETION,
                        bump_streak="user_progress",
                        user_progress=user_progress,
                    )

                    # Per-section economy is normally granted from `complete_section`. When a lesson
                    # is completed first (bulk section M2M), those calls never happened — backfill
                    # section grants here. Idempotent: sections already rewarded individually skip.
                    for section in lesson_sections:
                        grant_reward(
                            request.user,
                            f"section_first_completion:{request.user.id}:{section.id}",
                            points=XP_SECTION_FIRST_COMPLETION,
                            coins=COINS_SECTION_FIRST_COMPLETION,
                            bump_streak="none",
                            user_progress=user_progress,
                            evaluate_badges=False,
                        )

                    lesson_missions = MissionCompletion.objects.filter(
                        user=request.user,
                        mission__goal_type="complete_lesson",
                        status__in=["not_started", "in_progress"],
                    )
                    for mission_completion in lesson_missions:
                        mission_completion.update_progress()

                total_lessons = course.lessons.count()
                completed_lessons = user_progress.completed_lessons.count()
                just_finished_course = (
                    was_lesson_new
                    and not was_already_course_complete
                    and total_lessons > 0
                    and completed_lessons == total_lessons
                )

                if just_finished_course:
                    grant_reward(
                        request.user,
                        f"course_first_complete:{request.user.id}:{course.id}",
                        points=XP_COURSE_COMPLETE,
                        coins=COINS_COURSE_COMPLETE,
                        bump_streak="none",
                    )
                    user_progress.is_course_complete = True
                    user_progress.course_completed_at = timezone.now()
                    user_progress.save(
                        update_fields=["is_course_complete", "course_completed_at"]
                    )

                    path_missions = MissionCompletion.objects.filter(
                        user=request.user,
                        mission__goal_type="complete_path",
                        status__in=["not_started", "in_progress"],
                    )
                    for mission_completion in path_missions:
                        mission_completion.update_progress()

                    path = course.path
                    if path:
                        courses_in_path = Course.objects.filter(path=path)
                        n_courses = courses_in_path.count()
                        if n_courses > 0:
                            completed_path_courses = UserProgress.objects.filter(
                                user=request.user,
                                course__in=courses_in_path,
                                is_course_complete=True,
                            ).count()
                            if completed_path_courses == n_courses:
                                grant_reward(
                                    request.user,
                                    f"path_first_complete:{request.user.id}:{path.id}",
                                    points=XP_PATH_COMPLETE,
                                    coins=COINS_PATH_COMPLETE,
                                    bump_streak="none",
                                )

            user_progress.refresh_from_db()
            invalidate_profile_cache(request.user)
            return Response(
                {
                    "status": "Lesson completed",
                    "streak": request.user.profile.streak,
                },
                status=status.HTTP_200_OK,
            )

        except Lesson.DoesNotExist:
            return Response({"error": "Lesson not found"}, status=status.HTTP_404_NOT_FOUND)

    @action(detail=False, methods=["get"])
    def progress_summary(self, request):
        """Retrieve a summary of the user's progress across all courses and paths.
        Progress is section-based: percent = (completed_sections / total_sections_in_course) * 100.
        Includes all courses in allowed paths (0%% for not started) so overall progress is meaningful.
        """
        user = request.user
        allowed_ids = list(_allowed_path_ids(user))
        if not allowed_ids:
            progress_data = []
        else:
            courses = (
                Course.objects.filter(path_id__in=allowed_ids)
                .select_related("path")
                .order_by("path__sort_order", "path_id", "order", "id")
            )
            course_ids = list(courses.values_list("id", flat=True))
            section_counts = dict(
                LessonSection.objects.filter(lesson__course_id__in=course_ids)
                .values("lesson__course_id")
                .annotate(c=Count("id"))
                .values_list("lesson__course_id", "c")
            )
            lesson_counts = dict(
                Lesson.objects.filter(course_id__in=course_ids)
                .values("course_id")
                .annotate(c=Count("id"))
                .values_list("course_id", "c")
            )
            progress_by_course = {
                p.course_id: p
                for p in UserProgress.objects.filter(
                    user=user, course_id__in=course_ids
                ).prefetch_related("completed_sections", "completed_lessons")
            }

            progress_data = []
            total_completed_sections = 0
            total_sections_all = 0
            total_completed_lessons = 0
            total_lessons_all = 0
            for course in courses:
                total_sections = section_counts.get(course.id, 0)
                total_lessons = lesson_counts.get(course.id, 0)
                progress = progress_by_course.get(course.id)
                completed_sections = progress.completed_sections.count() if progress else 0
                completed_lessons = progress.completed_lessons.count() if progress else 0
                section_percent = (
                    (completed_sections / total_sections) * 100 if total_sections > 0 else 0
                )
                lesson_percent = (
                    (completed_lessons / total_lessons) * 100 if total_lessons > 0 else 0
                )
                percent_complete = max(section_percent, lesson_percent)
                total_completed_sections += completed_sections
                total_sections_all += total_sections
                total_completed_lessons += completed_lessons
                total_lessons_all += total_lessons
                progress_data.append(
                    {
                        "path": course.path.title if course.path else None,
                        "path_id": course.path_id,
                        "course": course.title,
                        "course_id": course.id,
                        "percent_complete": percent_complete,
                        "completed_sections": completed_sections,
                        "total_sections": total_sections,
                        "completed_lessons": completed_lessons,
                        "total_lessons": total_lessons,
                    }
                )

        # Resume: last place in the flow (most recently updated flow position)
        resume = None
        last_flow = (
            UserProgress.objects.filter(user=user)
            .exclude(flow_current_index=0)
            .select_related("course", "course__path")
            .order_by("-flow_updated_at")
            .first()
        )
        if not last_flow and progress_data:
            # No flow progress yet; use any course with most recent update
            last_flow = (
                UserProgress.objects.filter(user=user)
                .select_related("course", "course__path")
                .order_by("-flow_updated_at")
                .first()
            )
        if last_flow:
            resume = {
                "course_id": last_flow.course_id,
                "course_title": last_flow.course.title,
                "flow_current_index": getattr(last_flow, "flow_current_index", 0) or 0,
                "path_id": last_flow.course.path_id,
            }

        # Start here: first course of first path the user can access (for "Browse topics" with no resume)
        start_here = None
        allowed_ids = list(_allowed_path_ids(user))
        if allowed_ids:
            first_path = (
                Path.objects.filter(id__in=allowed_ids)
                .order_by("sort_order", "id")
                .values_list("id", flat=True)
                .first()
            )
            if first_path:
                first_course = (
                    Course.objects.filter(path_id=first_path)
                    .order_by("order", "id")
                    .values_list("id", flat=True)
                    .first()
                )
                if first_course:
                    start_here = {"path_id": first_path, "course_id": first_course}

        return Response(
            {
                "overall_progress": (
                    sum(d["percent_complete"] for d in progress_data) / len(progress_data)
                    if progress_data
                    else 0
                ),
                "completed_sections": total_completed_sections if progress_data else 0,
                "total_sections": total_sections_all if progress_data else 0,
                "completed_lessons": total_completed_lessons if progress_data else 0,
                "total_lessons": total_lessons_all if progress_data else 0,
                "paths": progress_data,
                "resume": resume,
                "start_here": start_here,
            }
        )

    @action(detail=False, methods=["post"], url_path="complete_section")
    def complete_section(self, request):
        """Mark a specific section of a lesson as completed."""
        section_id = request.data.get("section_id")
        user = request.user
        try:
            section = LessonSection.objects.get(id=section_id)
            if not section.is_published and not (user.is_staff or user.is_superuser):
                return Response({"error": "Section not available."}, status=403)
            if section.lesson and section.lesson.course and section.lesson.course.path:
                if not _user_can_access_path(user, section.lesson.course.path):
                    return _path_access_denied_response(section.lesson.course.path)
            progress, _ = UserProgress.objects.get_or_create(
                user=user, course=section.lesson.course
            )
            was_new_section = not progress.completed_sections.filter(pk=section.pk).exists()
            if was_new_section:
                progress.completed_sections.add(section)
                _grant_initial_mastery(user, _extract_section_skill(section))
                progress.save()
                grant_reward(
                    user,
                    f"section_first_completion:{user.id}:{section.id}",
                    points=XP_SECTION_FIRST_COMPLETION,
                    coins=COINS_SECTION_FIRST_COMPLETION,
                    bump_streak="user_progress",
                    user_progress=progress,
                )
            invalidate_profile_cache(user)
            return Response({"status": "Section completed"})
        except LessonSection.DoesNotExist:
            return Response({"error": "Invalid section"}, status=400)

    @action(detail=False, methods=["get", "post"], url_path="flow_state")
    def flow_state(self, request):
        """
        Persist / fetch the current index for the immersive course flow.

        GET  /api/userprogress/flow_state/?course=<course_id>
        POST /api/userprogress/flow_state/ { course: <course_id>, current_index: <int> }
        """
        course_id = (
            request.query_params.get("course")
            if request.method == "GET"
            else request.data.get("course")
        )
        if not course_id:
            return Response({"error": "course is required"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            course_id = int(course_id)
        except (TypeError, ValueError):
            return Response(
                {"error": "course must be an integer"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        course = Course.objects.select_related("path").filter(id=course_id).first()
        if not course:
            return Response({"error": "Course not found."}, status=404)
        if course.path and not _user_can_access_path(request.user, course.path):
            return _path_access_denied_response(course.path)

        progress, _ = UserProgress.objects.get_or_create(user=request.user, course_id=course_id)

        if request.method == "GET":
            return Response(
                {
                    "course": course_id,
                    "current_index": int(getattr(progress, "flow_current_index", 0) or 0),
                    "updated_at": (
                        progress.flow_updated_at.isoformat()
                        if getattr(progress, "flow_updated_at", None)
                        else None
                    ),
                }
            )

        current_index = request.data.get("current_index", 0)
        try:
            current_index = int(current_index)
        except (TypeError, ValueError):
            return Response(
                {"error": "current_index must be an integer"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if current_index < 0:
            return Response(
                {"error": "current_index must be >= 0"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        progress.flow_current_index = current_index
        progress.save(update_fields=["flow_current_index", "flow_updated_at"])

        return Response(
            {
                "course": course_id,
                "current_index": int(progress.flow_current_index or 0),
                "updated_at": (
                    progress.flow_updated_at.isoformat() if progress.flow_updated_at else None
                ),
            }
        )


def _safe_decimal(value):
    """Convert numeric-like strings to Decimal while handling percentages."""
    if value is None:
        return None
    try:
        if isinstance(value, (int, float)):
            return Decimal(str(value))
        string_value = str(value).strip()
        if not string_value:
            return None
        if string_value.endswith("%"):
            number = string_value.rstrip("%")
            return Decimal(number) / Decimal("100")
        return Decimal(string_value)
    except (InvalidOperation, ValueError):
        return None


def _get_or_create_mastery(user, skill):
    mastery, _ = Mastery.objects.get_or_create(user=user, skill=skill)
    return mastery


def _select_skill(exercise):
    return getattr(exercise, "category", "General") or "General"


def _compute_xp_delta(is_correct, attempts, hints_used=0, confidence=None):
    base = 15 if is_correct else -5
    if is_correct and attempts == 1:
        base += 5
    base -= hints_used * 2
    if confidence == "low" and is_correct:
        base += 2
    elif confidence == "high" and not is_correct:
        base -= 2
    return base


def _mastery_level_band(proficiency: int) -> str:
    if proficiency >= 80:
        return "pro"
    if proficiency >= 50:
        return "confident"
    if proficiency >= 20:
        return "building"
    return "beginner"


def _mastery_level_label(proficiency: int) -> str:
    band = _mastery_level_band(proficiency)
    if band == "pro":
        return "Pro"
    if band == "confident":
        return "Confident"
    if band == "building":
        return "Building"
    return "Beginner"


def _extract_section_skill(section: LessonSection) -> str:
    exercise_data = section.exercise_data if isinstance(section.exercise_data, dict) else {}
    section_category = exercise_data.get("category")
    if section_category:
        return str(section_category)

    lesson_exercise_data = (
        section.lesson.exercise_data if isinstance(section.lesson.exercise_data, dict) else {}
    )
    lesson_category = lesson_exercise_data.get("category")
    if lesson_category:
        return str(lesson_category)

    if section.title:
        return str(section.title).strip()
    return str(section.lesson.title).strip() or "General"


def _grant_initial_mastery(user, skill: str, baseline: int = 12):
    mastery = _get_or_create_mastery(user, skill)
    baseline = max(1, min(100, int(baseline)))
    if mastery.proficiency < baseline:
        mastery.proficiency = baseline
        mastery.due_at = timezone.now()
        mastery.save(update_fields=["proficiency", "due_at", "last_reviewed"])
    return mastery


def _evaluate_numeric(exercise, user_answer):
    """Evaluate numeric answers with tolerance and simple error diagnostics."""
    data = exercise.exercise_data or {}
    tolerance = Decimal(str(data.get("tolerance", "0.01")))
    expected_raw = exercise.correct_answer or data.get("expected_value")
    expected_value = _safe_decimal(expected_raw)
    user_value = _safe_decimal(user_answer)

    if expected_value is None or user_value is None:
        return (
            False,
            "We couldn't understand the number you entered. Try again with a plain number.",
        )

    diff = abs(user_value - expected_value)
    relative_band = abs(expected_value) * tolerance
    absolute_band = tolerance if tolerance > 0 else Decimal("0")
    threshold = max(relative_band, absolute_band)

    if diff <= threshold:
        return True, "Correct - you're inside the expected range."

    # Diagnostics
    diagnostics = []
    period_hint = data.get("period_hint", "annual")
    if period_hint == "annual":
        if expected_value != 0 and abs(user_value - (expected_value / Decimal("12"))) <= threshold:
            diagnostics.append(
                "It looks like you divided an annual figure by 12 - watch the period."
            )
        if abs(user_value - (expected_value * Decimal("12"))) <= threshold:
            diagnostics.append(
                "You treated an annual figure as monthly; align the period with the prompt."
            )

    if expected_value != 0:
        ratio = user_value / expected_value
        if Decimal("0.98") <= ratio <= Decimal("1.02"):
            diagnostics.append(
                "Close! You may have rounded too early. Keep more precision until the end."
            )
        if ratio.quantize(Decimal("0.01")) == Decimal("100.00"):
            diagnostics.append(
                "Looks like you skipped converting % to a decimal. Try dividing the rate by 100."
            )

    if not diagnostics:
        diagnostics.append("Check your compounding and base values, then retry.")

    return False, " ".join(diagnostics)


def _exercise_user_answers_equal(a, b) -> bool:
    """Best-effort equality for debouncing duplicate rapid submits (double-clicks)."""
    if a is None and b is None:
        return True
    if a is None or b is None:
        return False
    try:
        return json.dumps(a, sort_keys=True, default=str) == json.dumps(
            b, sort_keys=True, default=str
        )
    except (TypeError, ValueError):
        return a == b


def _evaluate_budget(exercise, user_answer):
    data = exercise.exercise_data or {}
    target = data.get("target")
    expected = exercise.correct_answer or {}
    if not isinstance(user_answer, dict):
        return False, "Please fill out each category with a number."

    allocations = {k: _safe_decimal(v) for k, v in user_answer.items()}
    if any(v is None for v in allocations.values()):
        return False, "All categories need a valid number."

    total = sum(allocations.values())
    income = _safe_decimal(data.get("income"))
    messages = []
    is_correct = True

    if income is not None and total != income:
        is_correct = False
        messages.append("Your categories should add up to your income.")

    if target and isinstance(target, dict):
        target_key = target.get("category")
        target_min = _safe_decimal(target.get("min"))
        if target_key and target_min is not None:
            allocation = allocations.get(target_key, Decimal("0"))
            if allocation < target_min:
                is_correct = False
                messages.append(f"Aim for at least {target_min} in {target_key} to hit the goal.")

    if expected:
        expected_decimals = {k: _safe_decimal(v) for k, v in expected.items()}
        if allocations != expected_decimals:
            is_correct = False
            messages.append("Your plan differs from the target solution. Adjust and try again.")

    feedback = " ".join(messages) if messages else "Great allocation - you met the constraints."
    return is_correct, feedback


class ExerciseViewSet(viewsets.ModelViewSet):
    """Manage exercises, including filtering by type, category, and difficulty."""

    queryset = Exercise.objects.prefetch_related("translations").only(*EXERCISE_SAFE_FIELDS)
    serializer_class = ExerciseSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        # Only load safe fields so DBs missing core_exercise.version still work
        queryset = (
            Exercise.objects.all().only(*EXERCISE_SAFE_FIELDS).prefetch_related("translations")
        )
        exercise_type = self.request.query_params.get("type", None)
        category = self.request.query_params.get("category", None)
        difficulty = self.request.query_params.get("difficulty", None)

        if exercise_type:
            queryset = queryset.filter(type=exercise_type)
        if category:
            queryset = queryset.filter(category=category)
        if difficulty:
            queryset = queryset.filter(difficulty=difficulty)

        return apply_learner_exercise_filters(
            queryset,
            self.request.user,
            force_learner=_catalog_request_force_learner(self.request),
        )

    @action(detail=False, methods=["get"])
    def categories(self, request):
        """Get all unique exercise categories."""
        base = apply_learner_exercise_filters(
            Exercise.objects.all().only(*EXERCISE_SAFE_FIELDS),
            request.user,
            force_learner=_catalog_request_force_learner(request),
        )
        categories = base.values_list("category", flat=True).distinct().order_by("category")
        return Response(list(categories))

    @action(detail=True, methods=["post"])
    def submit(self, request, pk=None):
        """Submit an answer for an exercise and update mastery/XP."""
        exercise = self.get_object()
        user_answer = request.data.get("user_answer")
        confidence = request.data.get("confidence")
        hints_used = int(request.data.get("hints_used", 0))

        if user_answer is None:
            return Response(
                {"error": "User answer is required"}, status=status.HTTP_400_BAD_REQUEST
            )

        # Get or create user progress and prevent duplicate rapid submissions
        progress, _ = UserExerciseProgress.objects.get_or_create(
            user=request.user, exercise=exercise
        )
        now = timezone.now()
        # Only throttle duplicate payloads within a short window (double-submit spam).
        # A new answer within 1.5s must still be accepted (e.g. user corrected a typo).
        if (
            progress.attempts
            and progress.last_attempt
            and (now - progress.last_attempt).total_seconds() < 1.5
            and _exercise_user_answers_equal(progress.user_answer, user_answer)
        ):
            return Response(
                {"error": "Please wait before submitting again"},
                status=status.HTTP_429_TOO_MANY_REQUESTS,
            )

        already_completed = progress.completed
        # Update progress
        progress.attempts += 1
        progress.user_answer = user_answer
        progress.last_attempt = now

        correct_answer = exercise.correct_answer
        is_correct = False
        feedback = None

        if exercise.type == "numeric":
            is_correct, feedback = _evaluate_numeric(exercise, user_answer)
        elif exercise.type == "budget-allocation":
            is_correct, feedback = _evaluate_budget(exercise, user_answer)
        else:
            try:
                correct_json = (
                    json.dumps(correct_answer, sort_keys=True)
                    if correct_answer is not None
                    else None
                )
                user_json = (
                    json.dumps(user_answer, sort_keys=True) if user_answer is not None else None
                )
                is_correct = correct_json == user_json
            except (TypeError, ValueError):
                is_correct = correct_answer == user_answer

        if is_correct:
            progress.completed = True

        progress.save()

        mastery = _get_or_create_mastery(request.user, _select_skill(exercise))
        mastery_before = mastery.proficiency
        mastery.bump(is_correct, confidence, hints_used=hints_used, attempts=progress.attempts)

        xp_delta = (
            0
            if already_completed and is_correct
            else _compute_xp_delta(is_correct, progress.attempts, hints_used, confidence)
        )

        if xp_delta > 0:
            capped = min(int(xp_delta), XP_EXERCISE_ATTEMPT_CAP)
            grant_reward(
                request.user,
                f"exercise_xp:{request.user.id}:{exercise.id}:a{progress.attempts}",
                points=capped,
                coins=Decimal("0"),
                bump_streak="none",
            )
            xp_delta = capped

        logger.info(
            "attempt_submitted",
            extra={
                "user_id": request.user.id,
                "exercise_id": exercise.id,
                "exercise_type": exercise.type,
                "correct": is_correct,
                "confidence": confidence,
                "hints_used": hints_used,
                "attempts": progress.attempts,
                "mastery_before": mastery_before,
                "mastery_after": mastery.proficiency,
                "due_at": mastery.due_at,
            },
        )

        return Response(
            {
                "correct": is_correct,
                "attempts": progress.attempts,
                "explanation": getattr(exercise, "explanation", None),
                "feedback": feedback
                or (
                    "On point - keep going!"
                    if is_correct
                    else "Not quite. Re-read the prompt and try again."
                ),
                "xp_delta": xp_delta,
                "due_at": mastery.due_at,
                "proficiency": mastery.proficiency,
                "level_band": _mastery_level_band(mastery.proficiency),
                "level_label": _mastery_level_label(mastery.proficiency),
                "skill": _select_skill(exercise),
                "first_unlock": mastery_before == 0 and mastery.proficiency > 0,
            }
        )


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def get_exercise_progress(request, exercise_id):
    """Retrieve the progress of a specific exercise for the authenticated user."""
    if not learner_can_access_exercise(request.user, exercise_id):
        return Response({"error": "Exercise not found."}, status=404)
    try:
        exercise = Exercise.objects.only(*EXERCISE_SAFE_FIELDS).get(id=exercise_id)
        progress = UserExerciseProgress.objects.filter(user=request.user, exercise=exercise).first()

        if progress:
            return Response(
                {
                    "completed": progress.completed,
                    "attempts": progress.attempts,
                    "user_answer": progress.user_answer,
                }
            )
        else:
            return Response({"completed": False, "attempts": 0, "user_answer": None})
    except Exercise.DoesNotExist:
        return Response({"error": "Exercise not found."}, status=404)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def get_exercise_progress_batch(request):
    """
    Retrieve exercise progress for multiple exercise IDs in a single request.
    Query param: ids=1,2,3
    """
    raw_ids = (request.query_params.get("ids") or "").strip()
    if not raw_ids:
        return Response({"progress": {}})

    parsed_ids = []
    for part in raw_ids.split(","):
        token = part.strip()
        if not token:
            continue
        try:
            parsed_ids.append(int(token))
        except (TypeError, ValueError):
            continue

    if not parsed_ids:
        return Response({"progress": {}})

    allowed_ids = list(
        apply_learner_exercise_filters(
            Exercise.objects.only(*EXERCISE_SAFE_FIELDS).filter(id__in=parsed_ids),
            request.user,
        ).values_list("id", flat=True)
    )
    if not allowed_ids:
        return Response({"progress": {}})

    rows = UserExerciseProgress.objects.filter(
        user=request.user, exercise_id__in=allowed_ids
    ).values("exercise_id", "completed", "attempts", "user_answer")

    progress_map = {
        str(row["exercise_id"]): {
            "completed": bool(row["completed"]),
            "attempts": int(row["attempts"] or 0),
            "user_answer": row["user_answer"],
            "status": "completed" if row["completed"] else "attempted",
        }
        for row in rows
    }
    return Response({"progress": progress_map})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def reset_exercise(request):
    """Reset exercise progress for a user."""
    exercise_id = request.data.get("exercise_id")
    section_id = request.data.get("section_id")

    if not exercise_id and not section_id:
        return Response({"error": "Either exercise_id or section_id is required"}, status=400)

    if exercise_id:
        try:
            ex_id_int = int(exercise_id)
        except (TypeError, ValueError):
            return Response({"error": "Invalid exercise_id"}, status=400)
        if not learner_can_access_exercise(request.user, ex_id_int):
            return Response({"error": "Exercise not found."}, status=404)

    try:
        if section_id:
            # If section_id is provided, find the exercise through the section
            section = LessonSection.objects.get(id=section_id)
            exercise = Exercise.objects.only(*EXERCISE_SAFE_FIELDS).filter(section=section).first()
            if not exercise:
                return Response({"error": "No exercise found for this section"}, status=404)
            exercise_id = exercise.id

        progress = UserExerciseProgress.objects.get(user=request.user, exercise_id=exercise_id)
        progress.attempts = 0
        progress.completed = False
        progress.user_answer = None
        progress.save()
        return Response({"message": "Progress reset successfully."}, status=200)
    except (
        UserExerciseProgress.DoesNotExist,
        LessonSection.DoesNotExist,
        Exercise.DoesNotExist,
    ):
        return Response({"error": "No progress found to reset."}, status=404)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def review_queue(request):
    """Return a lightweight review queue based on mastery due dates."""
    now = timezone.now()
    due_mastery = Mastery.objects.filter(user=request.user, due_at__lte=now).order_by("due_at")
    queue = []
    for mastery in due_mastery:
        exercise = (
            apply_learner_exercise_filters(
                Exercise.objects.only(*EXERCISE_SAFE_FIELDS).filter(category=mastery.skill),
                request.user,
            )
            .order_by("difficulty", "id")
            .first()
        )
        if not exercise:
            continue
        queue.append(
            {
                "skill": mastery.skill,
                "exercise_id": exercise.id,
                "question": exercise.question,
                "type": exercise.type,
                "due_at": mastery.due_at,
                "proficiency": mastery.proficiency,
                "level_band": _mastery_level_band(mastery.proficiency),
                "level_label": _mastery_level_label(mastery.proficiency),
            }
        )
    logger.info(
        "review_queue",
        extra={
            "user_id": request.user.id,
            "count": len(queue),
        },
    )
    return Response({"due": queue, "count": len(queue)})


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def mastery_summary(request):
    """Return mastery data for all skills, sorted by proficiency (lowest first)."""
    masteries = Mastery.objects.filter(user=request.user).order_by("proficiency", "skill")
    mastery_data = [
        {
            "skill": mastery.skill,
            "proficiency": mastery.proficiency,
            "due_at": mastery.due_at,
            "last_reviewed": mastery.last_reviewed,
            "level_band": _mastery_level_band(mastery.proficiency),
            "level_label": _mastery_level_label(mastery.proficiency),
        }
        for mastery in masteries
    ]
    return Response({"masteries": mastery_data})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def next_exercise(request):
    """Return the next recommended exercise based on mastery gaps and recent attempt."""
    last_exercise_id = request.data.get("last_exercise_id")
    last_correct = request.data.get("last_correct")

    queue_response = review_queue(request)
    if queue_response.data.get("due"):
        return Response(
            {
                "exercise_id": queue_response.data["due"][0]["exercise_id"],
                "reason": "review_due",
            }
        )

    completed_ids = set(
        UserExerciseProgress.objects.filter(user=request.user, completed=True).values_list(
            "exercise_id", flat=True
        )
    )

    if last_exercise_id and not last_correct:
        try:
            last_id_int = int(last_exercise_id)
        except (TypeError, ValueError):
            last_id_int = None
        if last_id_int and learner_can_access_exercise(request.user, last_id_int):
            retry = Exercise.objects.only(*EXERCISE_SAFE_FIELDS).filter(id=last_id_int).first()
            if retry:
                return Response({"exercise_id": retry.id, "reason": "remediate"})

    learner_qs = apply_learner_exercise_filters(
        Exercise.objects.only(*EXERCISE_SAFE_FIELDS),
        request.user,
    )
    next_available = learner_qs.exclude(id__in=completed_ids).order_by("difficulty", "id").first()
    if next_available:
        return Response({"exercise_id": next_available.id, "reason": "fresh"})

    fallback = learner_qs.order_by("-created_at").first()
    if fallback:
        return Response({"exercise_id": fallback.id, "reason": "fallback"})

    logger.info("next_exercise_not_found", extra={"user_id": request.user.id})
    return Response({"error": "No exercises available"}, status=404)


class PersonalizedPathView(APIView):
    """Generate and return personalized recommendations with metadata."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            user = request.user
            user_profile = UserProfile.objects.get(user=user)
            plan = get_user_plan(user)
            allowed_path_ids = _allowed_path_ids(user)
            force_refresh = str(request.query_params.get("refresh", "")).lower() in {
                "1",
                "true",
                "yes",
            }

            if not self._has_completed_questionnaire(user):
                return Response(
                    {
                        "error": "Please complete onboarding to unlock your personalized path.",
                        "redirect": "/onboarding",
                    },
                    status=400,
                )

            if self._should_regenerate(user_profile, user, allowed_path_ids, force_refresh):
                self.generate_recommendations(
                    user_profile=user_profile, user=user, allowed_path_ids=allowed_path_ids
                )

            courses = (
                Course.objects.filter(
                    id__in=user_profile.recommended_courses,
                    path_id__in=allowed_path_ids,
                    is_active=True,
                )
                .select_related("path")
                .order_by("path__sort_order", "order", "id")
            )
            serializer = CourseSerializer(courses, many=True, context={"request": request})
            payload_courses = serializer.data

            answers = self._get_onboarding_answers(user)
            mastery_boosts = self._get_low_mastery_boosts(user)
            course_ids = [c.id for c in courses]
            sections_total_map = {
                row["lesson__course_id"]: int(row["total"])
                for row in LessonSection.objects.filter(
                    lesson__course_id__in=course_ids,
                    is_published=True,
                )
                .values("lesson__course_id")
                .annotate(total=Count("id"))
            }
            progress_by_course = {}
            for progress in UserProgress.objects.filter(
                user=user,
                course_id__in=course_ids,
            ).prefetch_related("completed_sections", "completed_lessons"):
                progress_by_course[progress.course_id] = {
                    "completed_sections": progress.completed_sections.count(),
                    "completed_lessons": progress.completed_lessons.count(),
                    "completed_lesson_ids": set(
                        progress.completed_lessons.values_list("id", flat=True)
                    ),
                }

            progress_values = []
            for idx, item in enumerate(payload_courses):
                course_id = int(item.get("id") or 0)
                progress_meta = progress_by_course.get(
                    course_id,
                    {
                        "completed_sections": 0,
                        "completed_lessons": 0,
                        "completed_lesson_ids": set(),
                    },
                )
                total_lessons = int(item.get("total_lessons") or 0)
                completed_lessons = int(progress_meta.get("completed_lessons") or 0)
                total_sections = int(sections_total_map.get(course_id, 0))
                completed_sections = int(progress_meta.get("completed_sections") or 0)
                completion_percent = (
                    round((completed_lessons / max(total_lessons, 1)) * 100, 1)
                    if total_lessons > 0
                    else 0.0
                )
                if total_lessons > 0:
                    progress_values.append(completion_percent)
                path_key = self._path_key(str(item.get("path_title") or ""))
                next_lesson_title = self._next_lesson_title(
                    course_id=course_id,
                    completed_lesson_ids=progress_meta.get("completed_lesson_ids") or set(),
                )
                item["completion_percent"] = completion_percent
                item["estimated_minutes"] = max(total_lessons * 4, 8)
                item["reason"] = self._build_course_reason(path_key, answers, mastery_boosts)
                item["locked"] = False
                item["priority_rank"] = idx + 1
                item["completed_lessons"] = completed_lessons
                item["total_lessons"] = total_lessons
                item["completed_sections"] = completed_sections
                item["total_sections"] = total_sections
                item["next_lesson_title"] = next_lesson_title
                item["starter_tasks"] = (
                    [
                        "Complete the first section to unlock momentum.",
                        "Watch or read one concept, then answer one exercise.",
                        "Finish one lesson to mark this course as in progress.",
                    ]
                    if completed_sections == 0
                    else []
                )

            generated_at_dt = user_profile.recommendations_generated_at or timezone.now()
            overall_completion = round(
                (sum(progress_values) / len(progress_values)) if progress_values else 0.0, 1
            )
            response_payload = {
                "courses": payload_courses,
                "meta": {
                    "generated_at": generated_at_dt.isoformat(),
                    "onboarding_goals": self._extract_onboarding_goals(answers),
                    "refresh_available": generated_at_dt
                    <= timezone.now() - timezone.timedelta(minutes=1),
                    "overall_completion": overall_completion,
                    "preview": False,
                },
                "review_queue": self._skills_to_reinforce(user),
                "message": "Recommended courses based on your goals, progress, and mastery.",
            }

            if not plan_allows(plan, "plus"):
                preview_courses = response_payload["courses"][:2]
                for item in preview_courses:
                    item["locked"] = True
                response_payload["courses"] = preview_courses
                response_payload["meta"]["preview"] = True
                response_payload["upgrade_prompt"] = "Unlock your full personalized path with Plus."
                response_payload["message"] = (
                    "Preview your personalized path and upgrade to unlock all recommendations."
                )

            response = Response(response_payload, status=200)
            response["Cache-Control"] = "no-store, max-age=0"
            return response
        except Exception as exc:
            logger.critical("Critical error in personalized path: %s", str(exc), exc_info=True)
            return Response(
                {
                    "error": "We're having trouble generating recommendations. Our team has been notified."
                },
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

    def generate_recommendations(self, user_profile, user, allowed_path_ids):
        answers = self._get_onboarding_answers(user)
        weights = self.calculate_onboarding_path_weights(answers) if answers else defaultdict(int)
        mastery_boosts = self._get_low_mastery_boosts(user)
        for key, boost in mastery_boosts.items():
            weights[key] += boost

        sorted_paths = self.get_sorted_paths(weights, allowed_path_ids)
        recommended_courses = self.get_recommended_courses(sorted_paths, allowed_path_ids)
        user_profile.recommended_courses = [c.id for c in recommended_courses]
        user_profile.recommendations_generated_at = timezone.now()
        user_profile.save(update_fields=["recommended_courses", "recommendations_generated_at"])

    def _should_regenerate(self, user_profile, user, allowed_path_ids, force_refresh=False):
        if force_refresh:
            return True
        if not user_profile.recommended_courses or not user_profile.recommendations_generated_at:
            return True
        if user_profile.recommendations_generated_at <= timezone.now() - timezone.timedelta(days=7):
            return True
        if UserProgress.objects.filter(
            user=user,
            course_id__in=user_profile.recommended_courses,
            is_course_complete=True,
        ).exists():
            return True
        return not Course.objects.filter(
            id__in=user_profile.recommended_courses,
            path_id__in=allowed_path_ids,
            is_active=True,
        ).exists()

    def _get_onboarding_answers(self, user):
        progress = QuestionnaireProgress.objects.filter(user=user).first()
        if not progress or not progress.answers:
            return {}
        return progress.answers

    def calculate_onboarding_path_weights(self, answers):
        weights = defaultdict(int)
        primary_goal = answers.get("primary_goal")
        if primary_goal == "budget":
            weights["budget"] += 4
        elif primary_goal == "debt":
            weights["debt"] += 4
        elif primary_goal == "savings":
            weights["savings"] += 4
        elif primary_goal == "invest":
            weights["invest"] += 4

        biggest_challenge = answers.get("biggest_challenge")
        if biggest_challenge == "overspending":
            weights["budget"] += 3
            weights["savings"] += 1
        elif biggest_challenge == "no_plan":
            weights["budget"] += 2
        elif biggest_challenge == "debt":
            weights["debt"] += 3
        elif biggest_challenge == "confidence":
            weights["invest"] += 2
        return weights

    def get_sorted_paths(self, weights, allowed_path_ids):
        keyword_map = {
            "budget": ["budget", "budgeting", "spending", "cash"],
            "debt": ["debt", "credit"],
            "savings": ["savings", "saving", "emergency"],
            "invest": [
                "invest",
                "investing",
                "stocks",
                "portfolio",
                "real estate",
                "crypto",
                "forex",
            ],
        }
        paths = list(Path.objects.filter(id__in=allowed_path_ids).order_by("sort_order", "id"))
        scored = []
        for path in paths:
            title = (path.title or "").lower()
            score = 0
            for key, keywords in keyword_map.items():
                if any(k in title for k in keywords):
                    score += weights.get(key, 0)
            scored.append((path, score))
        scored.sort(key=lambda pair: pair[1], reverse=True)
        return [path for path, _ in scored]

    def get_recommended_courses(self, sorted_paths, allowed_path_ids):
        recommended_courses = []
        try:
            for path in sorted_paths[:3]:
                recommended_courses.extend(
                    Course.objects.filter(path=path, is_active=True).order_by("order", "id")[:2]
                )
            if len(recommended_courses) < 10:
                recommended_courses.extend(
                    Course.objects.filter(is_active=True, path_id__in=allowed_path_ids)
                    .exclude(id__in=[c.id for c in recommended_courses])
                    .order_by("path__sort_order", "order", "id")[: 10 - len(recommended_courses)]
                )
            return recommended_courses[:10]
        except Exception as exc:
            logger.error("Course fetch error: %s", str(exc))
            return list(
                Course.objects.filter(is_active=True, path_id__in=allowed_path_ids).order_by(
                    "path__sort_order", "order", "id"
                )[:10]
            )

    def _path_key(self, value: str):
        title = (value or "").lower()
        if any(k in title for k in ["budget", "cash", "spend"]):
            return "budget"
        if any(k in title for k in ["debt", "credit"]):
            return "debt"
        if any(k in title for k in ["saving", "emergency"]):
            return "savings"
        if any(
            k in title for k in ["invest", "stock", "portfolio", "real estate", "crypto", "forex"]
        ):
            return "invest"
        return "general"

    def _get_low_mastery_boosts(self, user):
        boosts = defaultdict(int)
        for mastery in Mastery.objects.filter(user=user, proficiency__lt=30):
            boosts[self._path_key(mastery.skill)] += 2
        return boosts

    def _extract_onboarding_goals(self, answers):
        goals = []
        for key in ("primary_goal", "biggest_challenge"):
            value = answers.get(key)
            if value:
                goals.append(str(value))
        return goals

    def _build_course_reason(self, path_key, answers, mastery_boosts):
        if mastery_boosts.get(path_key, 0) >= 2:
            return "Recommended to reinforce one of your weakest skills."
        primary_goal = str(answers.get("primary_goal") or "")
        if primary_goal:
            return f"Matches your onboarding goal: {primary_goal}."
        return "Recommended to build a balanced money foundation."

    def _skills_to_reinforce(self, user):
        items = []
        for mastery in Mastery.objects.filter(user=user, due_at__lte=timezone.now()).order_by(
            "due_at"
        )[:6]:
            items.append(
                {
                    "skill": mastery.skill,
                    "proficiency": mastery.proficiency,
                    "due_at": mastery.due_at.isoformat() if mastery.due_at else None,
                }
            )
        return items

    def _next_lesson_title(self, course_id, completed_lesson_ids):
        next_lesson = (
            Lesson.objects.filter(course_id=course_id)
            .exclude(id__in=list(completed_lesson_ids))
            .order_by("id")
            .first()
        )
        return next_lesson.title if next_lesson else None

    def _has_completed_questionnaire(self, user):
        progress = QuestionnaireProgress.objects.filter(user=user).first()
        return bool(progress and progress.status == "completed")


class PersonalizedPathRefreshView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        try:
            user_profile = UserProfile.objects.get(user=request.user)
            allowed_path_ids = _allowed_path_ids(request.user)
            PersonalizedPathView().generate_recommendations(
                user_profile=user_profile,
                user=request.user,
                allowed_path_ids=allowed_path_ids,
            )
            return Response(
                {
                    "status": "ok",
                    "generated_at": (
                        user_profile.recommendations_generated_at or timezone.now()
                    ).isoformat(),
                },
                status=200,
            )
        except Exception as exc:
            logger.error(
                "personalized_path_refresh_failed user_id=%s err=%s", request.user.id, str(exc)
            )
            return Response({"error": "Unable to refresh recommendations right now."}, status=500)

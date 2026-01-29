import logging
import uuid
from django.db import transaction
from django.utils import timezone
from django.utils.decorators import method_decorator
from django.views.decorators.cache import never_cache
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from django.db.models import Q
from datetime import timedelta

from onboarding.models import QuestionnaireProgress, QuestionnaireVersion
from onboarding.serializers import (
    QuestionnaireProgressSerializer,
    QuestionnaireAnswerSerializer,
    QuestionnaireNextQuestionResponseSerializer,
    QuestionnaireCompletionSerializer,
)
from authentication.models import UserProfile
from finance.utils import record_funnel_event

logger = logging.getLogger(__name__)

# Stale progress cleanup threshold (30 days)
STALE_PROGRESS_THRESHOLD_DAYS = 30


def _get_active_questionnaire_version():
    """Get the currently active questionnaire version."""
    return QuestionnaireVersion.objects.filter(is_active=True).order_by("-version").first()


def _evaluate_skip_condition(condition, answers):
    """
    Evaluate a skip condition based on previous answers.
    Condition format: {"field": "question_id", "operator": ">", "value": "intermediate"}
    Supported operators: >, <, ==, !=, in, not_in
    """
    if not condition:
        return False

    field = condition.get("field")
    operator = condition.get("operator")
    value = condition.get("value")

    if not field or not operator:
        return False

    answer_value = answers.get(field)

    if operator == "==":
        return answer_value == value
    elif operator == "!=":
        return answer_value != value
    elif operator == ">":
        return answer_value > value if isinstance(answer_value, (int, float)) else False
    elif operator == "<":
        return answer_value < value if isinstance(answer_value, (int, float)) else False
    elif operator == "in":
        return answer_value in value if isinstance(value, list) else False
    elif operator == "not_in":
        return answer_value not in value if isinstance(value, list) else False

    return False


def _get_next_question(progress, section_index, question_index):
    """
    Get the next question based on current progress and skip logic.
    Returns (question, new_section_index, new_question_index, is_last)
    """
    version = progress.version
    structure = version.questionnaire_structure
    sections = structure.get("sections", [])

    if not sections:
        return None, 0, 0, True

    current_section = sections[section_index] if section_index < len(sections) else None
    if not current_section:
        return None, section_index, question_index, True

    questions = current_section.get("questions", [])
    if question_index >= len(questions):
        # Move to next section
        if section_index + 1 >= len(sections):
            return None, section_index, question_index, True
        next_section = sections[section_index + 1]
        next_questions = next_section.get("questions", [])
        if not next_questions:
            return None, section_index + 1, 0, True
        return next_questions[0], section_index + 1, 0, False

    # Check if current question should be skipped
    current_question = questions[question_index]
    skip_condition = current_question.get("skip_if")

    if skip_condition and _evaluate_skip_condition(skip_condition, progress.answers):
        # Skip this question, move to next
        if question_index + 1 < len(questions):
            return _get_next_question(progress, section_index, question_index + 1)
        else:
            # End of section, move to next section
            if section_index + 1 >= len(sections):
                return None, section_index + 1, 0, True
            next_section = sections[section_index + 1]
            next_questions = next_section.get("questions", [])
            if not next_questions:
                return None, section_index + 1, 0, True
            return _get_next_question(progress, section_index + 1, 0)

    return current_question, section_index, question_index, False


def _generate_section_summary(progress, section_index):
    """Generate a summary of answers for a completed section."""
    version = progress.version
    structure = version.questionnaire_structure
    sections = structure.get("sections", [])

    if section_index >= len(sections):
        return None

    section = sections[section_index]
    section_title = section.get("title", f"Section {section_index + 1}")
    questions = section.get("questions", [])
    summary_items = []

    for question in questions:
        question_id = question.get("id")
        if question_id in progress.answers:
            answer = progress.answers[question_id]
            question_text = question.get("text", "")
            # Format answer for display
            if isinstance(answer, dict):
                answer_text = answer.get("value", str(answer))
            elif isinstance(answer, list):
                answer_text = ", ".join(str(a) for a in answer)
            else:
                answer_text = str(answer)
            summary_items.append({"question": question_text, "answer": answer_text})

    return {
        "section_title": section_title,
        "answers": summary_items,
    }


class QuestionnaireProgressView(APIView):
    """Get or create questionnaire progress for the current user."""

    permission_classes = [IsAuthenticated]

    @method_decorator(never_cache)
    def get(self, request):
        """Get current progress or create new progress if none exists."""
        try:
            progress = QuestionnaireProgress.objects.get(user=request.user)
            serializer = QuestionnaireProgressSerializer(progress)
            return Response(serializer.data)
        except QuestionnaireProgress.DoesNotExist:
            # Create new progress
            version = _get_active_questionnaire_version()
            if not version:
                return Response(
                    {"error": "No active questionnaire version found"},
                    status=status.HTTP_503_SERVICE_UNAVAILABLE,
                )

            progress = QuestionnaireProgress.objects.create(
                user=request.user,
                version=version,
                status="in_progress",
            )
            serializer = QuestionnaireProgressSerializer(progress)
            return Response(serializer.data, status=status.HTTP_201_CREATED)


class QuestionnaireNextQuestionView(APIView):
    """Get the next question based on current progress and skip logic."""

    permission_classes = [IsAuthenticated]

    @method_decorator(never_cache)
    def get(self, request):
        """Get the next question to display."""
        try:
            progress = QuestionnaireProgress.objects.get(user=request.user)
        except QuestionnaireProgress.DoesNotExist:
            return Response(
                {"error": "No questionnaire progress found. Please start the questionnaire."},
                status=status.HTTP_404_NOT_FOUND,
            )

        if progress.status == "completed":
            return Response(
                {"error": "Questionnaire already completed"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        question, section_idx, question_idx, is_last = _get_next_question(
            progress, progress.current_section_index, progress.current_question_index
        )

        if not question:
            return Response(
                {"error": "No more questions available"},
                status=status.HTTP_404_NOT_FOUND,
            )

        # Get section summary if we're starting a new section
        section_summary = None
        if section_idx > progress.current_section_index:
            section_summary = _generate_section_summary(progress, progress.current_section_index)

        structure = progress.version.questionnaire_structure
        sections = structure.get("sections", [])
        current_section = sections[section_idx] if section_idx < len(sections) else None
        total_questions_in_section = len(current_section.get("questions", [])) if current_section else 0

        response_data = {
            "question": question,
            "section_index": section_idx,
            "question_index": question_idx,
            "total_sections": len(sections),
            "total_questions_in_section": total_questions_in_section,
            "progress_percentage": progress.get_progress_percentage(),
            "is_last_question": is_last,
        }

        if section_summary:
            response_data["section_summary"] = section_summary

        serializer = QuestionnaireNextQuestionResponseSerializer(response_data)
        return Response(serializer.data)


class QuestionnaireSaveAnswerView(APIView):
    """Save an answer incrementally with idempotent saving."""

    permission_classes = [IsAuthenticated]

    def post(self, request):
        """Save an answer for a question."""
        answer_serializer = QuestionnaireAnswerSerializer(data=request.data)
        if not answer_serializer.is_valid():
            return Response(answer_serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        question_id = answer_serializer.validated_data["question_id"]
        answer = answer_serializer.validated_data["answer"]
        section_index = answer_serializer.validated_data["section_index"]
        question_index = answer_serializer.validated_data["question_index"]
        time_spent = answer_serializer.validated_data.get("time_spent_seconds")

        try:
            progress = QuestionnaireProgress.objects.get(user=request.user)
        except QuestionnaireProgress.DoesNotExist:
            return Response(
                {"error": "No questionnaire progress found"},
                status=status.HTTP_404_NOT_FOUND,
            )

        if progress.status == "completed":
            return Response(
                {"error": "Questionnaire already completed"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        with transaction.atomic():
            # Idempotent save: only update if answer doesn't exist or is different
            existing_answer = progress.answers.get(question_id)
            if existing_answer != answer:
                progress.answers[question_id] = answer
                progress.current_section_index = section_index
                progress.current_question_index = question_index
                progress.updated_at = timezone.now()

                # Update section_answers for summary
                section_key = f"section_{section_index}"
                if section_key not in progress.section_answers:
                    progress.section_answers[section_key] = {}
                progress.section_answers[section_key][question_id] = answer

                if time_spent is not None:
                    progress.time_spent_per_question[question_id] = time_spent

                progress.save()

                # Track analytics
                record_funnel_event(
                    "questionnaire_answer_submitted",
                    user=request.user,
                    metadata={
                        "question_id": question_id,
                        "section_index": section_index,
                        "question_index": question_index,
                        "time_spent_seconds": time_spent,
                    },
                )

        serializer = QuestionnaireProgressSerializer(progress)
        return Response(serializer.data)


class QuestionnaireCompleteView(APIView):
    """Complete the questionnaire and grant rewards."""

    permission_classes = [IsAuthenticated]

    def post(self, request):
        """Mark questionnaire as completed and grant rewards."""
        completion_serializer = QuestionnaireCompletionSerializer(data=request.data)
        if not completion_serializer.is_valid():
            return Response(completion_serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        idempotency_key = completion_serializer.validated_data.get("idempotency_key")
        if not idempotency_key:
            idempotency_key = f"{request.user.id}_{uuid.uuid4().hex[:16]}"

        try:
            progress = QuestionnaireProgress.objects.select_for_update().get(user=request.user)
        except QuestionnaireProgress.DoesNotExist:
            return Response(
                {"error": "No questionnaire progress found"},
                status=status.HTTP_404_NOT_FOUND,
            )

        if progress.status == "completed":
            # Check if rewards were already granted
            if progress.rewards_granted:
                return Response(
                    {
                        "message": "Questionnaire already completed",
                        "rewards_granted": True,
                        "xp_awarded": 0,  # Could store this in progress if needed
                    },
                    status=status.HTTP_200_OK,
                )

        with transaction.atomic():
            # Check idempotency
            if progress.completion_idempotency_key == idempotency_key and progress.rewards_granted:
                return Response(
                    {
                        "message": "Questionnaire already completed",
                        "rewards_granted": True,
                    },
                    status=status.HTTP_200_OK,
                )

            # Mark as completed
            progress.status = "completed"
            progress.completed_at = timezone.now()
            progress.completion_idempotency_key = idempotency_key

            # Grant rewards (idempotent)
            if not progress.rewards_granted:
                user_profile = request.user.profile
                xp_reward = 100  # Base XP for completing questionnaire
                coins_reward = 10  # Base coins

                user_profile.add_points(xp_reward)
                user_profile.add_money(coins_reward)
                progress.rewards_granted = True

                logger.info(
                    "questionnaire_completed",
                    extra={
                        "user_id": request.user.id,
                        "xp_awarded": xp_reward,
                        "coins_awarded": float(coins_reward),
                    },
                )

            progress.save()

            # Track analytics
            total_time = sum(progress.time_spent_per_question.values())
            record_funnel_event(
                "questionnaire_completed",
                user=request.user,
                metadata={
                    "version": progress.version.version,
                    "total_time_seconds": total_time,
                    "sections_completed": progress.get_completed_sections_count(),
                },
            )

        serializer = QuestionnaireProgressSerializer(progress)
        return Response(
            {
                "message": "Questionnaire completed successfully",
                "progress": serializer.data,
                "rewards": {
                    "xp": 100,
                    "coins": 10,
                },
            },
            status=status.HTTP_200_OK,
        )


class QuestionnaireAbandonView(APIView):
    """Mark questionnaire as abandoned."""

    permission_classes = [IsAuthenticated]

    def post(self, request):
        """Mark questionnaire progress as abandoned."""
        try:
            progress = QuestionnaireProgress.objects.get(user=request.user)
        except QuestionnaireProgress.DoesNotExist:
            return Response(
                {"error": "No questionnaire progress found"},
                status=status.HTTP_404_NOT_FOUND,
            )

        if progress.status == "completed":
            return Response(
                {"error": "Cannot abandon a completed questionnaire"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        progress.status = "abandoned"
        progress.save()

        # Track analytics
        record_funnel_event(
            "questionnaire_abandoned",
            user=request.user,
            metadata={
                "section_index": progress.current_section_index,
                "question_index": progress.current_question_index,
                "progress_percentage": progress.get_progress_percentage(),
            },
        )

        serializer = QuestionnaireProgressSerializer(progress)
        return Response(serializer.data)


class QuestionnaireCleanupView(APIView):
    """Admin endpoint to clean up stale progress entries."""

    permission_classes = [IsAuthenticated]

    def post(self, request):
        """Clean up stale progress entries (older than threshold)."""
        if not request.user.is_staff:
            return Response(
                {"error": "Permission denied"},
                status=status.HTTP_403_FORBIDDEN,
            )

        threshold_date = timezone.now() - timedelta(days=STALE_PROGRESS_THRESHOLD_DAYS)
        stale_progress = QuestionnaireProgress.objects.filter(
            Q(status="abandoned") | Q(status="in_progress", updated_at__lt=threshold_date)
        )

        count = stale_progress.count()
        stale_progress.delete()

        return Response(
            {"message": f"Cleaned up {count} stale progress entries"},
            status=status.HTTP_200_OK,
        )


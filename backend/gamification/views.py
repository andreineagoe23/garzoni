# gamification/views.py
from rest_framework import viewsets, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.decorators import action
from rest_framework.throttling import UserRateThrottle
import logging
from datetime import timedelta
from django.utils import timezone
from django.db import transaction
from django.db.models import Avg
from django.core.cache import cache
import hashlib
import json

from gamification.models import (
    Badge,
    UserBadge,
    Mission,
    MissionCompletion,
    StreakItem,
    MissionPerformance,
)
from gamification.serializers import (
    BadgeSerializer,
    UserBadgeSerializer,
    MissionCompletionSerializer,
    LeaderboardSerializer,
)
from authentication.models import UserProfile
from education.models import LessonCompletion, QuizCompletion, UserProgress, Mastery, Exercise

logger = logging.getLogger(__name__)


class MissionCompletionThrottle(UserRateThrottle):
    """Rate limit mission completions to prevent abuse."""

    rate = "10/minute"


class MissionView(APIView):
    """API view to retrieve and update user missions, including daily and weekly missions."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        """Handle GET requests to fetch the user's daily and weekly missions."""
        user = request.user
        try:
            daily_completions = MissionCompletion.objects.filter(
                user=user, mission__mission_type="daily"
            )
            weekly_completions = MissionCompletion.objects.filter(
                user=user, mission__mission_type="weekly"
            )

            daily_missions = []
            weekly_missions = []

            for completion in daily_completions:
                daily_missions.append(
                    {
                        "id": completion.mission.id,
                        "name": completion.mission.name,
                        "description": completion.mission.description,
                        "points_reward": completion.mission.points_reward,
                        "progress": completion.progress,
                        "status": completion.status,
                        "goal_type": completion.mission.goal_type,
                        "goal_reference": completion.mission.goal_reference or {},
                    }
                )

            for completion in weekly_completions:
                weekly_missions.append(
                    {
                        "id": completion.mission.id,
                        "name": completion.mission.name,
                        "description": completion.mission.description,
                        "points_reward": completion.mission.points_reward,
                        "progress": completion.progress,
                        "status": completion.status,
                        "goal_type": completion.mission.goal_type,
                        "goal_reference": completion.mission.goal_reference or {},
                    }
                )

            return Response(
                {
                    "daily_missions": daily_missions,
                    "weekly_missions": weekly_missions,
                },
                status=200,
            )

        except Exception as e:
            logger.error(f"Error fetching missions: {str(e)}")
            return Response(
                {"error": "An error occurred while fetching missions."},
                status=500,
            )

    def post(self, request, mission_id=None):
        """Handle POST requests to update the progress of a specific mission."""
        user = request.user
        mission_id = mission_id or request.data.get("mission_id")

        if not mission_id:
            return Response({"error": "Mission ID is required."}, status=400)

        try:
            mission_completion = MissionCompletion.objects.get(user=user, mission_id=mission_id)
            increment = request.data.get("progress", 0)

            if not isinstance(increment, (int, float)):
                return Response({"error": "Progress must be a number."}, status=400)

            mission_completion.update_progress(increment)
            return Response(
                {"message": "Mission progress updated.", "progress": mission_completion.progress},
                status=200,
            )

        except MissionCompletion.DoesNotExist:
            return Response({"error": "Mission not found for this user."}, status=404)
        except Exception as e:
            logger.error(f"Error updating mission progress for user {user.username}: {str(e)}")
            return Response(
                {"error": "An error occurred while updating mission progress."}, status=500
            )


class MissionCompleteView(APIView):
    """
    Idempotent mission completion endpoint with server-side XP validation.
    """

    permission_classes = [IsAuthenticated]
    throttle_classes = [MissionCompletionThrottle]

    def post(self, request):

        user = request.user
        mission_id = request.data.get("mission_id")
        idempotency_key = request.data.get("idempotency_key")

        if not mission_id:
            return Response({"error": "Mission ID is required."}, status=400)

        if not idempotency_key:
            return Response({"error": "Idempotency key is required."}, status=400)

        # Generate idempotency key if not provided
        if not idempotency_key:
            key_data = f"{user.id}_{mission_id}_{timezone.now().isoformat()}"
            idempotency_key = hashlib.sha256(key_data.encode()).hexdigest()

        try:
            with transaction.atomic():
                # Check if already completed with this key
                existing = MissionCompletion.objects.filter(
                    completion_idempotency_key=idempotency_key
                ).first()

                if existing:
                    # Return existing completion data
                    return Response(
                        {
                            "message": "Mission already completed.",
                            "xp_awarded": existing.xp_awarded,
                            "progress": existing.progress,
                            "status": existing.status,
                        },
                        status=200,
                    )

                mission_completion = MissionCompletion.objects.get(user=user, mission_id=mission_id)

                if mission_completion.status == "completed":
                    return Response(
                        {
                            "error": "Mission already completed.",
                            "xp_awarded": mission_completion.xp_awarded,
                        },
                        status=400,
                    )

                # Server-side XP calculation (never trust client)
                base_xp = mission_completion.mission.points_reward
                xp_multiplier = 1.0

                # Check for first-try bonus
                first_try = request.data.get("first_try", False)
                hints_used = request.data.get("hints_used", 0)
                attempts = request.data.get("attempts", 1)

                if first_try and attempts == 1 and hints_used == 0:
                    mission_completion.first_try_bonus = True
                    xp_multiplier += 0.2  # 20% bonus

                # Check for mastery bonus
                if mission_completion.mission.goal_type == "complete_lesson":
                    # Check if user completed lessons with high mastery
                    mastery_bonus = request.data.get("mastery_bonus", False)
                    if mastery_bonus:
                        mission_completion.mastery_bonus = True
                        xp_multiplier += 0.15  # 15% bonus

                # Apply streak boost if active
                streak_item = StreakItem.objects.filter(
                    user=user, item_type="streak_boost", quantity__gt=0
                ).first()
                if streak_item:
                    xp_multiplier += 0.3  # 30% boost
                    streak_item.quantity -= 1
                    streak_item.save()

                final_xp = int(base_xp * xp_multiplier)

                # Update progress to completion
                mission_completion.progress = 100
                mission_completion.status = "completed"
                mission_completion.completed_at = timezone.now()
                mission_completion.completion_idempotency_key = idempotency_key
                mission_completion.xp_awarded = final_xp

                # Track completion time if provided
                if request.data.get("completion_time_seconds"):
                    mission_completion.completion_time_seconds = request.data.get(
                        "completion_time_seconds"
                    )

                mission_completion.save()

                # Award XP to user profile (server-side only)
                user_profile = user.profile
                user_profile.add_points(final_xp)

                # Track performance
                _track_mission_performance(user, mission_completion, request.data)

                logger.info(
                    "mission_completed",
                    extra={
                        "user_id": user.id,
                        "mission_id": mission_id,
                        "xp_awarded": final_xp,
                        "first_try": mission_completion.first_try_bonus,
                        "mastery_bonus": mission_completion.mastery_bonus,
                    },
                )

                return Response(
                    {
                        "message": "Mission completed successfully.",
                        "xp_awarded": final_xp,
                        "progress": 100,
                        "status": "completed",
                    },
                    status=200,
                )

        except MissionCompletion.DoesNotExist:
            return Response({"error": "Mission not found for this user."}, status=404)
        except Exception as e:
            logger.error(f"Error completing mission for user {user.username}: {str(e)}")
            return Response({"error": "An error occurred while completing mission."}, status=500)


def _track_mission_performance(user, mission_completion, completion_data):
    """Track mission performance metrics for analytics."""
    try:
        mastery_before = {}
        mastery_after = {}

        if mission_completion.mission.goal_type == "complete_lesson":
            # Capture mastery levels before/after
            skills = Mastery.objects.filter(user=user).values("skill", "proficiency")
            mastery_before = {m["skill"]: m["proficiency"] for m in skills}

        MissionPerformance.objects.create(
            user=user,
            mission=mission_completion.mission,
            completion=mission_completion,
            time_to_completion_seconds=completion_data.get("completion_time_seconds"),
            mastery_before=mastery_before,
            mastery_after=mastery_after,
        )
    except Exception as e:
        logger.error(f"Error tracking mission performance: {str(e)}")


class LeaderboardViewSet(APIView):
    """API view to retrieve the top 10 users based on points for the leaderboard."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        """Handle GET requests to fetch the top users for the leaderboard."""
        try:
            # Get time filter parameter
            time_filter = request.query_params.get("time_filter", "all-time")

            # Apply time-based filtering
            if time_filter == "week":
                one_week_ago = timezone.now().date() - timedelta(days=7)
                top_profiles = UserProfile.objects.filter(
                    last_completed_date__gte=one_week_ago
                ).order_by("-points")[:10]
            elif time_filter == "month":
                one_month_ago = timezone.now().date() - timedelta(days=30)
                top_profiles = UserProfile.objects.filter(
                    last_completed_date__gte=one_month_ago
                ).order_by("-points")[:10]
            else:  # all-time
                top_profiles = UserProfile.objects.all().order_by("-points")[:10]

            serializer = LeaderboardSerializer(
                top_profiles, many=True, context={"request": request}
            )
            return Response(serializer.data)
        except Exception as e:
            logger.error(f"Leaderboard error: {str(e)}")
            return Response({"error": str(e)}, status=500)


class UserRankView(APIView):
    """API view to retrieve the current user's rank in the leaderboard."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        """Handle GET requests to fetch the current user's rank."""
        try:
            user_profile = request.user.profile
            higher_ranked_users = UserProfile.objects.filter(points__gt=user_profile.points).count()

            # User's rank is the count of users with more points + 1
            rank = higher_ranked_users + 1

            return Response(
                {
                    "rank": rank,
                    "points": user_profile.points,
                    "user": {
                        "id": request.user.id,
                        "username": request.user.username,
                        "profile_avatar": user_profile.profile_avatar,
                    },
                }
            )
        except Exception as e:
            logger.error(f"User rank error: {str(e)}")
            return Response({"error": str(e)}, status=500)


class BadgeViewSet(viewsets.ReadOnlyModelViewSet):
    """Read-only ViewSet to retrieve active badges available in the system."""

    queryset = Badge.objects.filter(is_active=True)
    serializer_class = BadgeSerializer
    permission_classes = [IsAuthenticated]

    def get_serializer_context(self):
        """Provide additional context for the serializer."""
        return {"request": self.request}


class UserBadgeViewSet(viewsets.ReadOnlyModelViewSet):
    """Read-only ViewSet to retrieve badges earned by the authenticated user."""

    serializer_class = UserBadgeSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        """Retrieve all badges associated with the authenticated user."""
        return UserBadge.objects.filter(user=self.request.user)

    def get_serializer_context(self):
        """Provide additional context for the serializer."""
        return {"request": self.request}


class RecentActivityView(APIView):
    """API view to retrieve the user's recent activities, including completed lessons, quizzes, missions, and courses."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        """Handle GET requests to fetch and return the user's most recent activities."""
        user = request.user
        activities = []

        # Fetch completed lessons and add them to the activity list
        lesson_completions = LessonCompletion.objects.filter(
            user_progress__user=user
        ).select_related("lesson", "user_progress__course")
        for lc in lesson_completions:
            activities.append(
                {
                    "type": "lesson",
                    "action": "completed",
                    "title": lc.lesson.title,
                    "course": lc.user_progress.course.title,
                    "timestamp": lc.completed_at,
                }
            )

        # Fetch completed quizzes and add them to the activity list
        quiz_completions = QuizCompletion.objects.filter(user=user).select_related("quiz")
        for qc in quiz_completions:
            activities.append(
                {
                    "type": "quiz",
                    "action": "completed",
                    "title": qc.quiz.title,
                    "timestamp": qc.completed_at,
                }
            )

        # Fetch completed missions and add them to the activity list
        missions = MissionCompletion.objects.filter(user=user, status="completed").exclude(
            completed_at__isnull=True
        )
        for mc in missions:
            activities.append(
                {
                    "type": "mission",
                    "action": "completed",
                    "name": mc.mission.name,
                    "timestamp": mc.completed_at,
                }
            )

        # Fetch completed courses and add them to the activity list
        course_completions = UserProgress.objects.filter(
            user=user, is_course_complete=True
        ).exclude(course_completed_at__isnull=True)
        for cc in course_completions:
            activities.append(
                {
                    "type": "course",
                    "action": "completed",
                    "title": cc.course.title,
                    "timestamp": cc.course_completed_at,
                }
            )

        # Sort activities by timestamp in descending order and limit to the 5 most recent
        sorted_activities = sorted(activities, key=lambda x: x["timestamp"], reverse=True)[:5]

        return Response({"recent_activities": sorted_activities})


class MissionSwapView(APIView):
    """API view to swap one mission per cycle."""

    permission_classes = [IsAuthenticated]

    def post(self, request):
        """Swap a mission for the user (one swap per cycle)."""
        user = request.user
        mission_id = request.data.get("mission_id")

        if not mission_id:
            return Response({"error": "Mission ID is required."}, status=400)

        try:
            with transaction.atomic():
                # Use filter().first() to handle potential duplicates
                # If duplicates exist, get the most recent one
                mission_completions = MissionCompletion.objects.filter(
                    user=user, mission_id=mission_id
                ).order_by(
                    "-id"
                )  # Get most recent first

                if not mission_completions.exists():
                    return Response({"error": "Mission not found for this user."}, status=404)

                mission_completion = mission_completions.first()

                # If there are duplicates, log and clean them up (keep the most recent)
                if mission_completions.count() > 1:
                    logger.warning(
                        f"Found {mission_completions.count()} duplicate MissionCompletion records for user {user.id}, mission {mission_id}. Keeping most recent."
                    )
                    # Delete older duplicates
                    mission_completions.exclude(id=mission_completion.id).delete()

                # Check if already swapped this cycle
                today = timezone.now().date()
                swapped_today = MissionCompletion.objects.filter(
                    user=user, swapped_at__date=today
                ).exists()

                if swapped_today:
                    return Response({"error": "You can only swap one mission per day."}, status=400)

                if mission_completion.status == "completed":
                    return Response({"error": "Cannot swap a completed mission."}, status=400)

                # Generate a new mastery-aware mission
                new_mission = self._generate_mastery_aware_mission(
                    user, mission_completion.mission.mission_type
                )

                if not new_mission:
                    return Response(
                        {"error": "No suitable replacement mission available."}, status=400
                    )

                # Create new completion
                new_completion = MissionCompletion.objects.create(
                    user=user,
                    mission=new_mission,
                    progress=0,
                    status="not_started",
                    swapped_from_mission=mission_completion,
                )

                # Mark old mission as swapped
                mission_completion.swapped_at = timezone.now()
                mission_completion.status = "not_started"
                mission_completion.progress = 0
                mission_completion.save()

                return Response(
                    {
                        "message": "Mission swapped successfully.",
                        "new_mission": {
                            "id": new_mission.id,
                            "name": new_mission.name,
                            "description": new_mission.description,
                            "points_reward": new_mission.points_reward,
                        },
                    },
                    status=200,
                )

        except MissionCompletion.DoesNotExist:
            return Response({"error": "Mission not found."}, status=404)
        except Exception as e:
            logger.error(f"Error swapping mission: {str(e)}")
            return Response({"error": "An error occurred while swapping mission."}, status=500)

    def _generate_mastery_aware_mission(self, user, mission_type):
        """Generate a mission targeting user's weakest skills."""
        # Get user's weakest skills
        weakest_skills = Mastery.objects.filter(user=user).order_by("proficiency", "due_at")[:3]

        if not weakest_skills.exists():
            # Fallback to any available mission
            return (
                Mission.objects.filter(mission_type=mission_type, is_template=False)
                .exclude(completions__user=user, completions__status="completed")
                .first()
            )

        # Find missions targeting weakest skills
        target_skill = weakest_skills.first().skill

        # Try to find a mission for this skill
        mission = (
            Mission.objects.filter(
                mission_type=mission_type,
                target_weakest_skills=True,
                goal_type="complete_lesson",
                is_template=False,
            )
            .exclude(completions__user=user, completions__status="completed")
            .first()
        )

        if mission:
            # Update goal_reference to target the weak skill
            goal_ref = mission.goal_reference or {}
            goal_ref["target_skill"] = target_skill
            mission.goal_reference = goal_ref
            mission.save()
            return mission

        # Fallback
        return (
            Mission.objects.filter(mission_type=mission_type, is_template=False)
            .exclude(completions__user=user, completions__status="completed")
            .first()
        )


class StreakItemView(APIView):
    """API view to manage streak items (freeze/boost)."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        """Get user's streak items."""
        user = request.user
        items = StreakItem.objects.filter(user=user, quantity__gt=0)

        return Response(
            {
                "items": [
                    {
                        "type": item.item_type,
                        "quantity": item.quantity,
                        "expires_at": item.expires_at.isoformat() if item.expires_at else None,
                    }
                    for item in items
                ]
            }
        )

    def post(self, request):
        """Use a streak item."""
        user = request.user
        item_type = request.data.get("item_type")

        if item_type not in ["streak_freeze", "streak_boost"]:
            return Response({"error": "Invalid item type."}, status=400)

        try:
            with transaction.atomic():
                item = StreakItem.objects.filter(
                    user=user, item_type=item_type, quantity__gt=0
                ).first()

                if not item:
                    return Response({"error": f"No {item_type} items available."}, status=400)

                if item_type == "streak_freeze":
                    # Preserve streak if user missed a day
                    user_profile = user.profile
                    today = timezone.now().date()
                    if (
                        user_profile.last_completed_date
                        and user_profile.last_completed_date < today
                    ):
                        # Streak would be broken, preserve it
                        user_profile.streak = max(1, user_profile.streak)
                        user_profile.last_completed_date = today
                        user_profile.save()

                item.quantity -= 1
                item.save()

                return Response(
                    {"message": f"{item_type} used successfully.", "remaining": item.quantity}
                )

        except Exception as e:
            logger.error(f"Error using streak item: {str(e)}")
            return Response({"error": "An error occurred."}, status=500)


class MissionGenerationView(APIView):
    """API view to generate mastery-aware missions for users."""

    permission_classes = [IsAuthenticated]

    def post(self, request):
        """Generate new missions for the user based on mastery."""
        user = request.user
        mission_type = request.data.get("mission_type", "daily")

        try:
            generated = self._generate_mastery_aware_missions(user, mission_type)

            return Response(
                {
                    "message": f"Generated {len(generated)} missions.",
                    "missions": [
                        {
                            "id": m.id,
                            "name": m.name,
                            "description": m.description,
                        }
                        for m in generated
                    ],
                }
            )

        except Exception as e:
            logger.error(f"Error generating missions: {str(e)}")
            return Response({"error": "An error occurred."}, status=500)

    def _generate_mastery_aware_missions(self, user, mission_type):
        """Generate missions targeting user's weakest skills."""
        # Get weakest skills
        weakest_skills = Mastery.objects.filter(user=user).order_by("proficiency", "due_at")[:5]

        generated = []

        for mastery in weakest_skills:
            # Create or get a mission for this skill
            mission, created = Mission.objects.get_or_create(
                name=f"Master {mastery.skill}",
                mission_type=mission_type,
                defaults={
                    "description": f"Complete lessons focusing on {mastery.skill}",
                    "points_reward": 50,
                    "goal_type": "complete_lesson",
                    "goal_reference": {
                        "required_lessons": 1,
                        "target_skill": mastery.skill,
                    },
                    "target_weakest_skills": True,
                },
            )

            # Create completion if doesn't exist
            completion, _ = MissionCompletion.objects.get_or_create(
                user=user,
                mission=mission,
                defaults={
                    "progress": 0,
                    "status": "not_started",
                },
            )

            if created:
                generated.append(mission)

        return generated


class MissionAnalyticsView(APIView):
    """API view to retrieve mission performance analytics."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        """Get mission performance metrics."""
        user = request.user

        # Get performance data
        performances = MissionPerformance.objects.filter(user=user)

        # Calculate metrics
        avg_completion_time = (
            performances.aggregate(avg_time=Avg("time_to_completion_seconds"))["avg_time"] or 0
        )

        total_completions = performances.count()

        # Skill impact
        skill_improvements = {}
        for perf in performances:
            for skill, improvement in perf.skill_improvements.items():
                skill_improvements[skill] = skill_improvements.get(skill, 0) + improvement

        return Response(
            {
                "total_completions": total_completions,
                "average_completion_time_seconds": int(avg_completion_time),
                "skill_improvements": skill_improvements,
            }
        )

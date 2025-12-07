# gamification/views.py
from rest_framework import viewsets, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView
from rest_framework.response import Response
import logging
from datetime import timedelta
from django.utils import timezone

from gamification.models import Badge, UserBadge, Mission, MissionCompletion
from gamification.serializers import (
    BadgeSerializer, UserBadgeSerializer, MissionCompletionSerializer,
    LeaderboardSerializer
)
from authentication.models import UserProfile
from education.models import LessonCompletion, QuizCompletion, UserProgress

logger = logging.getLogger(__name__)


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
                daily_missions.append({
                    "id": completion.mission.id,
                    "name": completion.mission.name,
                    "description": completion.mission.description,
                    "points_reward": completion.mission.points_reward,
                    "progress": completion.progress,
                    "status": completion.status,
                    "goal_type": completion.mission.goal_type,
                })

            for completion in weekly_completions:
                weekly_missions.append({
                    "id": completion.mission.id,
                    "name": completion.mission.name,
                    "description": completion.mission.description,
                    "points_reward": completion.mission.points_reward,
                    "progress": completion.progress,
                    "status": completion.status,
                    "goal_type": completion.mission.goal_type,
                })

            return Response({
                "daily_missions": daily_missions,
                "weekly_missions": weekly_missions,
            }, status=200)

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
            return Response({
                "message": "Mission progress updated.",
                "progress": mission_completion.progress
            }, status=200)

        except MissionCompletion.DoesNotExist:
            return Response({"error": "Mission not found for this user."}, status=404)
        except Exception as e:
            logger.error(f"Error updating mission progress for user {user.username}: {str(e)}")
            return Response({"error": "An error occurred while updating mission progress."}, status=500)


class LeaderboardViewSet(APIView):
    """API view to retrieve the top 10 users based on points for the leaderboard."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        """Handle GET requests to fetch the top users for the leaderboard."""
        try:
            # Get time filter parameter
            time_filter = request.query_params.get('time_filter', 'all-time')
            
            # Apply time-based filtering
            if time_filter == 'week':
                one_week_ago = timezone.now().date() - timedelta(days=7)
                top_profiles = UserProfile.objects.filter(
                    last_completed_date__gte=one_week_ago
                ).order_by('-points')[:10]
            elif time_filter == 'month':
                one_month_ago = timezone.now().date() - timedelta(days=30)
                top_profiles = UserProfile.objects.filter(
                    last_completed_date__gte=one_month_ago
                ).order_by('-points')[:10]
            else:  # all-time
                top_profiles = UserProfile.objects.all().order_by('-points')[:10]
                
            serializer = LeaderboardSerializer(top_profiles, many=True, context={'request': request})
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
            
            return Response({
                "rank": rank,
                "points": user_profile.points,
                "user": {
                    "id": request.user.id,
                    "username": request.user.username,
                    "profile_avatar": user_profile.profile_avatar
                }
            })
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
        return {'request': self.request}


class UserBadgeViewSet(viewsets.ReadOnlyModelViewSet):
    """Read-only ViewSet to retrieve badges earned by the authenticated user."""

    serializer_class = UserBadgeSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        """Retrieve all badges associated with the authenticated user."""
        return UserBadge.objects.filter(user=self.request.user)

    def get_serializer_context(self):
        """Provide additional context for the serializer."""
        return {'request': self.request}


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
        ).select_related('lesson', 'user_progress__course')
        for lc in lesson_completions:
            activities.append({
                "type": "lesson",
                "action": "completed",
                "title": lc.lesson.title,
                "course": lc.user_progress.course.title,
                "timestamp": lc.completed_at
            })

        # Fetch completed quizzes and add them to the activity list
        quiz_completions = QuizCompletion.objects.filter(user=user).select_related('quiz')
        for qc in quiz_completions:
            activities.append({
                "type": "quiz",
                "action": "completed",
                "title": qc.quiz.title,
                "timestamp": qc.completed_at
            })

        # Fetch completed missions and add them to the activity list
        missions = MissionCompletion.objects.filter(
            user=user,
            status='completed'
        ).exclude(completed_at__isnull=True)
        for mc in missions:
            activities.append({
                "type": "mission",
                "action": "completed",
                "name": mc.mission.name,
                "timestamp": mc.completed_at
            })

        # Fetch completed courses and add them to the activity list
        course_completions = UserProgress.objects.filter(
            user=user,
            is_course_complete=True
        ).exclude(course_completed_at__isnull=True)
        for cc in course_completions:
            activities.append({
                "type": "course",
                "action": "completed",
                "title": cc.course.title,
                "timestamp": cc.course_completed_at
            })

        # Sort activities by timestamp in descending order and limit to the 5 most recent
        sorted_activities = sorted(
            activities,
            key=lambda x: x["timestamp"],
            reverse=True
        )[:5]

        return Response({"recent_activities": sorted_activities})


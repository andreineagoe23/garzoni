# gamification/views.py
from rest_framework import viewsets, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.decorators import action
from rest_framework.throttling import UserRateThrottle
import logging
import random
from datetime import timedelta
from django.utils import timezone
from django.db import transaction
from django.db.models import Avg, Q, Sum
from django.core.cache import cache
import json

from authentication.user_display import user_display_dict
from core.utils import normalize_text_encoding
from gamification.models import (
    Badge,
    UserBadge,
    Mission,
    MissionCompletion,
    StreakItem,
    MissionPerformance,
    RewardLedgerEntry,
)
from gamification.serializers import (
    BadgeSerializer,
    UserBadgeSerializer,
    MissionCompletionSerializer,
    LeaderboardSerializer,
)
from authentication.models import UserProfile

from gamification.services.ledger_labels import describe_ledger_event
from gamification.services.mission_cycles import (
    daily_cycle_id,
    ensure_current_cycle_mission_completions,
    get_or_create_current_mission_completion,
    weekly_cycle_id,
    cycle_id_for_mission,
)
from gamification.services.missions import (
    complete_mission as complete_mission_service,
    swap_mission as swap_mission_service,
)
from education.models import (
    LessonCompletion,
    QuizCompletion,
    UserProgress,
    Mastery,
    Exercise,
)

logger = logging.getLogger(__name__)

# How many missions to show per section (randomized from pool each day/week)
MISSIONS_DAILY_DISPLAY = 4
MISSIONS_WEEKLY_DISPLAY = 4


def _deterministic_shuffle(items, seed_str):
    """Shuffle list in place using a deterministic seed. Returns the same order for same seed_str."""
    rng = random.Random(hash(seed_str) % (2**32))
    rng.shuffle(items)
    return items


class MissionCompletionThrottle(UserRateThrottle):
    """Rate limit mission completions to prevent abuse."""

    rate = "10/minute"


class MissionView(APIView):
    """API view to retrieve and update user missions, including daily and weekly missions."""

    permission_classes = [IsAuthenticated]

    @staticmethod
    def _load_visible_completions(user, mission_type: str, current_cycle_id: str):
        return list(
            MissionCompletion.objects.filter(user=user, mission__mission_type=mission_type)
            .filter(Q(cycle_id=current_cycle_id) | Q(cycle_id=""))
            .exclude(cycle_id__startswith="x")
            .select_related("mission")
        )

    def get(self, request):
        """Handle GET requests to fetch the user's daily and weekly missions.
        Returns up to 4 daily and 4 weekly, chosen by deterministic shuffle per day/week.
        """
        user = request.user
        try:
            d_id = daily_cycle_id()
            w_id = weekly_cycle_id()
            daily_completions = self._load_visible_completions(user, "daily", d_id)
            weekly_completions = self._load_visible_completions(user, "weekly", w_id)

            # Self-heal users with stale/empty cycle rows by opening fresh rows
            # from the live mission pool for the current daily/weekly period.
            daily_has_current = any(c.cycle_id == d_id for c in daily_completions)
            weekly_has_current = any(c.cycle_id == w_id for c in weekly_completions)
            daily_current_ids = {c.mission_id for c in daily_completions if c.cycle_id == d_id}
            weekly_current_ids = {
                c.mission_id for c in weekly_completions if c.cycle_id == w_id
            }
            daily_pool_count = Mission.objects.filter(mission_type="daily").count()
            weekly_pool_count = Mission.objects.filter(mission_type="weekly").count()
            if (
                not daily_completions
                or not daily_has_current
                or len(daily_current_ids) < daily_pool_count
            ):
                ensure_current_cycle_mission_completions(user, "daily")
                daily_completions = self._load_visible_completions(user, "daily", d_id)
            if (
                not weekly_completions
                or not weekly_has_current
                or len(weekly_current_ids) < weekly_pool_count
            ):
                ensure_current_cycle_mission_completions(user, "weekly")
                weekly_completions = self._load_visible_completions(user, "weekly", w_id)

            def _build_payload(completion):
                return {
                    "id": completion.mission.id,
                    "name": normalize_text_encoding(completion.mission.name),
                    "description": normalize_text_encoding(completion.mission.description),
                    "points_reward": completion.mission.points_reward,
                    "progress": completion.progress,
                    "status": completion.status,
                    "goal_type": completion.mission.goal_type,
                    "goal_reference": completion.mission.goal_reference or {},
                    "purpose_statement": normalize_text_encoding(
                        completion.mission.purpose_statement or ""
                    ),
                }

            def _pick_best(completions, current_cid):
                best = {}
                for c in completions:
                    mid = c.mission_id
                    prev = best.get(mid)

                    def score(obj):
                        s = obj.progress
                        if obj.cycle_id == current_cid:
                            s += 1000
                        return s

                    if prev is None or score(c) > score(prev):
                        best[mid] = c
                return best

            daily_missions = [
                _build_payload(c) for c in _pick_best(daily_completions, d_id).values()
            ]
            weekly_missions = [
                _build_payload(c) for c in _pick_best(weekly_completions, w_id).values()
            ]

            now = timezone.now()
            local_today = timezone.localdate()
            today_str = local_today.isoformat()
            # Week start (Monday)
            week_start = local_today - timedelta(days=local_today.weekday())
            week_str = week_start.isoformat()

            seed_daily = f"{user.id}-daily-{today_str}"
            seed_weekly = f"{user.id}-weekly-{week_str}"
            _deterministic_shuffle(daily_missions, seed_daily)
            _deterministic_shuffle(weekly_missions, seed_weekly)
            can_swap = not MissionCompletion.objects.filter(
                user=user, swapped_at__date=local_today
            ).exists()

            return Response(
                {
                    "daily_missions": daily_missions[:MISSIONS_DAILY_DISPLAY],
                    "weekly_missions": weekly_missions[:MISSIONS_WEEKLY_DISPLAY],
                    "can_swap": can_swap,
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
            mission = Mission.objects.get(pk=mission_id)
            mission_completion, _ = get_or_create_current_mission_completion(
                user,
                mission,
                defaults={"progress": 0, "status": "not_started"},
            )
            increment = request.data.get("progress", 0)

            if not isinstance(increment, (int, float)):
                return Response({"error": "Progress must be a number."}, status=400)

            mission_completion.update_progress(increment)
            return Response(
                {
                    "message": "Mission progress updated.",
                    "progress": mission_completion.progress,
                },
                status=200,
            )

        except Mission.DoesNotExist:
            return Response({"error": "Mission not found."}, status=404)
        except Exception as e:
            logger.error(f"Error updating mission progress for user {user.username}: {str(e)}")
            return Response(
                {"error": "An error occurred while updating mission progress."},
                status=500,
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

        try:
            payload, code = complete_mission_service(
                user=user,
                mission_id=mission_id,
                idempotency_key=idempotency_key,
                completion_data=request.data,
            )
            return Response(payload, status=code)

        except Mission.DoesNotExist:
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
                        **user_display_dict(request.user, include_id=True),
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

        for entry in RewardLedgerEntry.objects.filter(user=user).order_by("-created_at")[:40]:
            desc = describe_ledger_event(entry.event_key, entry.points, entry.coins)
            activities.append(
                {
                    "type": desc["type"],
                    "action": desc["action"],
                    "title": desc["title"],
                    "label_key": desc["label_key"],
                    "name": desc["title"],
                    "timestamp": entry.created_at,
                    "points": desc["points"],
                    "coins": desc["coins"],
                }
            )

        lesson_completions = (
            LessonCompletion.objects.filter(user_progress__user=user)
            .select_related("lesson", "user_progress__course")
            .order_by("-completed_at")[:15]
        )
        for lc in lesson_completions:
            activities.append(
                {
                    "type": "lesson",
                    "action": "completed",
                    "title": lc.lesson.title,
                    "course": lc.user_progress.course.title,
                    "lesson_id": lc.lesson_id,
                    "course_id": lc.user_progress.course_id,
                    "timestamp": lc.completed_at,
                }
            )

        quiz_completions = QuizCompletion.objects.filter(user=user).select_related("quiz")
        for qc in quiz_completions.order_by("-completed_at")[:10]:
            activities.append(
                {
                    "type": "quiz",
                    "action": "completed",
                    "title": qc.quiz.title,
                    "timestamp": qc.completed_at,
                }
            )

        missions = (
            MissionCompletion.objects.filter(user=user, status="completed")
            .exclude(completed_at__isnull=True)
            .order_by("-completed_at")[:10]
        )
        for mc in missions:
            activities.append(
                {
                    "type": "mission",
                    "action": "completed",
                    "name": normalize_text_encoding(mc.mission.name),
                    "title": normalize_text_encoding(mc.mission.name),
                    "timestamp": mc.completed_at,
                }
            )

        course_completions = (
            UserProgress.objects.filter(user=user, is_course_complete=True)
            .exclude(course_completed_at__isnull=True)
            .order_by("-course_completed_at")[:10]
        )
        for cc in course_completions:
            activities.append(
                {
                    "type": "course",
                    "action": "completed",
                    "title": cc.course.title,
                    "timestamp": cc.course_completed_at,
                }
            )

        sorted_activities = sorted(activities, key=lambda x: x["timestamp"], reverse=True)[:10]

        return Response({"recent_activities": sorted_activities})


class RewardLedgerFeedView(APIView):
    """Paginated reward ledger entries with stable label keys for clients."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            limit = max(1, min(int(request.query_params.get("limit", 30)), 100))
            offset = max(0, int(request.query_params.get("offset", 0)))
        except (TypeError, ValueError):
            limit, offset = 30, 0

        qs = RewardLedgerEntry.objects.filter(user=request.user).order_by("-created_at")[
            offset : offset + limit
        ]
        results = []
        for entry in qs:
            desc = describe_ledger_event(entry.event_key, entry.points, entry.coins)
            results.append(
                {
                    "id": entry.id,
                    "created_at": entry.created_at,
                    "event_key": entry.event_key,
                    **desc,
                }
            )
        return Response({"count": len(results), "offset": offset, "results": results})


class WeeklyRecapView(APIView):
    """ISO-week recap (missions + ledger XP + streak) — gated by GAMIFICATION_RETENTION_V2."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        from django.conf import settings as dj_settings

        if not getattr(dj_settings, "GAMIFICATION_RETENTION_V2", False):
            return Response({"enabled": False, "recap": None})

        user = request.user
        profile = user.profile
        today = timezone.localdate()
        week_start = today - timedelta(days=today.weekday())

        xp_sum = (
            RewardLedgerEntry.objects.filter(
                user=user,
                created_at__date__gte=week_start,
                created_at__date__lte=today,
            ).aggregate(total=Sum("points"))["total"]
            or 0
        )

        missions_done = MissionCompletion.objects.filter(
            user=user,
            status="completed",
            completed_at__date__gte=week_start,
            completed_at__date__lte=today,
        ).count()

        return Response(
            {
                "enabled": True,
                "recap": {
                    "week_start": week_start.isoformat(),
                    "week_end": today.isoformat(),
                    "xp_earned": int(xp_sum),
                    "missions_completed": missions_done,
                    "streak_days": int(profile.streak or 0),
                },
            }
        )


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
            payload, code = swap_mission_service(user=user, mission_id=mission_id)
            if "new_mission" in payload:
                nm = payload["new_mission"] or {}
                payload["new_mission"] = {
                    **nm,
                    "name": normalize_text_encoding(nm.get("name")),
                    "description": normalize_text_encoding(nm.get("description")),
                }
            return Response(payload, status=code)

        except Mission.DoesNotExist:
            return Response({"error": "Mission not found."}, status=404)
        except Exception as e:
            logger.error(f"Error swapping mission: {str(e)}")
            return Response({"error": "An error occurred while swapping mission."}, status=500)


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
                        "expires_at": (item.expires_at.isoformat() if item.expires_at else None),
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
                    used = user.profile.apply_manual_streak_freezes(max_uses=1)
                    if not used:
                        return Response(
                            {"error": "No streak gap to repair, or no freezes available."},
                            status=400,
                        )
                    item.refresh_from_db(fields=["quantity"])
                    return Response(
                        {
                            "message": f"{item_type} used successfully.",
                            "remaining": item.quantity,
                        }
                    )

                item.quantity -= 1
                item.save(update_fields=["quantity"])

                return Response(
                    {
                        "message": f"{item_type} used successfully.",
                        "remaining": item.quantity,
                    }
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
                            "name": normalize_text_encoding(m.name),
                            "description": normalize_text_encoding(m.description),
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

            get_or_create_current_mission_completion(
                user,
                mission,
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

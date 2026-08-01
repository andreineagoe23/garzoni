# gamification/views.py
from decimal import Decimal

from rest_framework import viewsets, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.decorators import action
from rest_framework.throttling import UserRateThrottle
import logging
import random
from datetime import timedelta
from django.conf import settings as dj_settings
from django.utils import timezone
from django.db import connection, transaction
from django.db.models import Avg, F, Q, Sum
from django.core.cache import cache
import json

from authentication.user_display import user_display_dict
from core.utils import normalize_text_encoding
from gamification.models import (
    Badge,
    UserBadge,
    Mission,
    MissionCompletion,
    MultiStepMission,
    MultiStepMissionProgress,
    StreakItem,
    StreakWager,
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
from gamification.services.leaderboards import (
    rank_in_window,
    weekly_xp_leaderboard,
    xp_in_window,
)
from gamification.services.mission_cycles import (
    _stable_seed,
    daily_cycle_id,
    ensure_current_cycle_mission_completions,
    get_or_create_current_mission_completion,
    select_cycle_missions,
    weekly_cycle_id,
    cycle_id_for_mission,
)
from gamification.services.missions import (
    complete_mission as complete_mission_service,
    swap_mission as swap_mission_service,
)
from gamification.services.wagers import (
    DEFAULT_TARGET_DAYS,
    MIN_STAKE_POINTS,
    STAKE_POINTS_BY_TARGET_DAYS,
    WagerError,
    cancel_wager,
    compute_stake,
    open_wager,
    stake_reward_table,
)
from gamification.services.leagues import current_standings, league_history
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
    """Shuffle list in place using a deterministic seed. Returns the same order
    for same seed_str across processes (builtin hash is per-process random)."""
    rng = random.Random(_stable_seed(seed_str))
    rng.shuffle(items)
    return items


def _diverse_pick(missions, n):
    """Pick n missions prioritising goal_type diversity. One per type first, then backfill."""
    first_pass = []
    second_pass = []
    seen_types = set()
    for m in missions:
        gt = m["goal_type"]
        if gt not in seen_types:
            seen_types.add(gt)
            first_pass.append(m)
        else:
            second_pass.append(m)
    result = first_pass[:n]
    if len(result) < n:
        result += second_pass[: n - len(result)]
    return result


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
            local_today = timezone.localdate()
            lazy = getattr(dj_settings, "MISSIONS_LAZY_ASSIGNMENT", False)

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

            def _synthetic_payload(entry):
                return {
                    "id": entry["id"],
                    "name": normalize_text_encoding(entry["name"]),
                    "description": normalize_text_encoding(entry["description"]),
                    "points_reward": entry["points_reward"],
                    "progress": 0,
                    "status": "not_started",
                    "goal_type": entry["goal_type"],
                    "goal_reference": entry["goal_reference"] or {},
                    "purpose_statement": normalize_text_encoding(entry["purpose_statement"] or ""),
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

            def _lazy_display(mission_type, cid, count):
                """Read-only display assembly: materialized rows the user has
                touched (progress, swap-ins, completions) take precedence,
                deterministic picks fill remaining slots as synthetics."""
                best = _pick_best(self._load_visible_completions(user, mission_type, cid), cid)
                swapped_out = {c.mission_id for c in best.values() if c.swapped_at is not None}
                sticky = [
                    c
                    for c in best.values()
                    if c.swapped_at is None
                    and (c.swapped_from_mission_id or c.status != "not_started" or c.progress > 0)
                ]
                sticky.sort(key=lambda c: (c.status == "completed", c.progress), reverse=True)
                display = [_build_payload(c) for c in sticky[:count]]
                shown = {p["id"] for p in display}
                picks = select_cycle_missions(
                    user.id,
                    mission_type,
                    cid,
                    count=count,
                    exclude_ids=swapped_out | shown,
                )
                for entry in picks:
                    if len(display) >= count:
                        break
                    row = best.get(entry["id"])
                    display.append(_build_payload(row) if row else _synthetic_payload(entry))
                return _deterministic_shuffle(display, f"{user.id}-{mission_type}-{cid}")

            if lazy:
                daily_display = _lazy_display("daily", d_id, MISSIONS_DAILY_DISPLAY)
                weekly_display = _lazy_display("weekly", w_id, MISSIONS_WEEKLY_DISPLAY)
            else:
                daily_completions = self._load_visible_completions(user, "daily", d_id)
                weekly_completions = self._load_visible_completions(user, "weekly", w_id)

                # Self-heal users with stale/empty cycle rows by opening fresh
                # rows from the live mission pool for the current period.
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

                daily_missions = [
                    _build_payload(c) for c in _pick_best(daily_completions, d_id).values()
                ]
                weekly_missions = [
                    _build_payload(c) for c in _pick_best(weekly_completions, w_id).values()
                ]

                week_start = local_today - timedelta(days=local_today.weekday())
                _deterministic_shuffle(daily_missions, f"{user.id}-daily-{local_today.isoformat()}")
                _deterministic_shuffle(
                    weekly_missions, f"{user.id}-weekly-{week_start.isoformat()}"
                )
                daily_display = _diverse_pick(daily_missions, MISSIONS_DAILY_DISPLAY)
                weekly_display = _diverse_pick(weekly_missions, MISSIONS_WEEKLY_DISPLAY)

            can_swap = not MissionCompletion.objects.filter(
                user=user, swapped_at__date=local_today
            ).exists()

            # Read-only: progress rows are created lazily by the signal
            # handlers when a step actually advances; missing rows render as
            # not-started synthetics instead of get_or_create on every GET.
            active_multistep = list(MultiStepMission.objects.filter(is_active=True).order_by("id"))
            progress_by_mission = {
                p.mission_id: p
                for p in MultiStepMissionProgress.objects.filter(
                    user=user, mission__in=active_multistep
                )
            }
            multi_step_missions = []
            for mission in active_multistep:
                progress = progress_by_mission.get(mission.id)
                completed_steps = list(progress.completed_steps or []) if progress else []
                completed = set(completed_steps)
                steps = []
                for step in mission.steps or []:
                    step_id = step.get("id")
                    steps.append({**step, "completed": bool(step_id and step_id in completed)})
                multi_step_missions.append(
                    {
                        "id": mission.id,
                        "slug": mission.slug,
                        "name": mission.name,
                        "description": mission.description,
                        "points_reward": mission.points_reward,
                        "badge_name": mission.badge_name,
                        "status": progress.status if progress else "not_started",
                        "completed_steps": completed_steps,
                        "steps": steps,
                    }
                )

            return Response(
                {
                    "daily_missions": daily_display,
                    "weekly_missions": weekly_display,
                    "multi_step_missions": multi_step_missions,
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
            skill = (request.query_params.get("skill") or "").strip()

            if skill:
                rows = (
                    Mastery.objects.filter(legacy=False, course__isnull=False)
                    .filter(Q(skill__iexact=skill) | Q(course__title__iexact=skill))
                    .select_related("user", "user__profile")
                    .order_by("-proficiency", "user_id")[:10]
                )
                payload = []
                for rank, mastery in enumerate(rows, start=1):
                    profile = getattr(mastery.user, "profile", None)
                    payload.append(
                        {
                            "rank": rank,
                            "points": mastery.proficiency,
                            "skill": mastery.skill,
                            "user": {
                                **user_display_dict(mastery.user, include_id=True),
                                "profile_avatar": getattr(profile, "profile_avatar", None),
                            },
                        }
                    )
                return Response(payload)

            # Apply time-based filtering. "week"/"month" are windowed XP from
            # the reward ledger (see gamification.services.leaderboards);
            # anything else falls back to the original all-time behaviour,
            # ordered by lifetime UserProfile.points.
            if time_filter in ("week", "month"):
                rows = weekly_xp_leaderboard(time_filter, limit=10)
                top_profiles = []
                for row in rows:
                    profile = row.profile
                    profile.xp_window = row.xp
                    top_profiles.append(profile)
            else:  # all-time
                top_profiles = list(
                    UserProfile.objects.select_related("user").order_by("-points")[:10]
                )
                for profile in top_profiles:
                    profile.xp_window = profile.points

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
            time_filter = request.query_params.get("time_filter", "all-time")
            user_profile = request.user.profile

            if time_filter in ("week", "month"):
                # Windowed XP rank from the reward ledger.
                xp_window = xp_in_window(request.user, time_filter)
                rank = rank_in_window(request.user, time_filter)
            else:  # all-time -- identical behaviour, just a 60s per-user cache
                cache_key = (
                    f"user_rank_alltime:v1:{connection.settings_dict.get('NAME', 'default')}"
                    f":{request.user.id}"
                )
                rank = cache.get(cache_key)
                if rank is None:
                    higher_ranked_users = UserProfile.objects.filter(
                        points__gt=user_profile.points
                    ).count()
                    # User's rank is the count of users with more points + 1
                    rank = higher_ranked_users + 1
                    cache.set(cache_key, rank, 60)
                xp_window = user_profile.points

            return Response(
                {
                    "rank": rank,
                    "points": user_profile.points,
                    "xp_window": xp_window,
                    "user": {
                        **user_display_dict(request.user, include_id=True),
                        "profile_avatar": user_profile.profile_avatar,
                    },
                }
            )
        except Exception as e:
            logger.error(f"User rank error: {str(e)}")
            return Response({"error": str(e)}, status=500)


class AsyncDuelView(APIView):
    """Lean async duel launcher/completer backed by exercises and reward ledger."""

    permission_classes = [IsAuthenticated]

    def post(self, request):
        opponent_id = request.data.get("opponent_id")
        score = request.data.get("score")
        try:
            opponent_profile = UserProfile.objects.select_related("user").get(user_id=opponent_id)
        except (TypeError, ValueError, UserProfile.DoesNotExist):
            return Response({"error": "Opponent not found"}, status=404)

        if score is not None:
            try:
                score_value = int(score)
                target_score = int(request.data.get("target_score", 80))
            except (TypeError, ValueError):
                return Response({"error": "Invalid score"}, status=400)
            won = score_value >= target_score
            granted = False
            if won:
                event_key = (
                    f"async_duel:{request.user.id}:{opponent_profile.user_id}:"
                    f"{timezone.localdate().isoformat()}:{target_score}"
                )
                _, granted = RewardLedgerEntry.objects.get_or_create(
                    user=request.user,
                    event_key=event_key[:220],
                    defaults={"points": 15, "coins": Decimal("1.00")},
                )
            return Response(
                {
                    "won": won,
                    "granted": granted,
                    "points_awarded": 15 if won and granted else 0,
                    "target_score": target_score,
                }
            )

        weak_mastery = (
            Mastery.objects.filter(user=request.user, legacy=False)
            .order_by("proficiency", "due_at")
            .first()
        )
        exercise_qs = Exercise.objects.all()
        if weak_mastery:
            exercise_qs = exercise_qs.filter(category__iexact=weak_mastery.skill)
        exercise = exercise_qs.order_by("?").first() or Exercise.objects.order_by("?").first()
        if not exercise:
            return Response({"error": "No exercises available"}, status=404)

        return Response(
            {
                "opponent": user_display_dict(opponent_profile.user, include_id=True),
                "exercise_id": exercise.id,
                "target_score": 80,
                "bonus_points": 15,
                "completion_endpoint": "/api/leaderboard/duel/",
                "action_route": f"/exercises?duel=1&exerciseId={exercise.id}&opponentId={opponent_profile.user_id}",
            }
        )


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
                    "course_id": qc.quiz.course_id,
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
                    "course_id": cc.course_id,
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
        """Use a streak item. For streak_freeze, falls back to coin purchase if inventory empty."""
        user = request.user
        item_type = request.data.get("item_type")

        if item_type not in ["streak_freeze", "streak_boost"]:
            return Response({"error": "Invalid item type."}, status=400)

        try:
            if item_type == "streak_freeze":
                return self._use_streak_freeze(user)

            with transaction.atomic():
                item = StreakItem.objects.filter(
                    user=user, item_type=item_type, quantity__gt=0
                ).first()
                if not item:
                    return Response({"error": f"No {item_type} items available."}, status=400)
                item.quantity -= 1
                item.save(update_fields=["quantity"])
                return Response(
                    {"message": f"{item_type} used successfully.", "remaining": item.quantity}
                )

        except Exception as e:
            logger.error(f"Error using streak item: {str(e)}")
            return Response({"error": "An error occurred."}, status=500)

    def _use_streak_freeze(self, user):
        """Apply streak freeze from inventory; if empty, spend FREEZE_COIN_COST coins to buy one."""
        FREEZE_COIN_COST = Decimal("10")

        class _NoGapError(Exception):
            pass

        now = timezone.now()
        has_inventory = (
            StreakItem.objects.filter(
                user=user,
                item_type="streak_freeze",
                quantity__gt=0,
            )
            .filter(Q(expires_at__isnull=True) | Q(expires_at__gt=now))
            .exists()
        )

        profile = user.profile
        has_coins = Decimal(str(profile.earned_money or 0)) >= FREEZE_COIN_COST

        if not has_inventory and not has_coins:
            return Response({"error": "no_freezes_or_coins"}, status=402)

        method = "inventory" if has_inventory else "coins"
        response_data: dict = {}

        try:
            with transaction.atomic():
                locked_profile = UserProfile.objects.select_for_update().get(pk=profile.pk)

                if method == "coins":
                    if Decimal(str(locked_profile.earned_money or 0)) < FREEZE_COIN_COST:
                        return Response({"error": "no_freezes_or_coins"}, status=402)
                    UserProfile.objects.filter(pk=locked_profile.pk).update(
                        earned_money=F("earned_money") - FREEZE_COIN_COST
                    )
                    item_obj, _ = StreakItem.objects.get_or_create(
                        user=user, item_type="streak_freeze", defaults={"quantity": 0}
                    )
                    StreakItem.objects.filter(pk=item_obj.pk).update(quantity=F("quantity") + 1)

                locked_profile.refresh_from_db()
                used = locked_profile.apply_manual_streak_freezes(max_uses=1)
                if not used:
                    raise _NoGapError()

                freeze_item = StreakItem.objects.filter(
                    user=user, item_type="streak_freeze"
                ).first()
                locked_profile.refresh_from_db(fields=["earned_money", "streak"])
                response_data = {
                    "message": "Streak freeze applied.",
                    "method": method,
                    "remaining": freeze_item.quantity if freeze_item else 0,
                    "remaining_coins": float(locked_profile.earned_money or 0),
                    "streak": int(locked_profile.streak or 0),
                }

        except _NoGapError:
            return Response({"error": "No streak gap to repair."}, status=400)

        return Response(response_data)


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


def _serialize_wager(wager: StreakWager) -> dict:
    return {
        "id": wager.id,
        "stake_points": wager.stake_points,
        "reward_points": wager.reward_points,
        "reward_coins": str(wager.reward_coins),
        "target_days": wager.target_days,
        "streak_at_start": wager.streak_at_start,
        "started_on": wager.started_on.isoformat(),
        "deadline_on": wager.deadline_on.isoformat(),
        "status": wager.status,
        "resolved_at": wager.resolved_at.isoformat() if wager.resolved_at else None,
        "can_cancel": (
            wager.status == StreakWager.STATUS_ACTIVE and wager.started_on == timezone.localdate()
        ),
    }


class StreakWagerView(APIView):
    """Commitment device: stake XP that you'll keep your streak alive."""

    permission_classes = [IsAuthenticated]
    throttle_classes = [UserRateThrottle]

    def get(self, request):
        user = request.user
        profile = user.profile

        active = (
            StreakWager.objects.filter(user=user, status=StreakWager.STATUS_ACTIVE)
            .order_by("-created_at")
            .first()
        )
        history = list(
            StreakWager.objects.filter(user=user)
            .exclude(status=StreakWager.STATUS_ACTIVE)
            .order_by("-created_at")[:20]
        )

        eligible = active is None and int(profile.streak or 0) >= 1
        ineligible_reason = None
        if active is not None:
            ineligible_reason = "active_exists"
        elif int(profile.streak or 0) < 1:
            ineligible_reason = "streak_too_low"
        elif compute_stake(profile.points, DEFAULT_TARGET_DAYS) < MIN_STAKE_POINTS:
            eligible = False
            ineligible_reason = "insufficient_points"

        return Response(
            {
                "active": _serialize_wager(active) if active else None,
                "history": [_serialize_wager(w) for w in history],
                "eligible": eligible,
                "ineligible_reason": ineligible_reason,
                "current_points": int(profile.points or 0),
                "current_streak": int(profile.streak or 0),
                "stake_reward_table": stake_reward_table(),
            }
        )

    def post(self, request):
        try:
            target_days = int(request.data.get("target_days", DEFAULT_TARGET_DAYS))
        except (TypeError, ValueError):
            return Response(
                {"error": "target_days must be an integer.", "code": "invalid_target_days"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if target_days not in STAKE_POINTS_BY_TARGET_DAYS:
            return Response(
                {
                    "error": "Unsupported target_days.",
                    "code": "invalid_target_days",
                    "allowed": sorted(STAKE_POINTS_BY_TARGET_DAYS.keys()),
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            wager = open_wager(request.user, target_days=target_days)
        except WagerError as exc:
            return Response(
                {"error": str(exc), "code": exc.code},
                status=status.HTTP_400_BAD_REQUEST,
            )

        return Response(_serialize_wager(wager), status=status.HTTP_201_CREATED)


class StreakWagerCancelView(APIView):
    permission_classes = [IsAuthenticated]
    throttle_classes = [UserRateThrottle]

    def post(self, request, wager_id: int):
        try:
            wager = cancel_wager(request.user, wager_id)
        except WagerError as exc:
            return Response(
                {"error": str(exc), "code": exc.code},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return Response(_serialize_wager(wager))


class LeagueCurrentView(APIView):
    """The caller's current weekly league cohort, ordered standings, and own rank.

    Returns a 200 with an explanatory payload (never a 500) when leagues are
    disabled or the user hasn't been lazily assigned into a cohort yet —
    "not assigned" happens for anyone who hasn't earned XP this week, which
    is expected and not an error state.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            standings = current_standings(request.user)
        except Exception:
            logger.exception(
                "LeagueCurrentView: current_standings failed", extra={"user_id": request.user.id}
            )
            return Response({"enabled": True, "assigned": False, "error": "unavailable"})

        if not standings.enabled:
            return Response({"enabled": False})

        if not standings.assigned:
            return Response({"enabled": True, "assigned": False, "cycle_id": standings.cycle_id})

        return Response(
            {
                "enabled": True,
                "assigned": True,
                "tier": standings.tier,
                "cycle_id": standings.cycle_id,
                "league_id": standings.league_id,
                "own_rank": standings.own_rank,
                "standings": [
                    {
                        "user_id": row.user_id,
                        "username": row.username,
                        "weekly_xp": row.weekly_xp,
                        "rank": row.rank,
                        "is_self": row.is_self,
                    }
                    for row in standings.members
                ],
            }
        )


class LeagueHistoryView(APIView):
    """Past league memberships for the caller, most recent cycle first."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        if not getattr(dj_settings, "LEAGUES_ENABLED", False):
            return Response({"enabled": False, "history": []})

        try:
            history = league_history(request.user)
        except Exception:
            logger.exception(
                "LeagueHistoryView: league_history failed", extra={"user_id": request.user.id}
            )
            return Response({"enabled": True, "history": [], "error": "unavailable"})

        return Response({"enabled": True, "history": history})

from datetime import date, datetime

from django.conf import settings
from django.core.cache import cache
from django.db import models
from django.db.models import Sum
from django.utils import timezone

from authentication.user_display import user_display_dict
from authentication.models import UserProfile, FriendRequest
from education.models import DailyActivityLog, LessonCompletion, Mastery
from gamification.models import Duel, MissionCompletion, RewardLedgerEntry, UserBadge
from onboarding.models import QuestionnaireProgress


def _completion_day_key(value) -> str | None:
    """Normalize ORM __date values so they match calendar dict keys (YYYY-MM-DD)."""
    if value is None:
        return None
    if isinstance(value, datetime):
        return value.date().isoformat()
    if isinstance(value, date):
        return value.isoformat()
    s = str(value).strip()
    if len(s) >= 10 and s[4] == "-" and s[7] == "-":
        return s[:10]
    return s or None


def build_activity_calendar(user, first_day, last_day):
    # Initialise every date in range to 0
    activity_calendar = {
        str(first_day + timezone.timedelta(days=x)): 0
        for x in range((last_day - first_day).days + 1)
    }

    for row in (
        DailyActivityLog.objects.filter(user=user, date__gte=first_day, date__lte=last_day)
        .values("date")
        .annotate(count=models.Count("id"))
    ):
        d = _completion_day_key(row.get("date"))
        if d:
            activity_calendar[d] = activity_calendar.get(d, 0) + row["count"]

    return activity_calendar


def build_activity_calendar_by_type(user, first_day, last_day):
    """
    Per-date counts by activity kind (lessons, sections, exercises, quizzes).
    Keys are ISO date strings; values sum to the same totals as build_activity_calendar per day.
    """
    empty_day = {"lessons": 0, "sections": 0, "exercises": 0, "quizzes": 0}
    by_type = {
        str(first_day + timezone.timedelta(days=x)): dict(empty_day)
        for x in range((last_day - first_day).days + 1)
    }

    def _add(kind, row):
        d = _completion_day_key(row.get("date"))
        if not d or d not in by_type:
            return
        by_type[d][kind] = by_type[d][kind] + row["count"]

    for row in (
        DailyActivityLog.objects.filter(
            user=user,
            activity_type="lesson",
            date__gte=first_day,
            date__lte=last_day,
        )
        .values("date")
        .annotate(count=models.Count("id"))
    ):
        _add("lessons", row)

    for row in (
        DailyActivityLog.objects.filter(
            user=user,
            activity_type="section",
            date__gte=first_day,
            date__lte=last_day,
        )
        .values("date")
        .annotate(count=models.Count("id"))
    ):
        _add("sections", row)

    for row in (
        DailyActivityLog.objects.filter(
            user=user,
            activity_type="exercise",
            date__gte=first_day,
            date__lte=last_day,
        )
        .values("date")
        .annotate(count=models.Count("id"))
    ):
        _add("exercises", row)

    for row in (
        DailyActivityLog.objects.filter(
            user=user,
            activity_type="quiz",
            date__gte=first_day,
            date__lte=last_day,
        )
        .values("date")
        .annotate(count=models.Count("id"))
    ):
        _add("quizzes", row)

    return by_type


def build_activity_heatmap(user, days: int = 60) -> list:
    today = timezone.localdate()
    start = today - timezone.timedelta(days=days - 1)

    lesson_rows = (
        DailyActivityLog.objects.filter(
            user=user,
            activity_type="lesson",
            date__gte=start,
            date__lte=today,
        )
        .values("date")
        .annotate(count=models.Count("id"))
    )
    section_rows = (
        DailyActivityLog.objects.filter(
            user=user,
            activity_type="section",
            date__gte=start,
            date__lte=today,
        )
        .values("date")
        .annotate(count=models.Count("id"))
    )
    exercise_rows = (
        DailyActivityLog.objects.filter(
            user=user,
            activity_type="exercise",
            date__gte=start,
            date__lte=today,
        )
        .values("date")
        .annotate(count=models.Count("id"))
    )
    quiz_rows = (
        DailyActivityLog.objects.filter(
            user=user,
            activity_type="quiz",
            date__gte=start,
            date__lte=today,
        )
        .values("date")
        .annotate(count=models.Count("id"))
    )

    def _count_by_day(rows):
        out = {}
        for r in rows:
            d = _completion_day_key(r.get("date"))
            if d:
                out[d] = out.get(d, 0) + r["count"]
        return out

    lessons_by_date = _count_by_day(lesson_rows)
    sections_by_date = _count_by_day(section_rows)
    exercises_by_date = _count_by_day(exercise_rows)
    quizzes_by_date = _count_by_day(quiz_rows)

    result = []
    for i in range(days):
        date = start + timezone.timedelta(days=i)
        date_str = date.isoformat()
        l = lessons_by_date.get(date_str, 0)
        s = sections_by_date.get(date_str, 0)
        e = exercises_by_date.get(date_str, 0)
        q = quizzes_by_date.get(date_str, 0)
        result.append(
            {
                "date": date_str,
                "totalActivities": l + s + e + q,
                "lessonsCompleted": l,
                "sectionsCompleted": s,
                "exercisesCompleted": e,
                "quizzesCompleted": q,
            }
        )

    return result


def build_profile_payload(user, profile: UserProfile):
    today = timezone.localdate()
    first_day = today.replace(day=1)
    last_day = (first_day + timezone.timedelta(days=32)).replace(day=1) - timezone.timedelta(days=1)

    cache_ttl = int(getattr(settings, "USER_PROFILE_CACHE_TTL_SECONDS", 300))
    # Bump when profile shape changes so stale Redis entries cannot omit calendar breakdown.
    cache_key = f"user_profile_summary:v5:{user.id}:{first_day.isoformat()}"
    cached = cache.get(cache_key)
    if cached:
        return cached

    activity_calendar = build_activity_calendar(user, first_day, last_day)
    activity_calendar_by_type = build_activity_calendar_by_type(user, first_day, last_day)

    # Use new onboarding (QuestionnaireProgress) only - so new users get is_questionnaire_completed=False
    questionnaire_completed = QuestionnaireProgress.objects.filter(
        user=user, status="completed"
    ).exists()

    display = user_display_dict(user)
    payload = {
        "id": user.id,
        # Mobile/web read the numeric PK at user.id — it is the RevenueCat
        # appUserID (backend grant path only resolves str(user.pk)).
        "user": {
            "id": user.id,
            "username": display["username"],
            "email": user.email,
            "first_name": display["first_name"],
            "last_name": display["last_name"],
        },
        "username": display["username"],
        "email": user.email,
        "first_name": display["first_name"],
        "last_name": display["last_name"],
        # Flat fields are the source of truth for frontend consumers.
        "earned_money": profile.earned_money,
        "points": profile.points,
        "streak": profile.streak,
        "profile_avatar": profile.profile_avatar,
        "referral_code": profile.referral_code,
        "dark_mode": profile.dark_mode,
        "email_reminder_preference": profile.email_reminder_preference,
        "has_paid": profile.has_paid,
        "is_premium": profile.is_premium,
        "subscription_status": profile.subscription_status,
        "subscription_plan_id": (
            profile.subscription_plan_id
            or getattr(getattr(profile, "subscription_plan", None), "plan_id", None)
        ),
        "stripe_customer_id": getattr(profile, "stripe_customer_id", None) or None,
        "stripe_subscription_id": getattr(profile, "stripe_subscription_id", None) or None,
        "trial_end": profile.trial_end,
        "is_questionnaire_completed": questionnaire_completed,
        "user_data": {
            "username": display["username"],
            "first_name": display["first_name"],
            "last_name": display["last_name"],
            "email": user.email,
            "earned_money": profile.earned_money,
            "points": profile.points,
            "streak": profile.streak,
            "profile_avatar": profile.profile_avatar,
            "referral_code": profile.referral_code,
            "dark_mode": profile.dark_mode,
            "email_reminder_preference": profile.email_reminder_preference,
            "has_paid": profile.has_paid,
            "is_premium": profile.is_premium,
            "subscription_status": profile.subscription_status,
            "subscription_plan_id": (
                profile.subscription_plan_id
                or getattr(getattr(profile, "subscription_plan", None), "plan_id", None)
            ),
            "stripe_customer_id": getattr(profile, "stripe_customer_id", None) or None,
            "stripe_subscription_id": getattr(profile, "stripe_subscription_id", None) or None,
            "trial_end": profile.trial_end,
            "is_questionnaire_completed": questionnaire_completed,
            "financial_profile": {
                "goal_types": profile.goal_types,
                "timeframe": profile.timeframe,
                "risk_comfort": profile.risk_comfort,
                "income_range": profile.income_range,
                "savings_rate_estimate": profile.savings_rate_estimate,
                "investing_experience": profile.investing_experience,
            },
            # Mirror for clients that merge `user_data` over the root payload (calendar must survive).
            "activity_calendar": activity_calendar,
            "activity_calendar_by_type": activity_calendar_by_type,
        },
        "activity_calendar": activity_calendar,
        "activity_calendar_by_type": activity_calendar_by_type,
        "current_month": {
            "first_day": first_day.isoformat(),
            "last_day": last_day.isoformat(),
            "month_name": first_day.strftime("%B"),
            "year": first_day.year,
        },
    }

    milestones = (3, 7, 14, 30)
    streak_val = int(profile.streak or 0)
    next_milestone = next((m for m in milestones if streak_val < m), None)
    days_to_next = (next_milestone - streak_val) if next_milestone is not None else 0
    yesterday = today - timezone.timedelta(days=1)
    streak_at_risk = bool(streak_val >= 3 and profile.last_completed_date == yesterday)

    target_xp = int(getattr(settings, "GAMIFICATION_DAILY_GOAL_TARGET_XP", 50))
    today_xp = (
        RewardLedgerEntry.objects.filter(user=user, created_at__date=today).aggregate(
            total=Sum("points")
        )["total"]
        or 0
    )
    today_xp = int(today_xp)
    daily_goal = {
        "target_xp": target_xp,
        "earned_xp_today": today_xp,
        "progress_pct": min(100, int(today_xp / target_xp * 100)) if target_xp else 0,
    }

    streak_meta = {
        "next_milestone": next_milestone,
        "days_to_next_milestone": days_to_next,
        "streak_at_risk": streak_at_risk,
    }
    payload["streak_meta"] = streak_meta
    payload["daily_goal"] = daily_goal
    payload["user_data"]["streak_meta"] = streak_meta
    payload["user_data"]["daily_goal"] = daily_goal

    if getattr(settings, "GAMIFICATION_RETENTION_V2", False):
        week_start = today - timezone.timedelta(days=today.weekday())
        missions_week = MissionCompletion.objects.filter(
            user=user,
            status="completed",
            completed_at__date__gte=week_start,
            completed_at__date__lte=today,
        ).count()
        xp_week = (
            RewardLedgerEntry.objects.filter(
                user=user,
                created_at__date__gte=week_start,
                created_at__date__lte=today,
            ).aggregate(total=Sum("points"))["total"]
            or 0
        )
        weekly_recap = {
            "week_start": week_start.isoformat(),
            "xp_earned": int(xp_week),
            "missions_completed": missions_week,
            "streak_days": streak_val,
        }
        payload["weekly_recap"] = weekly_recap
        payload["user_data"]["weekly_recap"] = weekly_recap

    cache.set(cache_key, payload, timeout=cache_ttl)
    return payload


def invalidate_profile_cache(user, target_date=None):
    if target_date is None:
        target_date = timezone.localdate()
    first_day = target_date.replace(day=1)
    for suffix in ("", ":v3", ":v4"):
        cache.delete(f"user_profile_summary{suffix}:{user.id}:{first_day.isoformat()}")


CANONICAL_SKILLS = ["Budgeting", "Saving", "Investing", "Markets"]


def _global_rank_for(profile: UserProfile) -> int:
    return UserProfile.objects.filter(points__gt=profile.points).count() + 1


def _friendship_state(viewer, target) -> dict:
    if viewer.id == target.id:
        return {
            "is_self": True,
            "is_friend": False,
            "request_pending_outgoing": False,
            "request_pending_incoming": False,
        }
    accepted = (
        FriendRequest.objects.filter(
            status="accepted",
        )
        .filter(models.Q(sender=viewer, receiver=target) | models.Q(sender=target, receiver=viewer))
        .exists()
    )
    outgoing = FriendRequest.objects.filter(
        sender=viewer, receiver=target, status="pending"
    ).exists()
    incoming = FriendRequest.objects.filter(
        sender=target, receiver=viewer, status="pending"
    ).exists()
    return {
        "is_self": False,
        "is_friend": accepted,
        "request_pending_outgoing": outgoing,
        "request_pending_incoming": incoming,
    }


def _skill_breakdown(user) -> list:
    rows = Mastery.objects.filter(user=user).values("skill", "proficiency")
    by_skill: dict[str, int] = {}
    for r in rows:
        name = (r.get("skill") or "").strip()
        if not name:
            continue
        prev = by_skill.get(name, 0)
        by_skill[name] = max(prev, int(r.get("proficiency") or 0))

    result = [{"name": name, "proficiency": by_skill.get(name, 0)} for name in CANONICAL_SKILLS]
    for name, prof in by_skill.items():
        if name in CANONICAL_SKILLS:
            continue
        result.append({"name": name, "proficiency": prof})
    return result


def _recent_badges(user, limit: int = 6) -> list:
    qs = UserBadge.objects.filter(user=user).select_related("badge").order_by("-earned_at")[:limit]
    return [
        {
            "id": ub.badge_id,
            "name": ub.badge.name,
            "image": (ub.badge.image.url if ub.badge.image else None),
            "level": ub.badge.badge_level,
            "earned_at": ub.earned_at.isoformat() if ub.earned_at else None,
        }
        for ub in qs
    ]


def build_public_profile_payload(viewer, target) -> dict:
    """Rich snapshot for the friend-profile screen. Safe to expose to any authed viewer."""

    target_profile = getattr(target, "profile", None)
    viewer_profile = getattr(viewer, "profile", None)

    target_points = int(getattr(target_profile, "points", 0) or 0)
    target_streak = int(getattr(target_profile, "streak", 0) or 0)
    target_avatar = getattr(target_profile, "profile_avatar", None)

    target_rank = _global_rank_for(target_profile) if target_profile else None

    lessons_completed = LessonCompletion.objects.filter(user_progress__user=target).count()
    missions_completed = MissionCompletion.objects.filter(user=target).count()
    badges_count = UserBadge.objects.filter(user=target).count()

    vs_you = None
    if viewer.id != target.id and viewer_profile is not None:
        viewer_points = int(viewer_profile.points or 0)
        viewer_streak = int(viewer_profile.streak or 0)
        viewer_rank = _global_rank_for(viewer_profile)
        vs_you = {
            "xp_diff": target_points - viewer_points,
            "rank_diff": (viewer_rank - target_rank) if target_rank else None,
            "streak_diff": target_streak - viewer_streak,
        }

    last_active_at = None
    if target_profile and target_profile.last_completed_date:
        last_active_at = target_profile.last_completed_date.isoformat()
    elif target.last_login:
        last_active_at = target.last_login.isoformat()

    open_duel = None
    if viewer.id != target.id:
        open_duel_obj = (
            Duel.objects.filter(
                models.Q(challenger=viewer, opponent=target)
                | models.Q(challenger=target, opponent=viewer),
                status__in=[Duel.STATUS_PENDING, Duel.STATUS_ACTIVE],
            )
            .order_by("-created_at")
            .first()
        )
        if open_duel_obj is not None:
            open_duel = {
                "id": open_duel_obj.id,
                "status": open_duel_obj.status,
                "ends_at": (open_duel_obj.ends_at.isoformat() if open_duel_obj.ends_at else None),
                "viewer_is_challenger": open_duel_obj.challenger_id == viewer.id,
            }

    return {
        "id": target.id,
        "username": user_display_dict(target)["username"],
        "profile_avatar": target_avatar,
        "points": target_points,
        "streak": target_streak,
        "rank": target_rank,
        "lessons_completed": lessons_completed,
        "missions_completed": missions_completed,
        "badges_count": badges_count,
        "joined_at": target.date_joined.isoformat() if target.date_joined else None,
        "last_active_at": last_active_at,
        "skills": _skill_breakdown(target),
        "badges": _recent_badges(target),
        "activity_heatmap": build_activity_heatmap(target, days=30),
        "vs_you": vs_you,
        "friendship": _friendship_state(viewer, target),
        "open_duel": open_duel,
    }

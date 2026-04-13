from django.conf import settings
from django.core.cache import cache
from django.db import models
from django.db.models import Sum
from django.utils import timezone

from authentication.user_display import user_display_dict
from authentication.models import UserProfile
from education.models import ExerciseCompletion, LessonCompletion, SectionCompletion
from gamification.models import MissionCompletion, RewardLedgerEntry
from onboarding.models import QuestionnaireProgress


def build_activity_calendar(user, first_day, last_day):
    # Initialise every date in range to 0
    activity_calendar = {
        str(first_day + timezone.timedelta(days=x)): 0
        for x in range((last_day - first_day).days + 1)
    }

    for row in (
        LessonCompletion.objects.filter(
            user_progress__user=user,
            completed_at__date__gte=first_day,
            completed_at__date__lte=last_day,
        )
        .values("completed_at__date")
        .annotate(count=models.Count("id"))
    ):
        activity_calendar[str(row["completed_at__date"])] = (
            activity_calendar.get(str(row["completed_at__date"]), 0) + row["count"]
        )

    for row in (
        SectionCompletion.objects.filter(
            user_progress__user=user,
            completed_at__date__gte=first_day,
            completed_at__date__lte=last_day,
        )
        .values("completed_at__date")
        .annotate(count=models.Count("id"))
    ):
        activity_calendar[str(row["completed_at__date"])] = (
            activity_calendar.get(str(row["completed_at__date"]), 0) + row["count"]
        )

    for row in (
        ExerciseCompletion.objects.filter(
            user=user,
            completed_at__date__gte=first_day,
            completed_at__date__lte=last_day,
        )
        .values("completed_at__date")
        .annotate(count=models.Count("id"))
    ):
        activity_calendar[str(row["completed_at__date"])] = (
            activity_calendar.get(str(row["completed_at__date"]), 0) + row["count"]
        )

    return activity_calendar


def build_activity_heatmap(user, days: int = 60) -> list:
    today = timezone.now().date()
    start = today - timezone.timedelta(days=days - 1)

    lesson_rows = (
        LessonCompletion.objects.filter(
            user_progress__user=user,
            completed_at__date__gte=start,
            completed_at__date__lte=today,
        )
        .values("completed_at__date")
        .annotate(count=models.Count("id"))
    )
    section_rows = (
        SectionCompletion.objects.filter(
            user_progress__user=user,
            completed_at__date__gte=start,
            completed_at__date__lte=today,
        )
        .values("completed_at__date")
        .annotate(count=models.Count("id"))
    )
    exercise_rows = (
        ExerciseCompletion.objects.filter(
            user=user,
            completed_at__date__gte=start,
            completed_at__date__lte=today,
        )
        .values("completed_at__date")
        .annotate(count=models.Count("id"))
    )

    lessons_by_date = {str(r["completed_at__date"]): r["count"] for r in lesson_rows}
    sections_by_date = {str(r["completed_at__date"]): r["count"] for r in section_rows}
    exercises_by_date = {str(r["completed_at__date"]): r["count"] for r in exercise_rows}

    result = []
    for i in range(days):
        date = start + timezone.timedelta(days=i)
        date_str = date.isoformat()
        l = lessons_by_date.get(date_str, 0)
        s = sections_by_date.get(date_str, 0)
        e = exercises_by_date.get(date_str, 0)
        result.append({
            "date": date_str,
            "totalActivities": l + s + e,
            "lessonsCompleted": l,
            "sectionsCompleted": s,
            "exercisesCompleted": e,
        })

    return result


def build_profile_payload(user, profile: UserProfile):
    today = timezone.now().date()
    first_day = today.replace(day=1)
    last_day = (first_day + timezone.timedelta(days=32)).replace(day=1) - timezone.timedelta(days=1)

    cache_ttl = int(getattr(settings, "USER_PROFILE_CACHE_TTL_SECONDS", 300))
    cache_key = f"user_profile_summary:{user.id}:{first_day.isoformat()}"
    cached = cache.get(cache_key)
    if cached:
        return cached

    activity_calendar = build_activity_calendar(user, first_day, last_day)

    # Use new onboarding (QuestionnaireProgress) only - so new users get is_questionnaire_completed=False
    questionnaire_completed = QuestionnaireProgress.objects.filter(
        user=user, status="completed"
    ).exists()

    display = user_display_dict(user)
    payload = {
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
        },
        "activity_calendar": activity_calendar,
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
        target_date = timezone.now().date()
    first_day = target_date.replace(day=1)
    cache_key = f"user_profile_summary:{user.id}:{first_day.isoformat()}"
    cache.delete(cache_key)

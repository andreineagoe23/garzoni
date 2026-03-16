from django.core.cache import cache
from django.db import models
from django.utils import timezone
from django.conf import settings

from authentication.user_display import user_display_dict
from authentication.models import UserProfile
from education.models import LessonCompletion
from onboarding.models import QuestionnaireProgress


def build_activity_calendar(user, first_day, last_day):
    lesson_completions = (
        LessonCompletion.objects.filter(
            user_progress__user=user,
            completed_at__date__gte=first_day,
            completed_at__date__lte=last_day,
        )
        .values("completed_at__date")
        .annotate(count=models.Count("id"))
    )

    activity_calendar = {
        str(date): 0
        for date in [
            first_day + timezone.timedelta(days=x) for x in range((last_day - first_day).days + 1)
        ]
    }

    for completion in lesson_completions:
        activity_calendar[str(completion["completed_at__date"])] = completion["count"]

    return activity_calendar


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
        "user_data": {
            "username": display["username"],
            "first_name": display["first_name"],
            "last_name": display["last_name"],
            "email": user.email,
            "earned_money": profile.earned_money,
            "points": profile.points,
            "streak": profile.streak,
            "profile_avatar": profile.profile_avatar,
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

    cache.set(cache_key, payload, timeout=cache_ttl)
    return payload


def invalidate_profile_cache(user, target_date=None):
    if target_date is None:
        target_date = timezone.now().date()
    first_day = target_date.replace(day=1)
    cache_key = f"user_profile_summary:{user.id}:{first_day.isoformat()}"
    cache.delete(cache_key)

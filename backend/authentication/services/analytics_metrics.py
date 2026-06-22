"""
Product analytics aggregations for staff dashboards (FunnelMetricsView).

Keeps ORM-heavy metric blocks out of finance/views.py.
"""

from __future__ import annotations

from datetime import timedelta
from statistics import median

from django.contrib.auth import get_user_model
from django.db.models import Avg, Count, DurationField, ExpressionWrapper, F, Sum
from django.db.models.functions import ExtractDay, TruncDate
from django.utils import timezone

from authentication.models import UserProfile

MOBILE_PLATFORMS = ["ios", "android"]
STREAK_BUCKETS = (
    ("0", 0, 0),
    ("1-3", 1, 3),
    ("4-7", 4, 7),
    ("8-30", 8, 30),
    ("31+", 31, None),
)


def signup_platform_scope(qs, platform: str):
    """Filter a User queryset by profile.signup_platform."""
    if platform == "web":
        return qs.filter(profile__signup_platform="web")
    if platform == "mobile":
        return qs.filter(profile__signup_platform__in=MOBILE_PLATFORMS)
    return qs


def profile_platform_scope(qs, platform: str):
    """Filter a UserProfile queryset by signup_platform."""
    if platform == "web":
        return qs.filter(signup_platform="web")
    if platform == "mobile":
        return qs.filter(signup_platform__in=MOBILE_PLATFORMS)
    return qs


def _rate(numerator: int, denominator: int) -> float:
    return round((numerator / denominator) * 100, 2) if denominator else 0.0


def build_onboarding_funnel(*, since, platform: str) -> dict:
    User = get_user_model()
    from onboarding.models import QuestionnaireProgress

    signups_qs = signup_platform_scope(User.objects.filter(date_joined__gte=since), platform)
    signups = signups_qs.count()

    progress_qs = QuestionnaireProgress.objects.filter(user__date_joined__gte=since)
    if platform == "web":
        progress_qs = progress_qs.filter(user__profile__signup_platform="web")
    elif platform == "mobile":
        progress_qs = progress_qs.filter(user__profile__signup_platform__in=MOBILE_PLATFORMS)

    started = progress_qs.count()
    completed_profile = profile_platform_scope(
        UserProfile.objects.filter(
            onboarding_completed_at__gte=since,
            user__date_joined__gte=since,
        ),
        platform,
    ).count()
    completed_progress = progress_qs.filter(status="completed").count()
    completed = max(completed_profile, completed_progress)

    return {
        "signups": signups,
        "questionnaire_started": started,
        "onboarding_completed": completed,
        "signup_to_started_rate": _rate(started, signups),
        "started_to_completed_rate": _rate(completed, started),
        "signup_to_completed_rate": _rate(completed, signups),
    }


def build_activation_metrics(*, since, platform: str) -> dict:
    User = get_user_model()
    signups_qs = signup_platform_scope(User.objects.filter(date_joined__gte=since), platform)
    signups = signups_qs.count()

    activated_qs = profile_platform_scope(
        UserProfile.objects.filter(
            first_lesson_at__isnull=False,
            user__date_joined__gte=since,
        ),
        platform,
    )
    activated = activated_qs.count()

    days_list = list(
        activated_qs.annotate(
            days=ExtractDay(F("first_lesson_at") - F("user__date_joined"))
        ).values_list("days", flat=True)
    )
    days_list = [int(d) for d in days_list if d is not None and d >= 0]

    activated_1d = (
        activated_qs.annotate(
            delta=ExpressionWrapper(
                F("first_lesson_at") - F("user__date_joined"),
                output_field=DurationField(),
            )
        )
        .filter(delta__lte=timedelta(days=1))
        .count()
    )
    activated_7d = (
        activated_qs.annotate(
            delta=ExpressionWrapper(
                F("first_lesson_at") - F("user__date_joined"),
                output_field=DurationField(),
            )
        )
        .filter(delta__lte=timedelta(days=7))
        .count()
    )

    return {
        "signups_in_range": signups,
        "activated": activated,
        "activation_rate": _rate(activated, signups),
        "activated_within_1d": activated_1d,
        "activated_within_7d": activated_7d,
        "median_days_to_first_lesson": round(median(days_list), 1) if days_list else None,
    }


def build_subscription_mix(*, platform: str) -> dict:
    qs = profile_platform_scope(UserProfile.objects.all(), platform)
    by_plan = {
        (row["subscription_plan_id"] or "free"): row["count"]
        for row in qs.values("subscription_plan_id").annotate(count=Count("id")).order_by("-count")
    }
    by_status = {
        (row["subscription_status"] or "unknown"): row["count"]
        for row in qs.values("subscription_status").annotate(count=Count("id")).order_by("-count")
    }
    premium = qs.filter(is_premium=True).count()
    paid = qs.filter(has_paid=True).count()
    total = qs.count()
    return {
        "total_profiles": total,
        "premium": premium,
        "has_paid": paid,
        "premium_rate": _rate(premium, total),
        "by_plan": by_plan,
        "by_status": by_status,
    }


def build_streak_distribution(*, platform: str) -> list[dict]:
    qs = profile_platform_scope(UserProfile.objects.all(), platform)
    distribution = []
    for label, low, high in STREAK_BUCKETS:
        if high is None:
            count = qs.filter(streak__gte=low).count()
        elif low == high:
            count = qs.filter(streak=low).count()
        else:
            count = qs.filter(streak__gte=low, streak__lte=high).count()
        distribution.append({"bucket": label, "count": count})
    return distribution


def build_at_risk(*, inactive_days: int = 7, platform: str) -> dict:
    today = timezone.localdate()
    cutoff = today - timedelta(days=inactive_days)
    qs = profile_platform_scope(
        UserProfile.objects.filter(streak__gt=0, last_completed_date__lt=cutoff),
        platform,
    )
    return {
        "inactive_days_threshold": inactive_days,
        "count": qs.count(),
        "description": f"Active streak but no lesson in {inactive_days}+ days",
    }


def build_engagement_by_plan(*, platform: str) -> list[dict]:
    qs = profile_platform_scope(UserProfile.objects.all(), platform)
    rows = (
        qs.values("subscription_plan_id")
        .annotate(
            users=Count("id"),
            avg_streak=Avg("streak"),
            total_earned=Sum("earned_money"),
        )
        .order_by("-users")
    )
    return [
        {
            "plan": row["subscription_plan_id"] or "free",
            "users": row["users"],
            "avg_streak": round(float(row["avg_streak"] or 0), 2),
            "total_earned_money": float(row["total_earned"] or 0),
        }
        for row in rows
    ]


def build_learning_timeseries(*, since, platform: str) -> list[dict]:
    """Daily users who completed a lesson (by profile.last_completed_date)."""
    since_date = since.date() if hasattr(since, "date") else since
    qs = profile_platform_scope(
        UserProfile.objects.filter(last_completed_date__gte=since_date),
        platform,
    )
    return [
        {"day": str(row["day"]), "learners": row["count"]}
        for row in qs.annotate(day=TruncDate("last_completed_date"))
        .values("day")
        .annotate(count=Count("id"))
        .order_by("day")
    ]


def build_onboarding_timeseries(*, since, platform: str) -> list[dict]:
    qs = profile_platform_scope(
        UserProfile.objects.filter(onboarding_completed_at__gte=since),
        platform,
    )
    return [
        {"day": str(row["day"]), "completions": row["count"]}
        for row in qs.annotate(day=TruncDate("onboarding_completed_at"))
        .values("day")
        .annotate(count=Count("id"))
        .order_by("day")
    ]

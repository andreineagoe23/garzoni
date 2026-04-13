# gamification/utils.py
from __future__ import annotations

import logging

from django.utils.text import slugify

logger = logging.getLogger(__name__)

BADGE_CRITERIA_SEQUENCE = (
    "lessons_completed",
    "courses_completed",
    "streak_days",
    "missions_completed",
    "points_earned",
    "savings_balance",
)


def evaluate_badges_for_user(user) -> None:
    """
    Run all active badge criteria checks once (e.g. after a reward grant).
    """
    for criteria_type in BADGE_CRITERIA_SEQUENCE:
        check_and_award_badge(user, criteria_type)

    from gamification.models import Badge

    for badge in Badge.objects.filter(is_active=True).exclude(criteria_slug="").iterator():
        check_slug_badge(user, badge)


def check_slug_badge(user, badge) -> None:
    """
    Award badges that carry a criteria_slug (finance milestones, path/mission hooks).
    """
    from gamification.models import UserBadge, MissionCompletion

    if UserBadge.objects.filter(user=user, badge=badge).exists():
        return

    slug = (badge.criteria_slug or "").strip()
    if not slug or ":" not in slug:
        return

    kind, ref = slug.split(":", 1)
    kind = kind.strip().lower()
    ref = ref.strip()
    earned = False

    if kind == "path":
        from education.models import Path, Course, UserProgress

        path = None
        if ref.isdigit():
            path = Path.objects.filter(pk=int(ref)).first()
        if path is None:
            slug_ref = slugify(ref.replace("-", " "))
            for p in Path.objects.all().only("id", "title"):
                if slugify(p.title.replace("-", " ")) == slug_ref or slugify(p.title) == ref:
                    path = p
                    break
        if path is None:
            earned = False
        else:
            total = Course.objects.filter(path=path).count()
            if total == 0:
                earned = False
            else:
                done = UserProgress.objects.filter(
                    user=user, course__path=path, is_course_complete=True
                ).count()
                earned = done >= total
    elif kind == "mission":
        mission_id = int(ref) if ref.isdigit() else None
        if mission_id is not None:
            earned = MissionCompletion.objects.filter(
                user=user, mission_id=mission_id, status="completed"
            ).exists()
        else:
            earned = MissionCompletion.objects.filter(
                user=user, mission__name__iexact=ref, status="completed"
            ).exists()
    else:
        logger.debug("Unknown badge criteria_slug kind=%s", kind)
        earned = False

    if earned:
        UserBadge.objects.create(user=user, badge=badge)


def check_and_award_badge(user, criteria_type):
    """
    Check if a user meets the criteria for a badge and award it if they do.

    Args:
        user: The user to check
        criteria_type: The type of criteria to check (e.g., 'lessons_completed', 'courses_completed', etc.)
    """
    from gamification.models import Badge, UserBadge
    from education.models import LessonCompletion, UserProgress
    from gamification.models import MissionCompletion

    badges = Badge.objects.filter(criteria_type=criteria_type, is_active=True)
    for badge in badges:
        if badge.criteria_slug:
            continue
        if UserBadge.objects.filter(user=user, badge=badge).exists():
            continue

        earned = False
        if criteria_type == "lessons_completed":
            count = LessonCompletion.objects.filter(user_progress__user=user).count()
            earned = count >= badge.threshold
        elif criteria_type == "courses_completed":
            count = UserProgress.objects.filter(user=user, is_course_complete=True).count()
            earned = count >= badge.threshold
        elif criteria_type == "streak_days":
            profile = getattr(user, "profile", None)
            streak_val = int(profile.streak) if profile and profile.streak is not None else 0
            earned = streak_val >= badge.threshold
        elif criteria_type == "missions_completed":
            count = MissionCompletion.objects.filter(user=user, status="completed").count()
            earned = count >= badge.threshold
        elif criteria_type == "points_earned":
            profile = getattr(user, "profile", None)
            pts = int(profile.points) if profile and profile.points is not None else 0
            earned = pts >= badge.threshold
        elif criteria_type == "savings_balance":
            profile = getattr(user, "profile", None)
            if profile is None:
                earned = False
            else:
                balance = profile.earned_money or 0
                earned = float(balance) >= float(badge.threshold)
        else:
            logger.debug("Unknown badge criteria_type=%s", criteria_type)
            earned = False

        if earned:
            UserBadge.objects.create(user=user, badge=badge)

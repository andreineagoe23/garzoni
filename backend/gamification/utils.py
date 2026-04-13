# gamification/utils.py
from __future__ import annotations

import logging

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

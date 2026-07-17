"""
Builders for the ``GET /api/onboarding/plan-summary/`` "Your Plan Is Ready"
segue screen (see docs/ux/UX_ONBOARDING_MONETIZATION_PLAN.md, section 1.1).

All data is already persisted: ``UserProfile`` financial-profile fields
(``goal_types``, ``timeframe``, ``risk_comfort``, ``investing_experience``) plus
the raw ``QuestionnaireProgress.answers``. No schema changes.

Everything here is defensive: any field may be unset when the questionnaire was
abandoned, so builders return ``None``/empty lists rather than raising.
"""

import calendar
import logging
from datetime import date

from onboarding.answers import answer_values, primary_answer

logger = logging.getLogger(__name__)


# Humanized labels for the vocabularies we actually persist.
#   - profile.goal_types vocabulary: authentication.serializers.ALLOWED_GOAL_TYPES
#   - questionnaire answer vocabulary (primary_goal / biggest_challenge):
#     onboarding.views.DEFAULT_QUESTIONNAIRE_STRUCTURE
# Fallback for anything unmapped is a title-cased key.
GOAL_LABELS = {
    # profile.goal_types vocabulary
    "save": "Build savings",
    "savings": "Grow savings",
    "emergency": "Build an emergency fund",
    "invest": "Start investing",
    "wealth": "Build wealth",
    "portfolio": "Grow your portfolio",
    "debt": "Pay off debt",
    "loan": "Pay off loans",
    "mortgage": "Manage your mortgage",
    "retirement": "Plan for retirement",
    "education": "Fund education",
    "other": "Reach your money goal",
    # questionnaire answer vocabulary (primary_goal / biggest_challenge)
    "budget": "Build a budget",
    "overspending": "Control spending",
    "no_plan": "Build a financial plan",
    "confidence": "Grow money confidence",
}

# Goal-specific outcome clause used in the projected-outcome sentence, keyed by
# the primary goal. Fallback is a generic clause.
OUTCOME_CLAUSES = {
    "debt": "have a clear plan to pay down your debt",
    "loan": "have a clear plan to pay off your loans",
    "mortgage": "have a plan to manage your mortgage",
    "save": "have a growing savings cushion",
    "savings": "have a growing savings cushion",
    "emergency": "have an emergency fund taking shape",
    "invest": "feel confident making your first investments",
    "portfolio": "have a plan to grow your portfolio",
    "wealth": "be on track to build lasting wealth",
    "retirement": "have a retirement plan in motion",
    "education": "have a plan to fund your education goals",
    "budget": "have a budget you can actually stick to",
    "overspending": "have your spending under control",
    "no_plan": "have a clear money plan to follow",
    "confidence": "feel confident managing your money",
    "other": "be closer to your money goal",
}
DEFAULT_OUTCOME_CLAUSE = "have a working plan for your money goals"

# Map the timeframe vocabularies to a month offset for the target date.
#   - questionnaire time_horizon vocab: 30_days / 3_months / 6_months / year
#   - profile.timeframe vocab (ALLOWED_TIMEFRAMES): short/medium/long + year ranges
TIMEFRAME_MONTHS = {
    # questionnaire time_horizon vocabulary
    "30_days": 1,
    "3_months": 3,
    "6_months": 6,
    "year": 12,
    # profile.timeframe vocabulary
    "short": 3,
    "medium": 6,
    "long": 12,
    "1-3": 12,
    "1-3 years": 12,
    "3-5": 36,
    "3-5 years": 36,
    "5-10": 60,
    "5+ years": 60,
    "10+": 60,
}
DEFAULT_TIMEFRAME_MONTHS = 3

# investing_experience values (ALLOWED_INVESTING_EXPERIENCE) that count as
# "experienced" for the Pro recommendation.
EXPERIENCED_INVESTING_LEVELS = {"advanced", "experienced"}


def humanize_goal(key: str) -> str:
    """Short human label for a goal key; title-cased key as a fallback."""
    key = str(key or "").strip().lower()
    if not key:
        return ""
    return GOAL_LABELS.get(key, key.replace("_", " ").title())


def timeframe_to_months(timeframe) -> int:
    """Month offset for a timeframe value; falls back to 3 months."""
    key = str(timeframe or "").strip().lower()
    return TIMEFRAME_MONTHS.get(key, DEFAULT_TIMEFRAME_MONTHS)


def add_months(base: date, months: int) -> date:
    """Add ``months`` calendar months to ``base`` (no external deps)."""
    total = base.month - 1 + months
    year = base.year + total // 12
    month = total % 12 + 1
    day = min(base.day, calendar.monthrange(year, month)[1])
    return date(year, month, day)


def build_stated_goals(profile, answers):
    """List of ``{"key", "label"}`` from profile.goal_types, falling back to
    the questionnaire's primary_goal / biggest_challenge answers."""
    source = []
    goal_types = getattr(profile, "goal_types", None) or []
    if isinstance(goal_types, (list, tuple)):
        source.extend(goal_types)
    if not source:
        for key in ("primary_goal", "biggest_challenge"):
            # multiple_choice answers may be a list (mobile multi-select) or a
            # scalar (web); keep the selection order — first is the primary goal.
            source.extend(answer_values(answers.get(key)))

    goals = []
    seen = set()
    for raw in source:
        key = str(raw or "").strip().lower()
        if not key or key in seen:
            continue
        seen.add(key)
        goals.append({"key": key, "label": humanize_goal(key)})
    return goals


def resolve_timeframe(profile, answers):
    """Resolved timeframe string (profile first, then questionnaire), or None."""
    value = str(getattr(profile, "timeframe", "") or "").strip().lower()
    if not value:
        value = str(primary_answer(answers.get("time_horizon")) or "").strip().lower()
    return value or None


def resolve_risk_comfort(profile):
    value = str(getattr(profile, "risk_comfort", "") or "").strip().lower()
    return value or None


def build_projected_outcome(stated_goals, timeframe, today=None):
    """{"text", "target_date"} sentence anchored on the primary goal + timeframe.

    Returns None only when there is neither a goal nor a timeframe to anchor on.
    """
    if today is None:
        today = date.today()
    primary_key = stated_goals[0]["key"] if stated_goals else None
    if not primary_key and not timeframe:
        return None

    months = timeframe_to_months(timeframe)
    target = add_months(today, months)
    clause = OUTCOME_CLAUSES.get(primary_key, DEFAULT_OUTCOME_CLAUSE)
    text = f"By {target.strftime('%B %Y')}, you'll {clause}."
    return {"text": text, "target_date": target.isoformat()}


def recommend_tier(profile, stated_goals):
    """'pro' when investing experience is advanced/experienced OR >= 3 goals."""
    exp = str(getattr(profile, "investing_experience", "") or "").strip().lower()
    if exp in EXPERIENCED_INVESTING_LEVELS or len(stated_goals) >= 3:
        return "pro"
    return "plus"


def build_curated_lessons(user, profile, limit=3):
    """First ``limit`` lessons of the user's personalized path.

    Reuses the persisted personalized path (``profile.recommended_courses``,
    produced by education.views.PersonalizedPathView). When no path has been
    generated yet, falls back to the first accessible course (mirrors the
    ``start_here`` logic in education.views).

    Only id / title / topic (the course's path title) are returned.
    """
    try:
        from education.models import Course, Lesson, Path
        from education.views import _allowed_path_ids

        allowed_path_ids = list(_allowed_path_ids(user))
        if not allowed_path_ids:
            return []

        ordered_courses = []

        raw_ids = getattr(profile, "recommended_courses", None) or []
        course_ids = []
        for cid in raw_ids:
            try:
                course_ids.append(int(cid))
            except (TypeError, ValueError):
                continue
        if course_ids:
            by_id = {
                c.id: c
                for c in Course.objects.filter(
                    id__in=course_ids,
                    path_id__in=allowed_path_ids,
                    is_active=True,
                ).select_related("path")
            }
            # Preserve the personalized priority order stored on the profile.
            ordered_courses = [by_id[cid] for cid in course_ids if cid in by_id]

        if not ordered_courses:
            # Fallback: first accessible course of the first accessible path
            # (same intent as education.views start_here).
            first_path_id = (
                Path.objects.filter(id__in=allowed_path_ids)
                .order_by("sort_order", "id")
                .values_list("id", flat=True)
                .first()
            )
            if first_path_id is not None:
                first_course = (
                    Course.objects.filter(path_id=first_path_id)
                    .order_by("order", "id")
                    .select_related("path")
                    .first()
                )
                if first_course is not None:
                    ordered_courses = [first_course]

        lessons = []
        for course in ordered_courses:
            topic = course.path.title if getattr(course, "path", None) else None
            for row in (
                Lesson.objects.filter(course_id=course.id).order_by("id").values("id", "title")
            ):
                lessons.append({"id": row["id"], "title": row["title"], "topic": topic})
                if len(lessons) >= limit:
                    return lessons
        return lessons
    except Exception as exc:  # never let curated lessons break the endpoint
        logger.warning(
            "plan_summary curated_lessons failed user=%s err=%s", getattr(user, "id", None), exc
        )
        return []


def build_plan_summary(user, profile, answers, today=None):
    """Assemble the full plan-summary payload (see module docstring)."""
    answers = answers or {}
    stated_goals = build_stated_goals(profile, answers)
    timeframe = resolve_timeframe(profile, answers)
    risk_comfort = resolve_risk_comfort(profile)
    curated_lessons = build_curated_lessons(user, profile)
    projected_outcome = build_projected_outcome(stated_goals, timeframe, today=today)
    recommended_tier = recommend_tier(profile, stated_goals)

    return {
        "stated_goals": stated_goals,
        "timeframe": timeframe,
        "risk_comfort": risk_comfort,
        "curated_lessons": curated_lessons,
        "projected_outcome": projected_outcome,
        "recommended_tier": recommended_tier,
        # Paywall placement experiment flag (plan §3.5); env-driven, default "onboarding".
        "paywall_placement": paywall_placement(),
    }


def paywall_placement() -> str:
    """Env-driven paywall placement flag ("onboarding" | "post_first_lesson")."""
    from django.conf import settings

    return getattr(settings, "UX_PAYWALL_PLACEMENT", "onboarding")

"""
Learner-facing exercise visibility.

Staff/superusers see the full catalog for QA. Everyone else only sees exercises that are
published, have a real prompt (base or translation), and are not in the internal-only
category bucket (see INTERNAL_EXERCISE_CATEGORY).
"""

from __future__ import annotations

from django.db.models import Exists, OuterRef, Q, QuerySet
from django.db.models.functions import Trim

from education.models import ExerciseTranslation

INTERNAL_EXERCISE_CATEGORY = "General"


def apply_learner_exercise_filters(qs: QuerySet, user, *, force_learner: bool = False) -> QuerySet:
    """
    Restrict queryset to exercises safe to show in product surfaces (list, categories,
    recommendations, etc.).

    Staff/superusers normally bypass filters so QA can see drafts. When ``force_learner``
    is True (e.g. ``?as_learner=1`` from the learner app), the same rules as learners apply
    so counts match production.
    """
    if (
        not force_learner
        and user is not None
        and (getattr(user, "is_staff", False) or getattr(user, "is_superuser", False))
    ):
        return qs

    tr_nonempty = (
        ExerciseTranslation.objects.filter(exercise_id=OuterRef("pk"))
        .annotate(_ev_tq=Trim("question"))
        .exclude(_ev_tq="")
    )

    return (
        qs.annotate(_ev_qtrim=Trim("question"))
        .filter(Q(_ev_qtrim__gt="") | Exists(tr_nonempty))
        .filter(is_published=True)
        .exclude(category=INTERNAL_EXERCISE_CATEGORY)
    )


def learner_can_access_exercise(user, exercise_id: int, *, force_learner: bool = False) -> bool:
    """True if this user may load or submit answers for the given exercise id."""
    from education.models import Exercise  # local import avoids circular import at module load

    return apply_learner_exercise_filters(
        Exercise.objects.filter(pk=exercise_id), user, force_learner=force_learner
    ).exists()

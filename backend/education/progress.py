"""Single source of truth for course-completion math.

Course progress is **section-based and published-only**: a course is complete
when every published ``LessonSection`` has a ``SectionCompletion`` for the user.

``progress_summary`` and ``PersonalizedPathView`` both derive their numbers from
here so the journey ring, dashboard, and course cards never disagree. Writes
(``_complete_section_for_user`` / ``_complete_lesson_for_user`` /
``complete_course``) use the same definition to set ``is_course_complete``.
"""

from __future__ import annotations

from django.db.models import Count

from education.models import LessonSection, UserProgress


def published_section_totals(course_ids) -> dict[int, int]:
    """Map ``course_id -> number of published sections`` for the given courses."""
    return {
        row["lesson__course_id"]: int(row["c"])
        for row in LessonSection.objects.filter(
            lesson__course_id__in=course_ids,
            is_published=True,
        )
        .values("lesson__course_id")
        .annotate(c=Count("id"))
    }


def completed_published_section_count(progress: UserProgress | None) -> int:
    """Count a user's completed sections that are published.

    Iterates the ``completed_sections`` M2M so callers that already
    ``prefetch_related("completed_sections")`` don't trigger extra queries.
    """
    if progress is None:
        return 0
    return sum(1 for s in progress.completed_sections.all() if s.is_published)


def course_percent(completed: int, total: int) -> float:
    """Section-based completion percent; ``0.0`` when there are no published sections."""
    if total <= 0:
        return 0.0
    return round((completed / total) * 100, 1)


def course_is_complete(completed: int, total: int) -> bool:
    """A course is complete once every published section is done."""
    return total > 0 and completed >= total

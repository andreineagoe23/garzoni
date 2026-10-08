"""Which lessons are readable without an account at /learn/<slug>.

A lesson is public when an editor flagged it (`Lesson.is_public`) or when it is the first
lesson of an active course — every course gets one free sample page for search and a taste
before signup. The rest of each course stays behind login.

"First" is the lowest id in the course: lessons have no order field, and the app walks a
course in id order (`views._next_lesson_title`, the personalized-path index). A first lesson
with no published prose is skipped rather than replaced by the second one, so a course's
sample page never moves to a different URL when content is edited.

Computed at query time on purpose: making these public through the flag would need a data
write in production, and a new course would then need someone to remember to flag it.
"""

from django.db.models import Min, Q

from education.models import Lesson, LessonSection


def first_lesson_ids():
    """Subquery: the first lesson of every active course."""
    return (
        Lesson.objects.filter(course__is_active=True)
        .values("course_id")
        .annotate(first_id=Min("id"))
        .values("first_id")
    )


def _lessons_with_prose():
    return (
        LessonSection.objects.filter(content_type="text", is_published=True)
        .exclude(text_content__isnull=True)
        .exclude(text_content="")
        .values("lesson_id")
    )


def public_lessons(queryset=None):
    """Restrict a Lesson queryset to the publicly readable ones."""
    if queryset is None:
        queryset = Lesson.objects.all()
    return queryset.filter(
        Q(is_public=True) | (Q(pk__in=first_lesson_ids()) & Q(pk__in=_lessons_with_prose()))
    ).exclude(slug="")

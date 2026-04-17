from django.utils import timezone

from education.models import Course, DailyActivityLog


def record_activity(user, activity_type: str, object_id: int, course: Course | None = None):
    """
    Record a user activity once per object.

    Idempotency is enforced by the DailyActivityLog unique constraint.
    """
    DailyActivityLog.objects.get_or_create(
        user=user,
        activity_type=activity_type,
        object_id=object_id,
        defaults={
            "course": course,
            "date": timezone.localdate(),
        },
    )

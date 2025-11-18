# education/tasks.py
from celery import shared_task
from django.utils import timezone
from django.contrib.auth.models import User
from django.db.models import Max
from education.models import UserProgress


@shared_task
def reset_inactive_streaks():
    """
    Reset streaks for users who have been inactive for over 24 hours.
    
    - Checks the last activity date for each user.
    - If a user has been inactive for more than a day, their streak is reset to 0.
    """
    users = User.objects.annotate(last_active=Max('userprogress__last_completed_date'))

    for user in users:
        if user.last_active:
            today = timezone.now().date()
            days_inactive = (today - user.last_active).days
            if days_inactive > 1:
                UserProgress.objects.filter(user=user).update(streak=0)


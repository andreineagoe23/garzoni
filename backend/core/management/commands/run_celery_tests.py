"""
Queue Celery test tasks so you can verify worker + Redis from logs.
Run: python manage.py run_celery_tests
Or call the internal endpoint with ?key=CELERY_TEST_KEY.
"""

from django.core.management.base import BaseCommand


def _queue_celery_tests():
    """Queue test tasks; return list of task names."""
    from settings.celery import debug_task
    from authentication.tasks import send_email_reminders, send_trial_ending_reminder
    from education.tasks import reset_inactive_streaks
    from gamification.tasks import reset_daily_missions, reset_weekly_missions

    tasks_queued = []
    debug_task.delay()
    tasks_queued.append("debug_task")
    send_email_reminders.delay()
    tasks_queued.append("send_email_reminders")
    send_trial_ending_reminder.delay()
    tasks_queued.append("send_trial_ending_reminder")
    reset_inactive_streaks.delay()
    tasks_queued.append("reset_inactive_streaks")
    reset_daily_missions.delay()
    tasks_queued.append("reset_daily_missions")
    reset_weekly_missions.delay()
    tasks_queued.append("reset_weekly_missions")
    return tasks_queued


class Command(BaseCommand):
    help = "Queue Celery test tasks (debug_task, reminders, resets). Check worker logs to confirm they run."

    def handle(self, *args, **options):
        tasks = _queue_celery_tests()
        self.stdout.write(self.style.SUCCESS(f"Queued {len(tasks)} tasks: {', '.join(tasks)}"))
        self.stdout.write("Check your Celery worker logs for 'Received task' and 'succeeded'.")

from __future__ import absolute_import, unicode_literals
import os
from celery import Celery, shared_task  # Add shared_task import
from celery.schedules import crontab

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "settings.settings")

app = Celery("settings")

app.config_from_object("django.conf:settings", namespace="CELERY")


app.autodiscover_tasks()


@app.task
def debug_task():
    print("Celery is working!")


# Periodic tasks
app.conf.beat_schedule = {
    "send-daily-email-reminders": {
        "task": "authentication.tasks.send_email_reminders",
        "schedule": crontab(hour=12, minute=0),
    },
    "reset-inactive-streaks": {
        "task": "education.tasks.reset_inactive_streaks",
        "schedule": crontab(hour=0, minute=0),
    },
    "send-trial-ending-reminder": {
        "task": "authentication.tasks.send_trial_ending_reminder",
        "schedule": crontab(hour=10, minute=0),
    },
    "reset-daily-missions": {
        "task": "gamification.models.reset_daily_missions",
        "schedule": crontab(hour=0, minute=0),
    },
    "reset-weekly-missions": {
        "task": "gamification.models.reset_weekly_missions",
        "schedule": crontab(hour=0, minute=0, day_of_week=1),
    },
}

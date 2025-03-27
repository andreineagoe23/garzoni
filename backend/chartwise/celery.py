from __future__ import absolute_import, unicode_literals
import os
from celery import Celery
from celery.schedules import crontab

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'chartwise.settings')

app = Celery('chartwise')

app.config_from_object('django.conf:settings', namespace='CELERY')

# Auto-discover tasks
app.autodiscover_tasks()

# Periodic tasks
app.conf.beat_schedule = {
    'send-daily-email-reminders': {
        'task': 'core.tasks.send_email_reminders',
        'schedule': crontab(hour=12, minute=0),
    },
    'reset-inactive-streaks': {
        'task': 'core.tasks.reset_inactive_streaks',
        'schedule': crontab(hour=0, minute=0),
    },
}

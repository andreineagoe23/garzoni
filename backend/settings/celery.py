from __future__ import absolute_import, unicode_literals
import os
from celery import Celery, shared_task  # Add shared_task import
from celery.schedules import crontab

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "settings.settings")

app = Celery("settings")

app.config_from_object("django.conf:settings", namespace="CELERY")
# Railway (and Celery) can leave CELERY_BROKER_URL in os.environ pointing at the public proxy;
# settings.py may rewrite to redis.railway.internal. Force the resolved broker on the app.
from django.conf import settings as django_settings  # noqa: E402

if getattr(django_settings, "CELERY_BROKER_URL", None):
    app.conf.broker_url = django_settings.CELERY_BROKER_URL

app.conf.timezone = os.getenv(
    "CELERY_TIMEZONE",
    os.getenv("TIME_ZONE", "Europe/London"),
)
app.conf.enable_utc = True


app.autodiscover_tasks()


@app.task
def debug_task():
    print("Celery is working!")


# Periodic tasks (used when Beat runs with the default scheduler). With
# django_celery_beat.schedulers:DatabaseScheduler, schedules come from the DB —
# see authentication/migrations/0020_beat_periodic_send_renewal_reminder.py for renewal.
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
    "send-renewal-reminder": {
        "task": "authentication.tasks.send_renewal_reminder",
        "schedule": crontab(hour=10, minute=0),
    },
    # Implemented in gamification/tasks.py; names kept as gamification.models.* for Beat/DB rows.
    "reset-daily-missions": {
        "task": "gamification.models.reset_daily_missions",
        "schedule": crontab(hour=0, minute=0),
    },
    "reset-weekly-missions": {
        "task": "gamification.models.reset_weekly_missions",
        "schedule": crontab(hour=0, minute=0, day_of_week=1),
    },
    "spawn-streak-rescue-missions": {
        "task": "gamification.tasks.spawn_streak_rescue_missions",
        "schedule": crontab(hour=18, minute=0),
    },
    "refresh-finance-news-cache": {
        "task": "finance.tasks.refresh_news_feed_cache_task",
        "schedule": crontab(minute="*/10"),
    },
    "send-portfolio-push": {
        "task": "finance.tasks.send_portfolio_push_notifications",
        "schedule": crontab(hour=17, minute=0),
    },
    # send-ai-nudges-daily DISABLED 2026-05-30: the batch iterated every active
    # user at 09:00 and used CioTemplate.REMINDER_MONTHLY ("A quick check-in from
    # garzoni") as the email fallback — that was the source of the daily email
    # spam users complained about. Do not re-enable without per-user rate limiting
    # AND an honest CIO unsubscribe sync (see notifications/policy.py).
    # Streak-at-risk evening sweep — fires CIO STREAK_ABOUT_TO_EXPIRE event for Journeys.
    "emit-streak-about-to-expire": {
        "task": "education.tasks.emit_streak_about_to_expire",
        "schedule": crontab(hour=19, minute=0),
    },
    # Portfolio live prices — refresh every 30 min during market hours
    "update-portfolio-prices": {
        "task": "finance.tasks.update_portfolio_prices_task",
        "schedule": crontab(minute="*/30"),
    },
    # Budgeting & Personal CFO
    "budgeting-sync-linked-accounts": {
        "task": "budgeting.tasks.sync_linked_accounts_task",
        "schedule": crontab(hour="*/6", minute=15),
    },
    "budgeting-recompute-summaries": {
        "task": "budgeting.tasks.recompute_summaries_task",
        "schedule": crontab(hour=3, minute=0),
    },
    "personal-cfo-weekly-report": {
        "task": "budgeting.tasks.send_weekly_cfo_reports",
        "schedule": crontab(hour=9, minute=0, day_of_week=1),
    },
    # Finalize expired/active duels every 5 minutes
    "finalize-due-duels": {
        "task": "gamification.tasks.finalize_due_duels",
        "schedule": crontab(minute="*/5"),
    },
}

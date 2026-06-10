from django.db import migrations


def create_periodic_tasks(apps, schema_editor):
    from django_celery_beat.models import CrontabSchedule, PeriodicTask

    def upsert_task(
        *,
        name: str,
        task: str,
        hour: str,
        minute: str = "0",
        day_of_week: str = "*",
    ) -> None:
        crontab, _ = CrontabSchedule.objects.get_or_create(
            minute=minute,
            hour=hour,
            day_of_week=day_of_week,
            day_of_month="*",
            month_of_year="*",
            timezone="Europe/London",
        )
        PeriodicTask.objects.update_or_create(
            name=name,
            defaults={
                "task": task,
                "crontab": crontab,
                "enabled": True,
            },
        )

    upsert_task(
        name="reset-inactive-streaks",
        task="education.tasks.reset_inactive_streaks",
        hour="0",
    )
    upsert_task(
        name="emit-streak-about-to-expire",
        task="education.tasks.emit_streak_about_to_expire",
        hour="19",
    )
    upsert_task(
        name="spawn-streak-rescue-missions",
        task="gamification.tasks.spawn_streak_rescue_missions",
        hour="18",
    )
    upsert_task(
        name="reset-daily-missions",
        task="gamification.models.reset_daily_missions",
        hour="0",
    )
    upsert_task(
        name="reset-weekly-missions",
        task="gamification.models.reset_weekly_missions",
        hour="0",
        day_of_week="1",
    )


def delete_periodic_tasks(apps, schema_editor):
    from django_celery_beat.models import PeriodicTask

    PeriodicTask.objects.filter(
        name__in=[
            "reset-inactive-streaks",
            "emit-streak-about-to-expire",
            "spawn-streak-rescue-missions",
            "reset-daily-missions",
            "reset-weekly-missions",
        ]
    ).delete()


class Migration(migrations.Migration):
    dependencies = [
        ("authentication", "0027_referral_reward_fields"),
        ("django_celery_beat", "0019_alter_periodictasks_options"),
    ]

    operations = [
        migrations.RunPython(create_periodic_tasks, delete_periodic_tasks),
    ]

from django.db import migrations


def create_periodic_tasks(apps, schema_editor):
    from django_celery_beat.models import CrontabSchedule, PeriodicTask

    def upsert_task(*, name: str, task: str, hour: str, minute: str = "0") -> None:
        crontab, _ = CrontabSchedule.objects.get_or_create(
            minute=minute,
            hour=hour,
            day_of_week="*",
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

    # Core reminder jobs expected in production.
    upsert_task(
        name="send-daily-email-reminders",
        task="authentication.tasks.send_email_reminders",
        hour="12",
    )
    upsert_task(
        name="send-trial-ending-reminder",
        task="authentication.tasks.send_trial_ending_reminder",
        hour="10",
    )
    upsert_task(
        name="send-renewal-reminder",
        task="authentication.tasks.send_renewal_reminder",
        hour="10",
    )
    # Notification push jobs.
    upsert_task(
        name="send-ai-nudges-daily",
        task="notifications.tasks.send_ai_nudges_batch",
        hour="9",
    )
    upsert_task(
        name="send-portfolio-push",
        task="finance.tasks.send_portfolio_push_notifications",
        hour="17",
    )


def delete_periodic_tasks(apps, schema_editor):
    from django_celery_beat.models import PeriodicTask

    PeriodicTask.objects.filter(
        name__in=[
            "send-daily-email-reminders",
            "send-trial-ending-reminder",
            "send-renewal-reminder",
            "send-ai-nudges-daily",
            "send-portfolio-push",
        ]
    ).delete()


class Migration(migrations.Migration):
    dependencies = [
        ("authentication", "0022_userprofile_path_input_hash"),
        ("django_celery_beat", "0019_alter_periodictasks_options"),
    ]

    operations = [
        migrations.RunPython(create_periodic_tasks, delete_periodic_tasks),
    ]

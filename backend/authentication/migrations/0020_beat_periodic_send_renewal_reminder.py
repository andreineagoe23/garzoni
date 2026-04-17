# Generated manually: django-celery-beat DatabaseScheduler only reads the DB, not
# settings.celery app.conf.beat_schedule — register renewal reminders in PeriodicTask.

from django.db import migrations


def create_renewal_reminder_periodic_task(apps, schema_editor):
    from django_celery_beat.models import CrontabSchedule, PeriodicTask

    crontab, _ = CrontabSchedule.objects.get_or_create(
        minute="0",
        hour="10",
        day_of_week="*",
        day_of_month="*",
        month_of_year="*",
        timezone="Europe/London",
    )
    PeriodicTask.objects.update_or_create(
        name="send-renewal-reminder",
        defaults={
            "task": "authentication.tasks.send_renewal_reminder",
            "crontab": crontab,
            "enabled": True,
        },
    )


def delete_renewal_reminder_periodic_task(apps, schema_editor):
    from django_celery_beat.models import PeriodicTask

    PeriodicTask.objects.filter(name="send-renewal-reminder").delete()


class Migration(migrations.Migration):
    dependencies = [
        ("authentication", "0019_alter_useremailpreference_push_notifications"),
        ("django_celery_beat", "0019_alter_periodictasks_options"),
    ]

    operations = [
        migrations.RunPython(
            create_renewal_reminder_periodic_task,
            delete_renewal_reminder_periodic_task,
        ),
    ]

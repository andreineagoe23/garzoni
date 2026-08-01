from django.db import migrations


def create_periodic_task(apps, schema_editor):
    from django_celery_beat.models import CrontabSchedule, PeriodicTask

    crontab, _ = CrontabSchedule.objects.get_or_create(
        minute="30",
        hour="0",
        day_of_week="*",
        day_of_month="*",
        month_of_year="*",
        timezone="Europe/London",
    )
    PeriodicTask.objects.update_or_create(
        name="resolve-streak-wagers",
        defaults={
            "task": "gamification.tasks.resolve_wagers_task",
            "crontab": crontab,
            "enabled": True,
        },
    )


def delete_periodic_task(apps, schema_editor):
    from django_celery_beat.models import PeriodicTask

    PeriodicTask.objects.filter(name="resolve-streak-wagers").delete()


class Migration(migrations.Migration):
    dependencies = [
        ("gamification", "0015_streakwager"),
        ("django_celery_beat", "0019_alter_periodictasks_options"),
    ]

    operations = [
        migrations.RunPython(create_periodic_task, delete_periodic_task),
    ]

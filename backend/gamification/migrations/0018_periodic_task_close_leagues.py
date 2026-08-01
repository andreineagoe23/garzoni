from django.db import migrations


def create_periodic_task(apps, schema_editor):
    from django_celery_beat.models import CrontabSchedule, PeriodicTask

    crontab, _ = CrontabSchedule.objects.get_or_create(
        minute="55",
        hour="23",
        day_of_week="0",
        day_of_month="*",
        month_of_year="*",
        timezone="Europe/London",
    )
    PeriodicTask.objects.update_or_create(
        name="close-leagues-week",
        defaults={
            "task": "gamification.tasks.close_leagues_week",
            "crontab": crontab,
            "enabled": True,
        },
    )


def delete_periodic_task(apps, schema_editor):
    from django_celery_beat.models import PeriodicTask

    PeriodicTask.objects.filter(name="close-leagues-week").delete()


class Migration(migrations.Migration):
    dependencies = [
        ("gamification", "0017_leagues"),
        ("django_celery_beat", "0019_alter_periodictasks_options"),
    ]

    operations = [
        migrations.RunPython(create_periodic_task, delete_periodic_task),
    ]

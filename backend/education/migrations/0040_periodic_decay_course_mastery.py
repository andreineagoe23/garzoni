from django.db import migrations


def create_periodic_task(apps, schema_editor):
    from django_celery_beat.models import CrontabSchedule, PeriodicTask

    crontab, _ = CrontabSchedule.objects.get_or_create(
        minute="20",
        hour="3",
        day_of_week="*",
        day_of_month="*",
        month_of_year="*",
        timezone="Europe/London",
    )
    PeriodicTask.objects.update_or_create(
        name="decay-course-mastery-daily",
        defaults={
            "task": "education.tasks.decay_course_mastery",
            "crontab": crontab,
            "enabled": True,
        },
    )


def delete_periodic_task(apps, schema_editor):
    from django_celery_beat.models import PeriodicTask

    PeriodicTask.objects.filter(name="decay-course-mastery-daily").delete()


class Migration(migrations.Migration):
    dependencies = [
        ("education", "0039_course_keyed_mastery"),
        ("django_celery_beat", "0019_alter_periodictasks_options"),
    ]

    operations = [
        migrations.RunPython(create_periodic_task, delete_periodic_task),
    ]

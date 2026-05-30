from django.db import migrations


def disable_ai_nudges_daily(apps, schema_editor):
    from django_celery_beat.models import PeriodicTask

    PeriodicTask.objects.filter(name="send-ai-nudges-daily").update(enabled=False)


def reenable_ai_nudges_daily(apps, schema_editor):
    from django_celery_beat.models import PeriodicTask

    PeriodicTask.objects.filter(name="send-ai-nudges-daily").update(enabled=True)


class Migration(migrations.Migration):
    dependencies = [
        ("authentication", "0024_alter_userprofile_trial_end"),
        ("django_celery_beat", "0019_alter_periodictasks_options"),
    ]

    operations = [
        migrations.RunPython(disable_ai_nudges_daily, reenable_ai_nudges_daily),
    ]

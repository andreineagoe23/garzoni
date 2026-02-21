# Generated manually: migrate email_reminder_preference "daily" -> "weekly" before removing daily option

from django.db import migrations


def daily_to_weekly(apps, schema_editor):
    UserProfile = apps.get_model("authentication", "UserProfile")
    UserProfile.objects.filter(email_reminder_preference="daily").update(
        email_reminder_preference="weekly"
    )


def noop(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("authentication", "0009_userprofile_stripe_subscription_id"),
    ]

    operations = [
        migrations.RunPython(daily_to_weekly, noop),
    ]

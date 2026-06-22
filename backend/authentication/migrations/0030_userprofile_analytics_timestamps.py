from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("authentication", "0029_userprofile_signup_platform"),
    ]

    operations = [
        migrations.AddField(
            model_name="userprofile",
            name="last_seen_platform",
            field=models.CharField(blank=True, default="", max_length=16),
        ),
        migrations.AddField(
            model_name="userprofile",
            name="onboarding_completed_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="userprofile",
            name="first_lesson_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
    ]

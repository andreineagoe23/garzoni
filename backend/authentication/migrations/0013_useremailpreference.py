from django.db import migrations, models


def seed_email_preferences(apps, schema_editor):
    User = apps.get_model("auth", "User")
    UserProfile = apps.get_model("authentication", "UserProfile")
    UserEmailPreference = apps.get_model("authentication", "UserEmailPreference")

    for user in User.objects.all().iterator():
        profile = UserProfile.objects.filter(user_id=user.id).first()
        frequency = "weekly"
        if profile and profile.email_reminder_preference in {"none", "weekly", "monthly"}:
            frequency = profile.email_reminder_preference
        UserEmailPreference.objects.get_or_create(
            user_id=user.id,
            defaults={
                "reminders": frequency != "none",
                "streak_alerts": True,
                "weekly_digest": True,
                "billing_alerts": True,
                "marketing": False,
                "reminder_frequency": frequency,
            },
        )


class Migration(migrations.Migration):
    dependencies = [
        ("authentication", "0012_userprofile_stripe_customer_id"),
    ]

    operations = [
        migrations.CreateModel(
            name="UserEmailPreference",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True, primary_key=True, serialize=False, verbose_name="ID"
                    ),
                ),
                ("reminders", models.BooleanField(default=True)),
                ("streak_alerts", models.BooleanField(default=True)),
                ("weekly_digest", models.BooleanField(default=True)),
                ("billing_alerts", models.BooleanField(default=True)),
                ("marketing", models.BooleanField(default=False)),
                (
                    "reminder_frequency",
                    models.CharField(
                        choices=[
                            ("none", "No Reminders"),
                            ("weekly", "Weekly"),
                            ("monthly", "Monthly"),
                        ],
                        default="weekly",
                        max_length=10,
                    ),
                ),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "user",
                    models.OneToOneField(
                        on_delete=models.deletion.CASCADE,
                        related_name="email_preferences",
                        to="auth.user",
                    ),
                ),
            ],
            options={"db_table": "core_useremailpreference"},
        ),
        migrations.RunPython(seed_email_preferences, migrations.RunPython.noop),
    ]

from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("authentication", "0017_alter_userprofile_profile_avatar"),
    ]

    operations = [
        migrations.AddField(
            model_name="useremailpreference",
            name="push_notifications",
            field=models.BooleanField(
                default=True,
                help_text="Allow push notifications (operational + product); enforced server-side before push send.",
            ),
        ),
    ]

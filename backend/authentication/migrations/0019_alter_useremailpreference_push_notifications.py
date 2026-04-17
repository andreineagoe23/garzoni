from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("authentication", "0018_useremailpreference_push_notifications"),
    ]

    operations = [
        migrations.AlterField(
            model_name="useremailpreference",
            name="push_notifications",
            field=models.BooleanField(
                default=True,
                help_text="Allow push notifications; enforced in NotificationService before transactional push.",
            ),
        ),
    ]

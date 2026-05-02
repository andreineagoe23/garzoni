from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("authentication", "0021_default_weekly_email_reminder"),
    ]

    operations = [
        migrations.AddField(
            model_name="userprofile",
            name="path_input_hash",
            field=models.CharField(blank=True, default="", max_length=32),
        ),
    ]

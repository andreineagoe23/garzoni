from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("authentication", "0015_userprofile_expo_push_token"),
    ]

    operations = [
        migrations.AddField(
            model_name="userprofile",
            name="apple_sub",
            field=models.CharField(
                blank=True,
                db_index=True,
                max_length=255,
                null=True,
                unique=True,
            ),
        ),
    ]

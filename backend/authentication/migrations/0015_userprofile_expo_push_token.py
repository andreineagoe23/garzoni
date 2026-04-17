from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("authentication", "0014_userprofile_recommendations_generated_at"),
    ]

    operations = [
        migrations.AddField(
            model_name="userprofile",
            name="expo_push_token",
            field=models.CharField(blank=True, max_length=200, null=True),
        ),
    ]

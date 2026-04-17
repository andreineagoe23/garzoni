from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("authentication", "0013_useremailpreference"),
    ]

    operations = [
        migrations.AddField(
            model_name="userprofile",
            name="recommendations_generated_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
    ]

from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("education", "0006_multiplechoicechoice"),
    ]

    operations = [
        migrations.AddIndex(
            model_name="mastery",
            index=models.Index(fields=["user", "due_at"], name="mastery_user_due_idx"),
        ),
    ]

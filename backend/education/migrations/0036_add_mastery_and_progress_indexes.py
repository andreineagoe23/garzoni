# Generated manually — mirrors Meta.indexes on Mastery and UserExerciseProgress.

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("education", "0035_userprogress_user_course_index"),
    ]

    operations = [
        migrations.AddIndex(
            model_name="mastery",
            index=models.Index(fields=["user", "due_at"], name="mastery_user_due_idx"),
        ),
        migrations.AddIndex(
            model_name="userexerciseprogress",
            index=models.Index(
                fields=["user", "completed"],
                name="progress_user_completed_idx",
            ),
        ),
    ]

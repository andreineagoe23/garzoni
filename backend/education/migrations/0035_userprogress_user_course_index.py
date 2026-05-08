from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("education", "0034_path_plan"),
    ]

    operations = [
        migrations.AddIndex(
            model_name="userprogress",
            index=models.Index(
                fields=["user", "course"],
                name="userprogress_user_course_idx",
            ),
        ),
    ]

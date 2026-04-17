from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ("education", "0024_add_source_hash_to_translations"),
    ]

    operations = [
        migrations.RenameField(
            model_name="userprogress",
            old_name="streak",
            new_name="learning_session_count",
        ),
        migrations.RenameField(
            model_name="userprogress",
            old_name="last_completed_date",
            new_name="last_course_activity_date",
        ),
    ]

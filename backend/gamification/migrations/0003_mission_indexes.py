from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("gamification", "0002_mission_is_template_mission_max_difficulty_and_more"),
    ]

    operations = [
        migrations.AddIndex(
            model_name="missioncompletion",
            index=models.Index(fields=["user", "status"], name="missioncomp_user_status_idx"),
        ),
        migrations.AddIndex(
            model_name="missioncompletion",
            index=models.Index(
                fields=["user", "mission", "status"], name="missioncomp_user_mstat_idx"
            ),
        ),
        migrations.AddIndex(
            model_name="missioncompletion",
            index=models.Index(fields=["completed_at"], name="missioncomp_completed_idx"),
        ),
        migrations.AddIndex(
            model_name="missionperformance",
            index=models.Index(fields=["user", "created_at"], name="missionperf_user_created_idx"),
        ),
    ]

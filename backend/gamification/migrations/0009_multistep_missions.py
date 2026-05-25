from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion
import django.utils.timezone


def seed_budgeters_week(apps, schema_editor):
    MultiStepMission = apps.get_model("gamification", "MultiStepMission")
    MultiStepMission.objects.get_or_create(
        slug="budgeters-week",
        defaults={
            "name": "The Budgeter's Week",
            "description": "A weekly quest that connects budgeting lessons, practice, tools, and coach reflection.",
            "mission_type": "weekly",
            "points_reward": 200,
            "badge_name": "Budgeting Master",
            "steps": [
                {
                    "id": "lesson-budgeting",
                    "type": "lesson",
                    "title": "Read the Budgeting lesson",
                    "course_topic": "budgeting",
                    "route": "/all-topics?topic=budgeting",
                },
                {
                    "id": "practice-budgeting",
                    "type": "exercise",
                    "title": "Complete 5 Budgeting exercises",
                    "exercise_category": "Budgeting",
                    "target_count": 5,
                    "route": "/exercises?skill=Budgeting&intentReason=mission_step",
                },
                {
                    "id": "tool-budget-planner",
                    "type": "tool",
                    "title": "Set up your Budget Planner",
                    "tool_slug": "budget-planner",
                    "route": "/tools/budget-planner",
                },
                {
                    "id": "coach-reflection",
                    "type": "chat",
                    "title": "Reflect with Garzoni",
                    "chat_prompt": "Help me reflect on what I learned about budgeting this week.",
                    "route": "/chat?preseededMessage=Help%20me%20reflect%20on%20budgeting",
                },
            ],
        },
    )


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("gamification", "0008_first_investor_badge"),
    ]

    operations = [
        migrations.CreateModel(
            name="MultiStepMission",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("name", models.CharField(max_length=120)),
                ("slug", models.SlugField(max_length=140, unique=True)),
                ("description", models.TextField()),
                ("mission_type", models.CharField(choices=[("weekly", "Weekly"), ("campaign", "Campaign")], default="weekly", max_length=20)),
                ("steps", models.JSONField(blank=True, default=list)),
                ("points_reward", models.IntegerField(default=0)),
                ("badge_name", models.CharField(blank=True, default="", max_length=120)),
                ("is_active", models.BooleanField(default=True)),
                ("starts_at", models.DateTimeField(blank=True, null=True)),
                ("ends_at", models.DateTimeField(blank=True, null=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
            ],
            options={
                "db_table": "core_multistepmission",
            },
        ),
        migrations.CreateModel(
            name="MultiStepMissionProgress",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("completed_steps", models.JSONField(blank=True, default=list)),
                ("status", models.CharField(choices=[("not_started", "Not Started"), ("in_progress", "In Progress"), ("completed", "Completed")], default="not_started", max_length=20)),
                ("started_at", models.DateTimeField(default=django.utils.timezone.now)),
                ("completed_at", models.DateTimeField(blank=True, null=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("mission", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="progress_rows", to="gamification.multistepmission")),
                ("user", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="multi_step_mission_progress", to=settings.AUTH_USER_MODEL)),
            ],
            options={
                "db_table": "core_multistepmissionprogress",
                "unique_together": {("user", "mission")},
            },
        ),
        migrations.AddIndex(
            model_name="multistepmission",
            index=models.Index(fields=["is_active", "mission_type"], name="core_multis_is_acti_3bbf1d_idx"),
        ),
        migrations.AddIndex(
            model_name="multistepmission",
            index=models.Index(fields=["starts_at", "ends_at"], name="core_multis_starts__d9fcb9_idx"),
        ),
        migrations.AddIndex(
            model_name="multistepmissionprogress",
            index=models.Index(fields=["user", "status"], name="core_multis_user_id_e7907a_idx"),
        ),
        migrations.AddIndex(
            model_name="multistepmissionprogress",
            index=models.Index(fields=["mission", "status"], name="core_multis_mission_e190d9_idx"),
        ),
        migrations.RunPython(seed_budgeters_week, migrations.RunPython.noop),
    ]

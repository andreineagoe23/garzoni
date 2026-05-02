from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("education", "0033_content_embedding"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="PathPlan",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False)),
                ("rank", models.PositiveSmallIntegerField(default=1)),
                ("reason", models.TextField(blank=True, default="")),
                ("micro_goal", models.CharField(blank=True, default="", max_length=300)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "course",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="path_plans",
                        to="education.course",
                    ),
                ),
                (
                    "user",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="path_plans",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "db_table": "education_path_plan",
                "ordering": ["rank"],
            },
        ),
        migrations.AlterUniqueTogether(
            name="pathplan",
            unique_together={("user", "course")},
        ),
    ]

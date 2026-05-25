from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("education", "0038_add_mastery_snapshot"),
    ]

    operations = [
        migrations.AddField(
            model_name="mastery",
            name="course",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="masteries",
                to="education.course",
            ),
        ),
        migrations.AddField(
            model_name="mastery",
            name="legacy",
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name="masterysnapshot",
            name="course",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="mastery_snapshots",
                to="education.course",
            ),
        ),
        migrations.AddIndex(
            model_name="mastery",
            index=models.Index(fields=["user", "course"], name="mastery_user_course_idx"),
        ),
        migrations.AddIndex(
            model_name="masterysnapshot",
            index=models.Index(
                fields=["user", "course", "recorded_on"],
                name="snap_user_course_date_idx",
            ),
        ),
        migrations.AddConstraint(
            model_name="mastery",
            constraint=models.UniqueConstraint(
                condition=models.Q(("course__isnull", False)),
                fields=("user", "course"),
                name="uniq_mastery_user_course",
            ),
        ),
        migrations.AddConstraint(
            model_name="masterysnapshot",
            constraint=models.UniqueConstraint(
                condition=models.Q(("course__isnull", False)),
                fields=("user", "course", "recorded_on"),
                name="uniq_snapshot_user_course_day",
            ),
        ),
    ]

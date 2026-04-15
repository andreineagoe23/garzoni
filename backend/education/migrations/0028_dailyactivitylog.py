from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


def _backfill_daily_activity_log(apps, schema_editor):
    DailyActivityLog = apps.get_model("education", "DailyActivityLog")
    LessonCompletion = apps.get_model("education", "LessonCompletion")
    SectionCompletion = apps.get_model("education", "SectionCompletion")
    ExerciseCompletion = apps.get_model("education", "ExerciseCompletion")
    QuizCompletion = apps.get_model("education", "QuizCompletion")

    # lesson completions
    lesson_rows = (
        LessonCompletion.objects.values(
            "user_progress__user_id",
            "lesson_id",
            "lesson__course_id",
            "completed_at__date",
        )
        .order_by()
        .distinct()
    )
    DailyActivityLog.objects.bulk_create(
        [
            DailyActivityLog(
                user_id=row["user_progress__user_id"],
                activity_type="lesson",
                object_id=row["lesson_id"],
                course_id=row["lesson__course_id"],
                date=row["completed_at__date"],
            )
            for row in lesson_rows
            if row["user_progress__user_id"]
        ],
        ignore_conflicts=True,
    )

    # section completions
    section_rows = (
        SectionCompletion.objects.values(
            "user_progress__user_id",
            "section_id",
            "section__lesson__course_id",
            "completed_at__date",
        )
        .order_by()
        .distinct()
    )
    DailyActivityLog.objects.bulk_create(
        [
            DailyActivityLog(
                user_id=row["user_progress__user_id"],
                activity_type="section",
                object_id=row["section_id"],
                course_id=row["section__lesson__course_id"],
                date=row["completed_at__date"],
            )
            for row in section_rows
            if row["user_progress__user_id"]
        ],
        ignore_conflicts=True,
    )

    # exercise completions (log once per exercise regardless of section)
    exercise_rows = (
        ExerciseCompletion.objects.values("user_id", "exercise_id", "completed_at__date")
        .order_by()
        .distinct()
    )
    DailyActivityLog.objects.bulk_create(
        [
            DailyActivityLog(
                user_id=row["user_id"],
                activity_type="exercise",
                object_id=row["exercise_id"],
                date=row["completed_at__date"],
            )
            for row in exercise_rows
            if row["user_id"]
        ],
        ignore_conflicts=True,
    )

    # quiz completions
    quiz_rows = (
        QuizCompletion.objects.values("user_id", "quiz_id", "quiz__course_id", "completed_at__date")
        .order_by()
        .distinct()
    )
    DailyActivityLog.objects.bulk_create(
        [
            DailyActivityLog(
                user_id=row["user_id"],
                activity_type="quiz",
                object_id=row["quiz_id"],
                course_id=row["quiz__course_id"],
                date=row["completed_at__date"],
            )
            for row in quiz_rows
            if row["user_id"]
        ],
        ignore_conflicts=True,
    )


class Migration(migrations.Migration):
    dependencies = [
        ("education", "0027_quiz_lesson_checkpoint_fields"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="DailyActivityLog",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name="ID",
                    ),
                ),
                (
                    "activity_type",
                    models.CharField(
                        choices=[
                            ("section", "Section"),
                            ("lesson", "Lesson"),
                            ("exercise", "Exercise"),
                            ("quiz", "Quiz"),
                        ],
                        max_length=20,
                    ),
                ),
                ("object_id", models.PositiveIntegerField()),
                ("date", models.DateField()),
                (
                    "course",
                    models.ForeignKey(
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        to="education.course",
                    ),
                ),
                (
                    "user",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE, to=settings.AUTH_USER_MODEL
                    ),
                ),
            ],
            options={
                "db_table": "education_daily_activity_log",
                "indexes": [
                    models.Index(fields=["user", "date"], name="education_d_user_id_534fd8_idx"),
                    models.Index(
                        fields=["user", "activity_type", "date"],
                        name="education_d_user_id_970679_idx",
                    ),
                ],
                "unique_together": {("user", "activity_type", "object_id")},
            },
        ),
        migrations.RunPython(_backfill_daily_activity_log, migrations.RunPython.noop),
    ]

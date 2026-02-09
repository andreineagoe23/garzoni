from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [
        ("education", "0013_path_access_tier_and_order"),
    ]

    operations = [
        migrations.CreateModel(
            name="PathTranslation",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True, primary_key=True, serialize=False, verbose_name="ID"
                    ),
                ),
                ("language", models.CharField(db_index=True, max_length=10)),
                ("title", models.CharField(max_length=100)),
                ("description", models.TextField()),
                (
                    "path",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="translations",
                        to="education.path",
                    ),
                ),
            ],
            options={
                "db_table": "education_path_translation",
                "unique_together": {("path", "language")},
            },
        ),
        migrations.CreateModel(
            name="CourseTranslation",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True, primary_key=True, serialize=False, verbose_name="ID"
                    ),
                ),
                ("language", models.CharField(db_index=True, max_length=10)),
                ("title", models.CharField(max_length=200)),
                ("description", models.TextField()),
                (
                    "course",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="translations",
                        to="education.course",
                    ),
                ),
            ],
            options={
                "db_table": "education_course_translation",
                "unique_together": {("course", "language")},
            },
        ),
        migrations.CreateModel(
            name="LessonTranslation",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True, primary_key=True, serialize=False, verbose_name="ID"
                    ),
                ),
                ("language", models.CharField(db_index=True, max_length=10)),
                ("title", models.CharField(max_length=200)),
                ("short_description", models.TextField(blank=True)),
                ("detailed_content", models.TextField(blank=True)),
                (
                    "lesson",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="translations",
                        to="education.lesson",
                    ),
                ),
            ],
            options={
                "db_table": "education_lesson_translation",
                "unique_together": {("lesson", "language")},
            },
        ),
        migrations.CreateModel(
            name="LessonSectionTranslation",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True, primary_key=True, serialize=False, verbose_name="ID"
                    ),
                ),
                ("language", models.CharField(db_index=True, max_length=10)),
                ("title", models.CharField(max_length=200)),
                ("text_content", models.TextField(blank=True, null=True)),
                ("exercise_data", models.JSONField(blank=True, null=True)),
                (
                    "section",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="translations",
                        to="education.lessonsection",
                    ),
                ),
            ],
            options={
                "db_table": "education_lessonsection_translation",
                "unique_together": {("section", "language")},
            },
        ),
        migrations.CreateModel(
            name="QuizTranslation",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True, primary_key=True, serialize=False, verbose_name="ID"
                    ),
                ),
                ("language", models.CharField(db_index=True, max_length=10)),
                ("title", models.CharField(max_length=200)),
                ("question", models.TextField()),
                ("choices", models.JSONField()),
                ("correct_answer", models.CharField(max_length=200)),
                (
                    "quiz",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="translations",
                        to="education.quiz",
                    ),
                ),
            ],
            options={
                "db_table": "education_quiz_translation",
                "unique_together": {("quiz", "language")},
            },
        ),
        migrations.CreateModel(
            name="ExerciseTranslation",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True, primary_key=True, serialize=False, verbose_name="ID"
                    ),
                ),
                ("language", models.CharField(db_index=True, max_length=10)),
                ("question", models.TextField()),
                ("exercise_data", models.JSONField(blank=True, null=True)),
                (
                    "exercise",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="translations",
                        to="education.exercise",
                    ),
                ),
            ],
            options={
                "db_table": "education_exercise_translation",
                "unique_together": {("exercise", "language")},
            },
        ),
    ]

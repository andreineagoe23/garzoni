# Generated manually for lesson checkpoint quizzes.

import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("education", "0026_alter_userprogress_learning_session_count"),
    ]

    operations = [
        migrations.AddField(
            model_name="quiz",
            name="lesson",
            field=models.ForeignKey(
                blank=True,
                help_text="When set, this quiz belongs to a lesson checkpoint (not the course capstone).",
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name="checkpoint_quizzes",
                to="education.lesson",
            ),
        ),
        migrations.AddField(
            model_name="quiz",
            name="source_lesson_section",
            field=models.OneToOneField(
                blank=True,
                help_text="Lesson section this checkpoint question was materialized from.",
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name="sourced_checkpoint_quiz",
                to="education.lessonsection",
            ),
        ),
    ]

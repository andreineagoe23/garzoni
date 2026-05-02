from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("education", "0032_strip_inline_recommended_video"),
    ]

    operations = [
        migrations.CreateModel(
            name="ContentEmbedding",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True, primary_key=True, serialize=False, verbose_name="ID"
                    ),
                ),
                (
                    "content_type",
                    models.CharField(
                        choices=[
                            ("lesson", "Lesson"),
                            ("course", "Course"),
                            ("section", "Section"),
                            ("skill", "Skill"),
                        ],
                        db_index=True,
                        max_length=16,
                    ),
                ),
                ("content_id", models.PositiveIntegerField(db_index=True)),
                ("title", models.CharField(max_length=300)),
                ("body_snippet", models.TextField(blank=True, default="")),
                (
                    "embedding",
                    models.JSONField(help_text="List[float] from text-embedding-3-small (1536-d)"),
                ),
                (
                    "embedding_model",
                    models.CharField(default="text-embedding-3-small", max_length=64),
                ),
                ("updated_at", models.DateTimeField(auto_now=True)),
            ],
            options={
                "db_table": "education_content_embedding",
            },
        ),
        migrations.AlterUniqueTogether(
            name="contentembedding",
            unique_together={("content_type", "content_id")},
        ),
        migrations.AddIndex(
            model_name="contentembedding",
            index=models.Index(
                fields=["content_type", "updated_at"],
                name="education_c_content_160b99_idx",
            ),
        ),
    ]

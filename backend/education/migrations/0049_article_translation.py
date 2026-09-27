import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("education", "0048_restrict_free_tier_to_basic_finance"),
    ]

    operations = [
        migrations.CreateModel(
            name="ArticleTranslation",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True, primary_key=True, serialize=False, verbose_name="ID"
                    ),
                ),
                ("language", models.CharField(db_index=True, max_length=10)),
                ("title", models.CharField(max_length=200)),
                ("meta_description", models.TextField(blank=True)),
                ("excerpt", models.TextField(blank=True)),
                ("content", models.TextField(blank=True)),
                ("faq", models.JSONField(blank=True, null=True)),
                ("item_list", models.JSONField(blank=True, null=True)),
                (
                    "source_hash",
                    models.CharField(
                        blank=True,
                        default="",
                        help_text=(
                            "Hash of the English source at translation time, used for "
                            "staleness detection."
                        ),
                        max_length=32,
                    ),
                ),
                (
                    "article",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="translations",
                        to="education.article",
                    ),
                ),
            ],
            options={
                "db_table": "education_article_translation",
                "unique_together": {("article", "language")},
            },
        ),
    ]

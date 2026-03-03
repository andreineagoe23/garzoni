from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("education", "0021_final_remove_best_reflects_filler_sections"),
    ]

    operations = [
        migrations.AddField(
            model_name="lessonsection",
            name="source_label",
            field=models.CharField(
                max_length=255,
                blank=True,
                help_text="Optional short attribution or source name for this section's content.",
            ),
        ),
        migrations.AddField(
            model_name="lessonsection",
            name="source_url",
            field=models.URLField(
                blank=True,
                null=True,
                help_text="Optional link to the primary source or reference for this section.",
            ),
        ),
    ]

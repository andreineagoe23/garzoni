# Phase 5 (SEO growth content): roundup/alternatives categories + ItemList data.

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("education", "0045_article"),
    ]

    operations = [
        migrations.AddField(
            model_name="article",
            name="item_list",
            field=models.JSONField(blank=True, null=True),
        ),
        migrations.AlterField(
            model_name="article",
            name="category",
            field=models.CharField(
                choices=[
                    ("guide", "Guide"),
                    ("comparison", "Comparison"),
                    ("roundup", "Roundup / Best-of listicle"),
                    ("alternatives", "Alternatives"),
                    ("answer", "Answer / FAQ"),
                ],
                db_index=True,
                default="guide",
                max_length=20,
            ),
        ),
    ]

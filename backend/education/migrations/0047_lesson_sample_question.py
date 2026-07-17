# UX Phase 3 (plan §3.1): guest-taste sample question teaser on public lessons.

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("education", "0046_article_item_list_and_categories"),
    ]

    operations = [
        migrations.AddField(
            model_name="lesson",
            name="sample_question",
            field=models.JSONField(blank=True, null=True),
        ),
    ]

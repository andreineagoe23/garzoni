from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("education", "0023_contentreleasestate"),
    ]

    operations = [
        migrations.AddField(
            model_name="pathtranslation",
            name="source_hash",
            field=models.CharField(
                blank=True,
                default="",
                help_text="Hash of the English source at translation time, used for staleness detection.",
                max_length=32,
            ),
        ),
        migrations.AddField(
            model_name="coursetranslation",
            name="source_hash",
            field=models.CharField(
                blank=True,
                default="",
                help_text="Hash of the English source at translation time, used for staleness detection.",
                max_length=32,
            ),
        ),
        migrations.AddField(
            model_name="lessontranslation",
            name="source_hash",
            field=models.CharField(
                blank=True,
                default="",
                help_text="Hash of the English source at translation time, used for staleness detection.",
                max_length=32,
            ),
        ),
        migrations.AddField(
            model_name="lessonsectiontranslation",
            name="source_hash",
            field=models.CharField(
                blank=True,
                default="",
                help_text="Hash of the English source at translation time, used for staleness detection.",
                max_length=32,
            ),
        ),
    ]

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('education', '0002_mastery'),
        ('education', '0002_lessonsection_is_published_lessonsection_updated_at_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='exercise',
            name='error_patterns',
            field=models.JSONField(blank=True, default=list),
        ),
        migrations.AddField(
            model_name='exercise',
            name='is_published',
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name='exercise',
            name='misconception_tags',
            field=models.JSONField(blank=True, default=list),
        ),
        migrations.AddField(
            model_name='exercise',
            name='version',
            field=models.PositiveIntegerField(default=1, help_text='Immutable version for published exercises'),
        ),
    ]

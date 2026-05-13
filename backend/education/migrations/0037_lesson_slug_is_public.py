from django.db import migrations, models
from django.utils.text import slugify


def populate_lesson_slugs(apps, schema_editor):
    Lesson = apps.get_model("education", "Lesson")
    used = set(Lesson.objects.exclude(slug="").values_list("slug", flat=True))
    for lesson in Lesson.objects.filter(slug=""):
        base = slugify(lesson.title)[:200] or f"lesson-{lesson.pk}"
        candidate = base
        n = 2
        while candidate in used:
            candidate = f"{base}-{n}"[:220]
            n += 1
        used.add(candidate)
        lesson.slug = candidate
        lesson.save(update_fields=["slug"])


def noop_reverse(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("education", "0036_add_mastery_and_progress_indexes"),
    ]

    operations = [
        migrations.AddField(
            model_name="lesson",
            name="slug",
            # SlugField has db_index=True by default. Since this migration later
            # alters the same field to unique=True (which creates its own index),
            # keep the initial add unindexed to avoid duplicate *_like index
            # creation on PostgreSQL during a fresh migrate.
            field=models.SlugField(blank=True, db_index=False, max_length=220),
        ),
        migrations.AddField(
            model_name="lesson",
            name="is_public",
            field=models.BooleanField(db_index=True, default=False),
        ),
        migrations.RunPython(populate_lesson_slugs, noop_reverse),
        migrations.AlterField(
            model_name="lesson",
            name="slug",
            field=models.SlugField(blank=True, max_length=220, unique=True),
        ),
    ]

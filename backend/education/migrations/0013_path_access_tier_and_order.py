from django.db import migrations, models


def seed_path_access_tiers(apps, schema_editor):
    Path = apps.get_model("education", "Path")
    tier_map = {
        "Basic Finance": ("starter", 1),
        "Financial Mindset": ("starter", 2),
        "Personal Finance": ("plus", 3),
        "Real Estate": ("plus", 4),
        "Crypto": ("pro", 5),
        "Forex": ("pro", 6),
    }
    for path in Path.objects.all():
        tier, order = tier_map.get(path.title, ("starter", 0))
        path.access_tier = tier
        path.sort_order = order
        path.save(update_fields=["access_tier", "sort_order"])


def clear_path_access_tiers(apps, schema_editor):
    Path = apps.get_model("education", "Path")
    Path.objects.update(access_tier="starter", sort_order=0)


class Migration(migrations.Migration):
    dependencies = [
        ("education", "0012_ensure_exercise_misconception_tags"),
    ]

    operations = [
        migrations.AddField(
            model_name="path",
            name="access_tier",
            field=models.CharField(
                choices=[("starter", "Starter"), ("plus", "Plus"), ("pro", "Pro")],
                default="starter",
                help_text="Minimum subscription tier required to access this path.",
                max_length=16,
            ),
        ),
        migrations.AddField(
            model_name="path",
            name="sort_order",
            field=models.PositiveSmallIntegerField(default=0),
        ),
        migrations.RunPython(seed_path_access_tiers, clear_path_access_tiers),
    ]

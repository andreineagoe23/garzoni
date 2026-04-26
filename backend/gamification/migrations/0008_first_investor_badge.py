from django.db import migrations


def create_first_investor_badge(apps, schema_editor):
    Badge = apps.get_model("gamification", "Badge")
    Badge.objects.get_or_create(
        criteria_slug="first_paper_trade",
        defaults={
            "name": "First Investor",
            "description": "Made your first virtual trade on Garzoni.",
            "image": "badges/first_investor.png",
            "criteria_type": "missions_completed",
            "threshold": 1,
            "badge_level": "bronze",
            "is_active": True,
        },
    )


class Migration(migrations.Migration):

    dependencies = [
        ("gamification", "0007_mission_cycles_badge_slug_and_constraints"),
    ]

    operations = [
        migrations.RunPython(create_first_investor_badge, migrations.RunPython.noop),
    ]

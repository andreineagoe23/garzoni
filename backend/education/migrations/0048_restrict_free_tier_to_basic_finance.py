from django.db import migrations

# New policy: the free tier is exactly one path.
#
#   starter  Basic Finance
#   plus     + Personal Finance, Everyday Money Skills, Financial Mindset
#   pro      everything else (Real Estate, Crypto, Forex)
#
# Free accounts could previously open most of the catalogue while the
# personalized path handed them a single lesson — generous in the wrong place
# and stingy in the one that mattered.
#
# Matched on title rather than pk because path ids differ across environments.
# Deliberately not grandfathered: the product owner confirmed there are no
# recurring users to protect, so everyone lands on the new tiers at once.
RETIER = {
    "Financial Mindset": ("starter", "plus"),
    "Everyday Money Skills": ("starter", "plus"),
    "Real Estate": ("plus", "pro"),
}


def apply_tiers(apps, schema_editor):
    Path = apps.get_model("education", "Path")
    for title, (_old, new) in RETIER.items():
        Path.objects.filter(title__iexact=title).update(access_tier=new)


def revert_tiers(apps, schema_editor):
    Path = apps.get_model("education", "Path")
    for title, (old, _new) in RETIER.items():
        Path.objects.filter(title__iexact=title).update(access_tier=old)


class Migration(migrations.Migration):
    dependencies = [
        ("education", "0047_lesson_sample_question"),
    ]

    operations = [
        migrations.RunPython(apply_tiers, revert_tiers),
    ]

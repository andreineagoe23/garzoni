from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [
        ("core", "0009_auto_20251118_2130"),
    ]

    operations = [
        # Legacy core models were moved to domain apps.
        # This checkpoint keeps core migration history explicit and stable.
    ]

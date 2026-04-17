import django.utils.timezone
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("education", "0029_backfill_activity_from_sectioncompletion"),
    ]

    operations = [
        migrations.RenameIndex(
            model_name="dailyactivitylog",
            new_name="education_d_user_id_fc5997_idx",
            old_name="education_d_user_id_534fd8_idx",
        ),
        migrations.RenameIndex(
            model_name="dailyactivitylog",
            new_name="education_d_user_id_ea35fb_idx",
            old_name="education_d_user_id_970679_idx",
        ),
        migrations.AlterField(
            model_name="dailyactivitylog",
            name="date",
            field=models.DateField(default=django.utils.timezone.localdate),
        ),
    ]

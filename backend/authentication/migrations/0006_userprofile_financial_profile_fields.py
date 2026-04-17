from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("authentication", "0005_ensure_userprofile_boolean_defaults"),
    ]

    operations = [
        migrations.AddField(
            model_name="userprofile",
            name="goal_types",
            field=models.JSONField(blank=True, default=list),
        ),
        migrations.AddField(
            model_name="userprofile",
            name="timeframe",
            field=models.CharField(blank=True, default="", max_length=32),
        ),
        migrations.AddField(
            model_name="userprofile",
            name="risk_comfort",
            field=models.CharField(blank=True, default="", max_length=32),
        ),
        migrations.AddField(
            model_name="userprofile",
            name="income_range",
            field=models.CharField(blank=True, default="", max_length=64),
        ),
        migrations.AddField(
            model_name="userprofile",
            name="savings_rate_estimate",
            field=models.CharField(blank=True, default="", max_length=32),
        ),
        migrations.AddField(
            model_name="userprofile",
            name="investing_experience",
            field=models.CharField(blank=True, default="", max_length=32),
        ),
    ]

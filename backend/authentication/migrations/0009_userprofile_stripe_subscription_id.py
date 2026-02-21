# Generated manually for subscription webhook updates (trial ended → active)

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("authentication", "0008_userprofile_trial_end"),
    ]

    operations = [
        migrations.AddField(
            model_name="userprofile",
            name="stripe_subscription_id",
            field=models.CharField(
                blank=True,
                db_index=True,
                help_text="Stripe subscription ID for webhook updates (e.g. trial ended).",
                max_length=255,
                null=True,
            ),
        ),
    ]

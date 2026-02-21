# Generated manually for trial-end tracking (7-day trial on yearly plans)

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("authentication", "0007_userprofile_subscription_plan_id"),
    ]

    operations = [
        migrations.AddField(
            model_name="userprofile",
            name="trial_end",
            field=models.DateTimeField(
                blank=True,
                help_text="When the subscription trial ends (from Stripe); used for day-5 reminder.",
                null=True,
            ),
        ),
    ]

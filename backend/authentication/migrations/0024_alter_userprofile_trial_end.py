# trial_end help_text: Stripe or RevenueCat; trial-ending emails

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("authentication", "0023_periodic_tasks_notifications_push"),
    ]

    operations = [
        migrations.AlterField(
            model_name="userprofile",
            name="trial_end",
            field=models.DateTimeField(
                blank=True,
                help_text="When the subscription trial ends (Stripe or RevenueCat); used for trial-ending reminder emails.",
                null=True,
            ),
        ),
    ]

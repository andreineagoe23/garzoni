# Generated manually for stripe_customer_id

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("authentication", "0011_alter_userprofile_email_reminder_preference"),
    ]

    operations = [
        migrations.AddField(
            model_name="userprofile",
            name="stripe_customer_id",
            field=models.CharField(
                blank=True,
                db_index=True,
                help_text="Stripe customer ID; used for portal and to resolve subscription.",
                max_length=255,
                null=True,
            ),
        ),
    ]

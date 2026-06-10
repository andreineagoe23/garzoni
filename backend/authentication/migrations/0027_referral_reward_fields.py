from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("authentication", "0026_userprofile_age_confirmed_and_more"),
    ]

    operations = [
        migrations.AlterField(
            model_name="referral",
            name="referral_code",
            field=models.CharField(blank=True, max_length=20),
        ),
        migrations.AddField(
            model_name="referral",
            name="reward_status",
            field=models.CharField(
                choices=[("pending", "Pending"), ("earned", "Earned")],
                db_index=True,
                default="pending",
                max_length=16,
            ),
        ),
        migrations.AddField(
            model_name="referral",
            name="earned_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="referral",
            name="referrer_promo_code",
            field=models.CharField(blank=True, default="", max_length=64),
        ),
        migrations.AddField(
            model_name="referral",
            name="referrer_promo_stripe_id",
            field=models.CharField(blank=True, default="", max_length=64),
        ),
        migrations.AddField(
            model_name="referral",
            name="referee_promo_code",
            field=models.CharField(blank=True, default="", max_length=64),
        ),
        migrations.AddField(
            model_name="referral",
            name="referee_promo_stripe_id",
            field=models.CharField(blank=True, default="", max_length=64),
        ),
        migrations.AddField(
            model_name="referral",
            name="referrer_redeemed_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="referral",
            name="referee_redeemed_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
    ]

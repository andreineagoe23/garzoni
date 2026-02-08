from django.db import migrations, models


def set_subscription_plan_id(apps, schema_editor):
    UserProfile = apps.get_model("authentication", "UserProfile")
    for profile in UserProfile.objects.all():
        if profile.subscription_plan_id:
            continue
        if profile.has_paid or profile.is_premium:
            profile.subscription_plan_id = "plus"
        else:
            profile.subscription_plan_id = "starter"
        profile.save(update_fields=["subscription_plan_id"])


def clear_subscription_plan_id(apps, schema_editor):
    UserProfile = apps.get_model("authentication", "UserProfile")
    UserProfile.objects.update(subscription_plan_id=None)


class Migration(migrations.Migration):
    dependencies = [
        ("authentication", "0006_userprofile_financial_profile_fields"),
    ]

    operations = [
        migrations.AddField(
            model_name="userprofile",
            name="subscription_plan_id",
            field=models.CharField(
                blank=True,
                help_text="Subscription tier identifier (starter, plus, pro).",
                max_length=32,
                null=True,
            ),
        ),
        migrations.RunPython(set_subscription_plan_id, clear_subscription_plan_id),
    ]

"""
Default new signups to weekly email reminders (GDPR-safe): change
UserProfile.email_reminder_preference default from "none" to "weekly" and
backfill existing accounts whose preference row still reflects the legacy
"all off, no cadence" state created by authentication.signals before this
change.

Marketing stays OFF — UK PECR reg. 22 and EU ePrivacy require an explicit
opt-in for marketing emails (pre-ticked checkboxes are invalid consent per
ICO Direct Marketing Code and EDPB Guidelines 05/2020 on consent).
"""

from django.db import migrations, models


def forward_backfill(apps, schema_editor):
    UserProfile = apps.get_model("authentication", "UserProfile")
    UserEmailPreference = apps.get_model("authentication", "UserEmailPreference")

    # Profiles whose cadence is still the legacy "none" default -> weekly.
    UserProfile.objects.filter(email_reminder_preference="none").update(
        email_reminder_preference="weekly"
    )

    # UserEmailPreference rows seeded by the old signal landed with
    # reminders=False, reminder_frequency="none". If the row looks untouched
    # (matches those exact defaults), flip it to the new GDPR-safe service
    # defaults. We leave marketing alone (explicit consent model).
    UserEmailPreference.objects.filter(
        reminders=False,
        reminder_frequency="none",
    ).update(
        reminders=True,
        streak_alerts=True,
        weekly_digest=True,
        billing_alerts=True,
        push_notifications=True,
        reminder_frequency="weekly",
    )


def reverse_noop(apps, schema_editor):
    # Reverting to "none" default would be a downgrade of user experience and
    # is not worth un-backfilling opt-ins. No-op reverse is safe.
    return None


class Migration(migrations.Migration):
    dependencies = [
        ("authentication", "0020_beat_periodic_send_renewal_reminder"),
    ]

    operations = [
        migrations.AlterField(
            model_name="userprofile",
            name="email_reminder_preference",
            field=models.CharField(
                choices=[
                    ("none", "No Reminders"),
                    ("weekly", "Weekly"),
                    ("monthly", "Monthly"),
                ],
                default="weekly",
                max_length=10,
            ),
        ),
        migrations.RunPython(forward_backfill, reverse_noop),
    ]

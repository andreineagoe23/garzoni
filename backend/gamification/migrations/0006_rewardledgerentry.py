# Generated manually for unified reward idempotency

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("gamification", "0005_remove_missioncompletion_core_missio_user_id_cac5aa_idx_and_more"),
    ]

    operations = [
        migrations.CreateModel(
            name="RewardLedgerEntry",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name="ID",
                    ),
                ),
                ("event_key", models.CharField(db_index=True, max_length=220)),
                ("points", models.IntegerField(default=0)),
                ("coins", models.DecimalField(decimal_places=2, default=0, max_digits=10)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "user",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="reward_ledger_entries",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "db_table": "core_rewardledgerentry",
            },
        ),
        migrations.AddConstraint(
            model_name="rewardledgerentry",
            constraint=models.UniqueConstraint(
                fields=("user", "event_key"),
                name="reward_ledger_user_event_uniq",
            ),
        ),
    ]

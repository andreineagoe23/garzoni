from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("gamification", "0010_rename_multistepmission_indexes"),
    ]

    operations = [
        migrations.CreateModel(
            name="Duel",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                (
                    "status",
                    models.CharField(
                        choices=[
                            ("pending", "Pending"),
                            ("active", "Active"),
                            ("won_by_challenger", "Won by challenger"),
                            ("won_by_opponent", "Won by opponent"),
                            ("draw", "Draw"),
                            ("declined", "Declined"),
                            ("cancelled", "Cancelled"),
                            ("expired", "Expired"),
                        ],
                        default="pending",
                        max_length=24,
                    ),
                ),
                ("duration_hours", models.PositiveIntegerField()),
                ("bonus_xp", models.PositiveIntegerField(default=100)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("accepted_at", models.DateTimeField(blank=True, null=True)),
                ("ends_at", models.DateTimeField(blank=True, null=True)),
                ("finished_at", models.DateTimeField(blank=True, null=True)),
                ("challenger_xp_start", models.IntegerField(default=0)),
                ("opponent_xp_start", models.IntegerField(default=0)),
                ("challenger_xp_end", models.IntegerField(blank=True, null=True)),
                ("opponent_xp_end", models.IntegerField(blank=True, null=True)),
                (
                    "challenger",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="duels_initiated",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    "opponent",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="duels_received",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    "winner",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="duels_won",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "db_table": "core_duel",
                "indexes": [
                    models.Index(fields=["challenger", "status"], name="duel_chal_status_idx"),
                    models.Index(fields=["opponent", "status"], name="duel_opp_status_idx"),
                    models.Index(fields=["status", "ends_at"], name="duel_status_ends_idx"),
                ],
            },
        ),
    ]

"""Initial schema for the budgeting domain."""

from decimal import Decimal

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models
from django.utils import timezone


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="TransactionCategory",
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
                ("slug", models.SlugField(max_length=64, unique=True)),
                ("label", models.CharField(max_length=64)),
                ("is_income", models.BooleanField(default=False)),
                ("is_transfer", models.BooleanField(default=False)),
                (
                    "parent",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="children",
                        to="budgeting.transactioncategory",
                    ),
                ),
            ],
            options={"ordering": ["label"]},
        ),
        migrations.CreateModel(
            name="LinkedAccount",
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
                ("provider", models.CharField(default="plaid", max_length=32)),
                ("provider_account_id", models.CharField(max_length=128)),
                ("display_name", models.CharField(max_length=128)),
                ("mask", models.CharField(blank=True, max_length=8)),
                ("institution_name", models.CharField(blank=True, max_length=128)),
                ("currency", models.CharField(default="USD", max_length=8)),
                (
                    "status",
                    models.CharField(
                        choices=[
                            ("pending", "Pending"),
                            ("active", "Active"),
                            ("error", "Error"),
                            ("disconnected", "Disconnected"),
                        ],
                        default="pending",
                        max_length=16,
                    ),
                ),
                ("encrypted_access_token", models.TextField(blank=True)),
                ("encrypted_refresh_token", models.TextField(blank=True)),
                ("consent_granted_at", models.DateTimeField(blank=True, null=True)),
                ("consent_revoked_at", models.DateTimeField(blank=True, null=True)),
                ("last_synced_at", models.DateTimeField(blank=True, null=True)),
                ("last_error", models.TextField(blank=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "user",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="linked_accounts",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
        ),
        migrations.AddConstraint(
            model_name="linkedaccount",
            constraint=models.UniqueConstraint(
                fields=("user", "provider", "provider_account_id"),
                name="uniq_user_provider_account",
            ),
        ),
        migrations.AddIndex(
            model_name="linkedaccount",
            index=models.Index(
                fields=["user", "status"], name="budget_la_user_status_idx"
            ),
        ),
        migrations.AddIndex(
            model_name="linkedaccount",
            index=models.Index(
                fields=["provider", "status"], name="budget_la_prov_status_idx"
            ),
        ),
        migrations.CreateModel(
            name="Transaction",
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
                (
                    "provider_transaction_id",
                    models.CharField(blank=True, max_length=128),
                ),
                (
                    "source",
                    models.CharField(
                        choices=[
                            ("provider", "Provider sync"),
                            ("manual", "Manual entry"),
                            ("csv", "CSV import"),
                        ],
                        default="provider",
                        max_length=16,
                    ),
                ),
                ("amount", models.DecimalField(decimal_places=4, max_digits=20)),
                ("currency", models.CharField(default="USD", max_length=8)),
                ("description", models.CharField(blank=True, max_length=256)),
                ("merchant_name", models.CharField(blank=True, max_length=128)),
                ("posted_at", models.DateField()),
                ("booked_at", models.DateTimeField(blank=True, null=True)),
                ("is_pending", models.BooleanField(default=False)),
                (
                    "provider_category_raw",
                    models.CharField(blank=True, max_length=128),
                ),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "account",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="transactions",
                        to="budgeting.linkedaccount",
                    ),
                ),
                (
                    "category",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="transactions",
                        to="budgeting.transactioncategory",
                    ),
                ),
                (
                    "user",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="transactions",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
        ),
        migrations.AddIndex(
            model_name="transaction",
            index=models.Index(
                fields=["user", "posted_at"], name="budget_tx_user_date_idx"
            ),
        ),
        migrations.AddIndex(
            model_name="transaction",
            index=models.Index(
                fields=["user", "category", "posted_at"],
                name="budget_tx_user_cat_date_idx",
            ),
        ),
        migrations.AddIndex(
            model_name="transaction",
            index=models.Index(
                fields=["provider_transaction_id"], name="budget_tx_provid_idx"
            ),
        ),
        migrations.AddConstraint(
            model_name="transaction",
            constraint=models.UniqueConstraint(
                fields=("user", "provider_transaction_id"),
                condition=models.Q(provider_transaction_id__gt=""),
                name="uniq_user_provider_tx",
            ),
        ),
        migrations.CreateModel(
            name="BudgetEnvelope",
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
                ("category", models.CharField(max_length=64)),
                ("label", models.CharField(max_length=64)),
                ("monthly_target", models.DecimalField(decimal_places=2, max_digits=14)),
                ("currency", models.CharField(default="USD", max_length=8)),
                ("is_active", models.BooleanField(default=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "user",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="budget_envelopes",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={"ordering": ["category"]},
        ),
        migrations.AddConstraint(
            model_name="budgetenvelope",
            constraint=models.UniqueConstraint(
                fields=("user", "category"), name="uniq_user_category_envelope"
            ),
        ),
        migrations.CreateModel(
            name="BudgetPeriodSummary",
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
                ("period_start", models.DateField()),
                ("currency", models.CharField(default="USD", max_length=8)),
                (
                    "total_income",
                    models.DecimalField(
                        decimal_places=2, default=Decimal("0"), max_digits=20
                    ),
                ),
                (
                    "total_spent",
                    models.DecimalField(
                        decimal_places=2, default=Decimal("0"), max_digits=20
                    ),
                ),
                (
                    "net_cash_flow",
                    models.DecimalField(
                        decimal_places=2, default=Decimal("0"), max_digits=20
                    ),
                ),
                ("by_category", models.JSONField(blank=True, default=dict)),
                ("computed_at", models.DateTimeField(auto_now=True)),
                (
                    "user",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="budget_period_summaries",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={"ordering": ["-period_start"]},
        ),
        migrations.AddConstraint(
            model_name="budgetperiodsummary",
            constraint=models.UniqueConstraint(
                fields=("user", "period_start"), name="uniq_user_period_start"
            ),
        ),
        migrations.CreateModel(
            name="SpendingAnomaly",
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
                (
                    "kind",
                    models.CharField(
                        choices=[
                            ("over_budget", "Over budget"),
                            ("unusual_category", "Unusual category"),
                            ("income_drop", "Income drop"),
                            ("duplicate_charge", "Duplicate charge"),
                        ],
                        max_length=32,
                    ),
                ),
                ("severity", models.CharField(default="info", max_length=16)),
                ("category", models.CharField(blank=True, max_length=64)),
                ("summary", models.CharField(max_length=256)),
                ("detail", models.TextField(blank=True)),
                ("detected_for", models.DateField(default=timezone.now)),
                ("metadata", models.JSONField(blank=True, default=dict)),
                ("resolved_at", models.DateTimeField(blank=True, null=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "user",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="spending_anomalies",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={"ordering": ["-detected_for"]},
        ),
        migrations.AddIndex(
            model_name="spendinganomaly",
            index=models.Index(
                fields=["user", "detected_for"], name="budget_anom_user_date_idx"
            ),
        ),
        migrations.AddIndex(
            model_name="spendinganomaly",
            index=models.Index(
                fields=["user", "resolved_at"], name="budget_anom_user_res_idx"
            ),
        ),
        migrations.CreateModel(
            name="ProviderWebhookEvent",
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
                ("provider", models.CharField(max_length=32)),
                ("event_id", models.CharField(max_length=128, unique=True)),
                ("received_at", models.DateTimeField(auto_now_add=True)),
                ("payload", models.JSONField(blank=True, default=dict)),
                ("processed", models.BooleanField(default=False)),
                ("processed_at", models.DateTimeField(blank=True, null=True)),
                ("error", models.TextField(blank=True)),
            ],
        ),
        migrations.AddIndex(
            model_name="providerwebhookevent",
            index=models.Index(
                fields=["provider", "processed"], name="budget_pwh_prov_proc_idx"
            ),
        ),
    ]

"""
Budgeting & spending domain models.

These models back the Personal CFO budgeting capability. They are designed to
support both provider-driven ingestion (e.g. Plaid/Tink/TrueLayer) and manual
CSV imports while keeping a single internal transaction shape.

Privacy: any access token, refresh token, or institution-side identifier MUST
be stored using the field helpers below (`encrypted_*`) and is intentionally
opaque to clients. Only the redacted display name is exposed via the API.
"""

from __future__ import annotations

from decimal import Decimal

from django.conf import settings
from django.db import models
from django.utils import timezone


class LinkedAccount(models.Model):
    """A bank/card/wallet account that has been linked to the user."""

    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        ACTIVE = "active", "Active"
        ERROR = "error", "Error"
        DISCONNECTED = "disconnected", "Disconnected"

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="linked_accounts",
    )
    provider = models.CharField(max_length=32, default="plaid")
    provider_account_id = models.CharField(max_length=128)
    display_name = models.CharField(max_length=128)
    mask = models.CharField(max_length=8, blank=True)
    institution_name = models.CharField(max_length=128, blank=True)
    currency = models.CharField(max_length=8, default="USD")
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.PENDING)
    # NOTE: encrypted at rest by infrastructure (DB-side encryption or KMS-backed)
    # The fields stay opaque to the API. Application-level encryption can be layered
    # via a custom field if needed; we keep TextField here to avoid migrations now.
    encrypted_access_token = models.TextField(blank=True)
    encrypted_refresh_token = models.TextField(blank=True)
    consent_granted_at = models.DateTimeField(null=True, blank=True)
    consent_revoked_at = models.DateTimeField(null=True, blank=True)
    last_synced_at = models.DateTimeField(null=True, blank=True)
    last_error = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ("user", "provider", "provider_account_id")
        indexes = [
            models.Index(fields=["user", "status"]),
            models.Index(fields=["provider", "status"]),
        ]

    def __str__(self) -> str:
        return f"{self.display_name} ({self.provider})"


class TransactionCategory(models.Model):
    """Internal category taxonomy used by Garzoni.

    Provider categories are mapped onto these to keep budgeting consistent
    across providers and regions.
    """

    slug = models.SlugField(max_length=64, unique=True)
    label = models.CharField(max_length=64)
    parent = models.ForeignKey(
        "self",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="children",
    )
    is_income = models.BooleanField(default=False)
    is_transfer = models.BooleanField(default=False)

    class Meta:
        verbose_name_plural = "Transaction categories"
        ordering = ["label"]

    def __str__(self) -> str:
        return self.label


class Transaction(models.Model):
    """Single normalised transaction.

    Sign convention: ``amount`` is positive for inflows (income/refunds) and
    negative for outflows (spending). Some providers send the inverse — the
    ingestion layer is responsible for normalising before persisting.
    """

    class Source(models.TextChoices):
        PROVIDER = "provider", "Provider sync"
        MANUAL = "manual", "Manual entry"
        CSV = "csv", "CSV import"

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="transactions",
    )
    account = models.ForeignKey(
        LinkedAccount,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="transactions",
    )
    provider_transaction_id = models.CharField(max_length=128, blank=True)
    source = models.CharField(max_length=16, choices=Source.choices, default=Source.PROVIDER)

    amount = models.DecimalField(max_digits=20, decimal_places=4)
    currency = models.CharField(max_length=8, default="USD")
    description = models.CharField(max_length=256, blank=True)
    merchant_name = models.CharField(max_length=128, blank=True)
    posted_at = models.DateField()
    booked_at = models.DateTimeField(null=True, blank=True)
    is_pending = models.BooleanField(default=False)

    category = models.ForeignKey(
        TransactionCategory,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="transactions",
    )
    provider_category_raw = models.CharField(max_length=128, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [
            models.Index(fields=["user", "posted_at"]),
            models.Index(fields=["user", "category", "posted_at"]),
            models.Index(fields=["provider_transaction_id"]),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=["user", "provider_transaction_id"],
                condition=models.Q(provider_transaction_id__gt=""),
                name="uniq_user_provider_tx",
            )
        ]

    def __str__(self) -> str:
        sign = "+" if self.amount > 0 else "-"
        return f"{sign}{abs(self.amount)} {self.currency} {self.description[:30]}"

    @property
    def is_outflow(self) -> bool:
        return self.amount < 0


class BudgetEnvelope(models.Model):
    """Monthly target per category for a user."""

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="budget_envelopes",
    )
    category = models.CharField(max_length=64)
    label = models.CharField(max_length=64)
    monthly_target = models.DecimalField(max_digits=14, decimal_places=2)
    currency = models.CharField(max_length=8, default="USD")
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ("user", "category")
        ordering = ["category"]

    def __str__(self) -> str:
        return f"{self.label} ({self.user_id})"


class BudgetPeriodSummary(models.Model):
    """Pre-computed monthly aggregates used by dashboards and alerts."""

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="budget_period_summaries",
    )
    period_start = models.DateField()
    currency = models.CharField(max_length=8, default="USD")
    total_income = models.DecimalField(max_digits=20, decimal_places=2, default=Decimal("0"))
    total_spent = models.DecimalField(max_digits=20, decimal_places=2, default=Decimal("0"))
    net_cash_flow = models.DecimalField(max_digits=20, decimal_places=2, default=Decimal("0"))
    by_category = models.JSONField(default=dict, blank=True)
    computed_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name_plural = "Budget period summaries"
        unique_together = ("user", "period_start")
        ordering = ["-period_start"]


class SpendingAnomaly(models.Model):
    """An overspend or unusual-pattern flag surfaced to the CFO/Next Steps."""

    class Kind(models.TextChoices):
        OVER_BUDGET = "over_budget", "Over budget"
        UNUSUAL_CATEGORY = "unusual_category", "Unusual category"
        INCOME_DROP = "income_drop", "Income drop"
        DUPLICATE_CHARGE = "duplicate_charge", "Duplicate charge"

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="spending_anomalies",
    )
    kind = models.CharField(max_length=32, choices=Kind.choices)
    severity = models.CharField(max_length=16, default="info")
    category = models.CharField(max_length=64, blank=True)
    summary = models.CharField(max_length=256)
    detail = models.TextField(blank=True)
    detected_for = models.DateField(default=timezone.now)
    metadata = models.JSONField(default=dict, blank=True)
    resolved_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name_plural = "Spending anomalies"
        indexes = [
            models.Index(fields=["user", "detected_for"]),
            models.Index(fields=["user", "resolved_at"]),
        ]
        ordering = ["-detected_for"]


class ProviderWebhookEvent(models.Model):
    """Idempotent record of inbound provider webhook events."""

    provider = models.CharField(max_length=32)
    event_id = models.CharField(max_length=128, unique=True)
    received_at = models.DateTimeField(auto_now_add=True)
    payload = models.JSONField(default=dict, blank=True)
    processed = models.BooleanField(default=False)
    processed_at = models.DateTimeField(null=True, blank=True)
    error = models.TextField(blank=True)

    class Meta:
        indexes = [models.Index(fields=["provider", "processed"])]

from django.contrib import admin

from core.admin_mixins import NoAddDeleteAdminMixin, ReadOnlyAdminMixin
from budgeting.models import (
    BudgetEnvelope,
    BudgetPeriodSummary,
    LinkedAccount,
    ProviderWebhookEvent,
    SpendingAnomaly,
    Transaction,
    TransactionCategory,
)


@admin.register(LinkedAccount)
class LinkedAccountAdmin(NoAddDeleteAdminMixin, admin.ModelAdmin):
    # Never render the bank credentials on the change form, even to staff.
    exclude = ("encrypted_access_token", "encrypted_refresh_token")
    list_display = (
        "id",
        "user",
        "provider",
        "display_name",
        "status",
        "last_synced_at",
    )
    list_filter = ("provider", "status")
    search_fields = ("display_name", "institution_name", "user__email")


@admin.register(Transaction)
class TransactionAdmin(NoAddDeleteAdminMixin, admin.ModelAdmin):
    list_display = (
        "id",
        "user",
        "posted_at",
        "amount",
        "currency",
        "merchant_name",
        "source",
    )
    list_filter = ("source", "is_pending")
    search_fields = ("description", "merchant_name", "user__email")
    date_hierarchy = "posted_at"


@admin.register(TransactionCategory)
class TransactionCategoryAdmin(admin.ModelAdmin):
    list_display = ("slug", "label", "is_income", "is_transfer")
    search_fields = ("slug", "label")


@admin.register(BudgetEnvelope)
class BudgetEnvelopeAdmin(NoAddDeleteAdminMixin, admin.ModelAdmin):
    list_display = ("user", "category", "label", "monthly_target", "is_active")
    list_filter = ("is_active",)
    search_fields = ("label", "user__email")


@admin.register(BudgetPeriodSummary)
class BudgetPeriodSummaryAdmin(NoAddDeleteAdminMixin, admin.ModelAdmin):
    list_display = (
        "user",
        "period_start",
        "currency",
        "total_income",
        "total_spent",
        "net_cash_flow",
        "computed_at",
    )
    list_filter = ("period_start",)
    search_fields = ("user__email",)


@admin.register(SpendingAnomaly)
class SpendingAnomalyAdmin(NoAddDeleteAdminMixin, admin.ModelAdmin):
    list_display = (
        "user",
        "kind",
        "severity",
        "category",
        "detected_for",
        "resolved_at",
    )
    list_filter = ("kind", "severity")
    search_fields = ("summary", "user__email")


@admin.register(ProviderWebhookEvent)
class ProviderWebhookEventAdmin(ReadOnlyAdminMixin, admin.ModelAdmin):
    # Raw provider payloads may carry PII; inspect only, never edit.
    list_display = ("event_id", "provider", "processed", "received_at")
    list_filter = ("provider", "processed")
    readonly_fields = ("event_id", "provider", "processed", "received_at", "payload")

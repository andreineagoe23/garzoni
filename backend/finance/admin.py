# finance/admin.py
from django.contrib import admin

from core.admin_mixins import NoAddDeleteAdminMixin
from finance.models import (
    FinanceFact,
    UserFactProgress,
    SimulatedSavingsAccount,
    Reward,
    UserPurchase,
    PortfolioEntry,
    FinancialGoal,
    FunnelEvent,
)


class SimulatedSavingsAccountAdmin(NoAddDeleteAdminMixin, admin.ModelAdmin):
    """Admin configuration for managing simulated savings accounts."""

    list_display = ("user", "balance")
    fields = ("user", "balance")
    search_fields = ("user__username", "user__email")


class RewardAdmin(admin.ModelAdmin):
    """Admin configuration for managing rewards."""

    list_display = ("name", "type", "cost", "is_active")
    list_filter = ("type", "is_active")
    fieldsets = (
        (
            None,
            {"fields": ("name", "description", "cost", "type", "image", "is_active")},
        ),
        (
            "Donation Specific",
            {
                "fields": ("donation_organization",),
                "classes": ("collapse",),
                "description": "Only fill for donation causes",
            },
        ),
    )


@admin.register(FinanceFact)
class FinanceFactAdmin(admin.ModelAdmin):
    """Admin configuration for managing finance facts."""

    list_display = ("text", "category", "is_active")
    list_filter = ("category", "is_active")
    search_fields = ("text",)
    list_editable = ("is_active",)


@admin.register(UserFactProgress)
class UserFactProgressAdmin(NoAddDeleteAdminMixin, admin.ModelAdmin):
    """Admin configuration for managing user fact progress."""

    list_display = ("user", "fact", "read_at")
    list_filter = ("read_at",)
    search_fields = ("user__username", "user__email", "fact__text")


@admin.register(UserPurchase)
class UserPurchaseAdmin(NoAddDeleteAdminMixin, admin.ModelAdmin):
    """Purchases are written by the billing flow; inspect/edit only."""

    list_display = ("user", "reward", "purchased_at")
    search_fields = ("user__username", "user__email", "reward__name")
    list_filter = ("purchased_at",)


@admin.register(PortfolioEntry)
class PortfolioEntryAdmin(NoAddDeleteAdminMixin, admin.ModelAdmin):
    search_fields = ("user__username", "user__email")


@admin.register(FinancialGoal)
class FinancialGoalAdmin(NoAddDeleteAdminMixin, admin.ModelAdmin):
    search_fields = ("user__username", "user__email")


admin.site.register(SimulatedSavingsAccount, SimulatedSavingsAccountAdmin)
admin.site.register(Reward, RewardAdmin)


@admin.register(FunnelEvent)
class FunnelEventAdmin(admin.ModelAdmin):
    """Read-only funnel event inspector for debugging analytics."""

    list_display = ("event_type", "status", "platform", "user", "session_id", "created_at")
    list_filter = ("event_type", "status", "platform", "created_at")
    search_fields = ("event_type", "session_id", "user__username", "user__email")
    readonly_fields = (
        "user",
        "event_type",
        "status",
        "platform",
        "session_id",
        "metadata",
        "created_at",
    )
    date_hierarchy = "created_at"

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

# finance/admin.py
from django.contrib import admin
from finance.models import (
    FinanceFact, UserFactProgress, SimulatedSavingsAccount,
    Reward, UserPurchase, PortfolioEntry, FinancialGoal
)


class SimulatedSavingsAccountAdmin(admin.ModelAdmin):
    """Admin configuration for managing simulated savings accounts."""
    list_display = ('user', 'balance')
    fields = ('user', 'balance')
    search_fields = ('user__username',)


class RewardAdmin(admin.ModelAdmin):
    """Admin configuration for managing rewards."""
    list_display = ('name', 'type', 'cost', 'is_active')
    list_filter = ('type', 'is_active')
    fieldsets = (
        (None, {'fields': ('name', 'description', 'cost', 'type', 'image', 'is_active')}),
        ('Donation Specific', {
            'fields': ('donation_organization',),
            'classes': ('collapse',),
            'description': 'Only fill for donation causes'
        }),
    )


@admin.register(FinanceFact)
class FinanceFactAdmin(admin.ModelAdmin):
    """Admin configuration for managing finance facts."""
    list_display = ('text', 'category', 'is_active')
    list_filter = ('category', 'is_active')
    search_fields = ('text',)
    list_editable = ('is_active',)


@admin.register(UserFactProgress)
class UserFactProgressAdmin(admin.ModelAdmin):
    """Admin configuration for managing user fact progress."""
    list_display = ('user', 'fact', 'read_at')
    list_filter = ('read_at',)
    search_fields = ('user__username', 'fact__text')


admin.site.register(SimulatedSavingsAccount, SimulatedSavingsAccountAdmin)
admin.site.register(Reward, RewardAdmin)
admin.site.register(UserPurchase)
admin.site.register(PortfolioEntry)
admin.site.register(FinancialGoal)


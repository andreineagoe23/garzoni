# authentication/admin.py
from django.contrib import admin
from authentication.models import UserProfile, Referral, FriendRequest


@admin.register(Referral)
class ReferralAdmin(admin.ModelAdmin):
    """Admin configuration for managing referrals."""
    list_display = ('referrer', 'referred_user', 'created_at')


@admin.register(UserProfile)
class UserProfileAdmin(admin.ModelAdmin):
    """Admin configuration for managing user profiles."""
    list_display = ('user', 'earned_money', 'points', 'referral_code', 'has_paid', 'dark_mode', 'email_reminder_preference', 'streak')
    list_filter = ('has_paid', 'dark_mode', 'email_reminder_preference')
    search_fields = ('user__username', 'user__email', 'referral_code')
    readonly_fields = ('earned_money', 'points', 'referral_points', 'streak')


@admin.register(FriendRequest)
class FriendRequestAdmin(admin.ModelAdmin):
    """Admin configuration for managing friend requests."""
    list_display = ('sender', 'receiver', 'status', 'created_at')
    list_filter = ('status', 'created_at')
    search_fields = ('sender__username', 'receiver__username')


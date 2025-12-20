# authentication/admin.py
from django.contrib import admin
from django.db import transaction
from django.utils import timezone

from authentication.models import UserProfile, Referral, FriendRequest
from authentication.views import _apply_hearts_regen, _hearts_constants, _hearts_payload
from gamification.models import MissionCompletion, UserBadge


@admin.register(Referral)
class ReferralAdmin(admin.ModelAdmin):
    """Admin configuration for managing referrals."""

    list_display = ("referrer", "referred_user", "created_at")


@admin.register(UserProfile)
class UserProfileAdmin(admin.ModelAdmin):
    """Admin configuration for managing user profiles."""

    list_display = (
        "user",
        "earned_money",
        "points",
        "referral_code",
        "has_paid",
        "dark_mode",
        "email_reminder_preference",
        "streak",
        "hearts",
        "hearts_last_refill_at",
        "next_heart_countdown",
        "badges_earned",
        "missions_completed",
    )
    list_filter = ("has_paid", "dark_mode", "email_reminder_preference")
    search_fields = ("user__username", "user__email", "referral_code")
    readonly_fields = (
        "earned_money",
        "points",
        "referral_points",
        "streak",
        "hearts",
        "hearts_last_refill_at",
        "next_heart_countdown",
        "badges_earned",
        "missions_completed",
    )
    actions = ["refill_hearts", "grant_bonus_heart"]

    @admin.action(description="Refill hearts to max for selected users")
    def refill_hearts(self, request, queryset):
        now = timezone.now()
        updated = 0
        with transaction.atomic():
            for profile in queryset.select_for_update():
                max_hearts, _ = _hearts_constants(profile)
                profile.hearts = max_hearts
                profile.hearts_last_refill_at = now
                profile.save(update_fields=["hearts", "hearts_last_refill_at"])
                updated += 1
        self.message_user(request, f"Refilled hearts for {updated} profile(s).")

    @admin.action(description="Grant +1 heart (respecting max and regen timer)")
    def grant_bonus_heart(self, request, queryset):
        now = timezone.now()
        updated = 0
        with transaction.atomic():
            for profile in queryset.select_for_update():
                profile = _apply_hearts_regen(profile, now=now)
                max_hearts, _ = _hearts_constants(profile)
                new_hearts = min(max_hearts, int(profile.hearts or 0) + 1)
                if new_hearts != profile.hearts:
                    profile.hearts = new_hearts
                    if new_hearts >= max_hearts:
                        profile.hearts_last_refill_at = now
                    profile.save(update_fields=["hearts", "hearts_last_refill_at"])
                    updated += 1
        self.message_user(request, f"Granted bonus hearts for {updated} profile(s).")

    def badges_earned(self, obj):
        return UserBadge.objects.filter(user=obj.user).count()

    badges_earned.short_description = "Badges"

    def missions_completed(self, obj):
        return MissionCompletion.objects.filter(user=obj.user, status="completed").count()

    missions_completed.short_description = "Missions"

    def next_heart_countdown(self, obj):
        """Readable countdown until the next heart regenerates."""

        payload = _hearts_payload(obj)
        next_in = payload.get("next_heart_in_seconds")
        if next_in is None:
            return "Full"
        if next_in >= 3600:
            hours = next_in // 3600
            minutes = (next_in % 3600) // 60
            return f"{hours}h {minutes}m"
        if next_in >= 60:
            minutes = next_in // 60
            seconds = next_in % 60
            return f"{minutes}m {seconds}s"
        return f"{next_in}s"

    next_heart_countdown.short_description = "Next heart in"


@admin.register(FriendRequest)
class FriendRequestAdmin(admin.ModelAdmin):
    """Admin configuration for managing friend requests."""

    list_display = ("sender", "receiver", "status", "created_at")
    list_filter = ("status", "created_at")
    search_fields = ("sender__username", "receiver__username")

import csv

from django.contrib import admin
from django.contrib.auth import get_user_model
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from django.db import transaction
from django.http import HttpResponse
from django.utils import timezone

from authentication.models import UserProfile, Referral, FriendRequest
from authentication.user_display import normalize_display_string
from authentication.services.hearts import apply_hearts_regen, hearts_constants, hearts_payload
from gamification.models import MissionCompletion, UserBadge

User = get_user_model()


class UserAdmin(BaseUserAdmin):
    """User admin with normalized display so mojibake (RoÈ™u, âš ï¸) shows clean in list."""

    list_display = (
        "username_display",
        "email",
        "first_name_display",
        "last_name_display",
        "is_staff",
        "date_joined",
        "last_login",
    )
    list_filter = ("is_staff", "is_superuser", "is_active", "date_joined")

    def username_display(self, obj):
        return normalize_display_string(obj.username)

    username_display.short_description = "username"

    def first_name_display(self, obj):
        return normalize_display_string(obj.first_name)

    first_name_display.short_description = "First name"

    def last_name_display(self, obj):
        return normalize_display_string(obj.last_name)

    last_name_display.short_description = "Last name"


admin.site.unregister(User)
admin.site.register(User, UserAdmin)


@admin.register(Referral)
class ReferralAdmin(admin.ModelAdmin):
    """Admin configuration for managing referrals."""

    list_display = (
        "referrer",
        "referred_user",
        "reward_status",
        "referral_code",
        "earned_at",
        "created_at",
    )
    list_filter = ("reward_status", "created_at", "earned_at")
    search_fields = (
        "referrer__username",
        "referrer__email",
        "referred_user__username",
        "referred_user__email",
        "referral_code",
        "referrer_promo_code",
        "referee_promo_code",
    )
    readonly_fields = ("created_at", "earned_at", "referrer_redeemed_at", "referee_redeemed_at")
    raw_id_fields = ("referrer", "referred_user")


@admin.register(UserProfile)
class UserProfileAdmin(admin.ModelAdmin):
    """Admin configuration for managing user profiles."""

    list_display = (
        "user",
        "signup_platform",
        "last_seen_platform",
        "subscription_plan_id",
        "subscription_status",
        "is_premium",
        "has_paid",
        "streak",
        "hearts",
        "points",
        "earned_money",
        "investing_experience",
        "last_login_display",
        "last_completed_date",
        "onboarding_completed_at",
        "first_lesson_at",
        "age_confirmed",
        "badges_earned",
        "missions_completed",
        "days_since_last_lesson",
    )
    list_filter = (
        "has_paid",
        "is_premium",
        "signup_platform",
        "last_seen_platform",
        "subscription_plan_id",
        "subscription_status",
        "age_confirmed",
        "investing_experience",
        "risk_comfort",
        "dark_mode",
        "email_reminder_preference",
    )
    search_fields = (
        "user__username",
        "user__email",
        "referral_code",
        "stripe_customer_id",
        "stripe_subscription_id",
        "apple_sub",
    )
    readonly_fields = (
        "earned_money",
        "points",
        "referral_points",
        "referral_code",
        "streak",
        "hearts",
        "hearts_last_refill_at",
        "next_heart_countdown",
        "badges_earned",
        "missions_completed",
        "expo_push_token",
        "last_login_display",
        "days_since_last_lesson",
        "onboarding_status",
        "subscription_plan_id",
        "subscription_status",
        "trial_end",
        "stripe_customer_id",
        "stripe_subscription_id",
        "apple_sub",
        "onboarding_completed_at",
        "first_lesson_at",
        "terms_accepted_at",
        "terms_accepted_ip",
        "terms_version",
    )
    fieldsets = (
        (
            "Account",
            {
                "fields": (
                    "user",
                    "referral_code",
                    "signup_platform",
                    "last_seen_platform",
                    "age_confirmed",
                    "dark_mode",
                    "email_reminder_preference",
                    "sound_enabled",
                    "animations_enabled",
                    "expo_push_token",
                ),
            },
        ),
        (
            "Subscription & billing",
            {
                "fields": (
                    "has_paid",
                    "is_premium",
                    "subscription_plan_id",
                    "subscription_status",
                    "trial_end",
                    "stripe_customer_id",
                    "stripe_subscription_id",
                    "apple_sub",
                ),
            },
        ),
        (
            "Learning & engagement",
            {
                "fields": (
                    "streak",
                    "hearts",
                    "hearts_last_refill_at",
                    "next_heart_countdown",
                    "points",
                    "earned_money",
                    "referral_points",
                    "last_completed_date",
                    "last_login_display",
                    "days_since_last_lesson",
                    "onboarding_status",
                    "onboarding_completed_at",
                    "first_lesson_at",
                    "badges_earned",
                    "missions_completed",
                ),
            },
        ),
        (
            "Financial profile",
            {
                "fields": (
                    "goal_types",
                    "timeframe",
                    "risk_comfort",
                    "income_range",
                    "savings_rate_estimate",
                    "investing_experience",
                ),
            },
        ),
        (
            "Legal",
            {
                "fields": ("terms_version", "terms_accepted_at", "terms_accepted_ip"),
            },
        ),
    )
    actions = ["refill_hearts", "grant_bonus_heart", "export_profiles_csv"]

    @admin.action(description="Refill hearts to max for selected users")
    def refill_hearts(self, request, queryset):
        now = timezone.now()
        updated = 0
        with transaction.atomic():
            for profile in queryset.select_for_update():
                max_hearts, _ = hearts_constants(profile)
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
                profile = apply_hearts_regen(profile, now=now)
                max_hearts, _ = hearts_constants(profile)
                new_hearts = min(max_hearts, int(profile.hearts or 0) + 1)
                if new_hearts != profile.hearts:
                    profile.hearts = new_hearts
                    if new_hearts >= max_hearts:
                        profile.hearts_last_refill_at = now
                    profile.save(update_fields=["hearts", "hearts_last_refill_at"])
                    updated += 1
        self.message_user(request, f"Granted bonus hearts for {updated} profile(s).")

    @admin.action(description="Export selected profiles as CSV")
    def export_profiles_csv(self, request, queryset):
        response = HttpResponse(content_type="text/csv")
        response["Content-Disposition"] = 'attachment; filename="user_profiles.csv"'
        writer = csv.writer(response)
        writer.writerow(
            [
                "username",
                "email",
                "signup_platform",
                "subscription_plan",
                "subscription_status",
                "is_premium",
                "has_paid",
                "streak",
                "points",
                "earned_money",
                "last_login",
                "last_lesson",
                "onboarding_completed_at",
                "first_lesson_at",
            ]
        )
        for profile in queryset.select_related("user"):
            user = profile.user
            writer.writerow(
                [
                    user.username,
                    user.email,
                    profile.signup_platform,
                    profile.subscription_plan_id or "",
                    profile.subscription_status,
                    profile.is_premium,
                    profile.has_paid,
                    profile.streak,
                    profile.points,
                    profile.earned_money,
                    user.last_login.isoformat() if user.last_login else "",
                    profile.last_completed_date.isoformat() if profile.last_completed_date else "",
                    (
                        profile.onboarding_completed_at.isoformat()
                        if profile.onboarding_completed_at
                        else ""
                    ),
                    profile.first_lesson_at.isoformat() if profile.first_lesson_at else "",
                ]
            )
        return response

    def badges_earned(self, obj):
        return UserBadge.objects.filter(user=obj.user).count()

    badges_earned.short_description = "Badges"

    def missions_completed(self, obj):
        return MissionCompletion.objects.filter(user=obj.user, status="completed").count()

    missions_completed.short_description = "Missions"

    def last_login_display(self, obj):
        last = getattr(obj.user, "last_login", None)
        if not last:
            return "—"
        return timezone.localtime(last).strftime("%Y-%m-%d %H:%M")

    last_login_display.short_description = "Last login"

    def days_since_last_lesson(self, obj):
        if not obj.last_completed_date:
            return "—"
        delta = timezone.localdate() - obj.last_completed_date
        return delta.days

    days_since_last_lesson.short_description = "Days since lesson"

    def onboarding_status(self, obj):
        if obj.onboarding_completed_at:
            return "Completed"
        from onboarding.models import QuestionnaireProgress

        progress = QuestionnaireProgress.objects.filter(user=obj.user).first()
        if not progress:
            return "Not started"
        return progress.get_status_display()

    onboarding_status.short_description = "Onboarding"

    def next_heart_countdown(self, obj):
        payload = hearts_payload(obj)
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

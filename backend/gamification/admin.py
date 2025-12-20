# gamification/admin.py
from django.contrib import admin
from django.utils.html import format_html
from django.urls import reverse
from django.utils.safestring import mark_safe
from gamification.models import (
    Badge,
    UserBadge,
    Mission,
    MissionCompletion,
    StreakItem,
    MissionPerformance,
)


class MissionAdmin(admin.ModelAdmin):
    """Admin configuration for managing missions with template support and preview."""

    list_display = (
        "name",
        "mission_type",
        "goal_type",
        "points_reward",
        "is_template",
        "preview_link",
    )
    fields = (
        "name",
        "description",
        "points_reward",
        "mission_type",
        "goal_type",
        "goal_reference",
        "is_template",
        "purpose_statement",
        "target_weakest_skills",
        "min_difficulty",
        "max_difficulty",
        "fact",
    )
    list_filter = ("mission_type", "goal_type", "is_template", "target_weakest_skills")
    search_fields = ("name", "description", "purpose_statement")
    actions = ["duplicate_templates_as_live"]

    def preview_link(self, obj):
        """Link to preview the mission as users will see it."""
        if obj.id:
            url = reverse("admin:gamification_mission_preview", args=[obj.id])
            return format_html('<a href="{}" target="_blank">Preview</a>', url)
        return "-"

    preview_link.short_description = "Preview"

    def get_urls(self):
        """Add custom preview URL."""
        from django.urls import path

        urls = super().get_urls()
        custom_urls = [
            path(
                "<int:mission_id>/preview/",
                self.admin_site.admin_view(self.preview_mission),
                name="gamification_mission_preview",
            ),
        ]
        return custom_urls + urls

    def preview_mission(self, request, mission_id):
        """Preview mission as users will see it."""
        from django.shortcuts import get_object_or_404
        from django.template.response import TemplateResponse

        mission = get_object_or_404(Mission, id=mission_id)

        # Simulate goal_reference for preview
        goal_ref = mission.goal_reference or {}
        if mission.goal_type == "complete_lesson":
            goal_ref.setdefault("required_lessons", 1)
        elif mission.goal_type == "add_savings":
            goal_ref.setdefault("target", 100)
        elif mission.goal_type == "clear_review_queue":
            goal_ref.setdefault("target_count", 5)

        context = {
            "mission": mission,
            "goal_reference": goal_ref,
            "purpose_statement": mission.purpose_statement
            or "Completing this mission keeps your learning loop tight.",
        }

        return TemplateResponse(request, "admin/gamification/mission_preview.html", context)

    def goal_target(self, obj):
        """Determine the goal target based on mission type and goal type."""
        if obj.goal_type == "read_fact":
            return "1 Fact" if obj.mission_type == "daily" else "5 Facts"
        return obj.goal_reference

    @admin.action(description="Duplicate selected templates as live missions")
    def duplicate_templates_as_live(self, request, queryset):
        created = 0
        for mission in queryset.filter(is_template=True):
            mission_data = {
                field.name: getattr(mission, field.name)
                for field in mission._meta.fields
                if field.name not in ("id", "pk")
            }
            mission_data["is_template"] = False
            mission_data["name"] = f"{mission.name} (Live Copy)"
            Mission.objects.create(**mission_data)
            created += 1
        self.message_user(request, f"Created {created} live mission(s) from templates.")


class MissionCompletionAdmin(admin.ModelAdmin):
    """Admin configuration for managing mission completions."""

    list_display = (
        "user",
        "mission",
        "progress",
        "status",
        "xp_awarded",
        "completed_at",
        "first_try_bonus",
        "mastery_bonus",
    )
    fields = (
        "user",
        "mission",
        "progress",
        "status",
        "completed_at",
        "swapped_at",
        "swapped_from_mission",
        "first_try_bonus",
        "mastery_bonus",
        "xp_awarded",
        "completion_time_seconds",
        "completion_idempotency_key",
    )
    list_filter = ("status", "mission__mission_type", "first_try_bonus", "mastery_bonus")
    search_fields = ("user__username", "mission__name")
    readonly_fields = ("completion_idempotency_key",)


class BadgeAdmin(admin.ModelAdmin):
    """Admin configuration for managing badges."""

    list_display = ("name", "badge_level", "criteria_type", "threshold", "is_active", "badge_image")
    fields = (
        "name",
        "description",
        "image",
        "criteria_type",
        "threshold",
        "badge_level",
        "is_active",
    )
    list_filter = ("badge_level", "criteria_type", "is_active")
    search_fields = ("name", "criteria_type")

    def badge_image(self, obj):
        """Display the badge image in the admin interface."""
        if obj.image:
            return format_html('<img src="{}" width="50" height="50" />'.format(obj.image.url))
        return "No Image"

    badge_image.allow_tags = True
    badge_image.short_description = "Badge Image"


@admin.register(StreakItem)
class StreakItemAdmin(admin.ModelAdmin):
    """Admin configuration for streak items."""

    list_display = ("user", "item_type", "quantity", "expires_at", "created_at")
    list_filter = ("item_type",)
    search_fields = ("user__username",)


@admin.register(MissionPerformance)
class MissionPerformanceAdmin(admin.ModelAdmin):
    """Admin configuration for mission performance analytics."""

    list_display = ("user", "mission", "time_to_completion_seconds", "created_at")
    list_filter = ("mission__mission_type", "mission__goal_type")
    search_fields = ("user__username", "mission__name")
    readonly_fields = ("mastery_before", "mastery_after", "skill_improvements")


admin.site.register(Badge, BadgeAdmin)
admin.site.register(UserBadge)
admin.site.register(Mission, MissionAdmin)
admin.site.register(MissionCompletion, MissionCompletionAdmin)

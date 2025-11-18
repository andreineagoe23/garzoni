# gamification/admin.py
from django.contrib import admin
from django.utils.html import format_html
from gamification.models import Badge, UserBadge, Mission, MissionCompletion


class MissionAdmin(admin.ModelAdmin):
    """Admin configuration for managing missions."""
    list_display = ('name', 'mission_type', 'goal_type', 'points_reward')
    fields = ('name', 'description', 'points_reward', 'mission_type', 'goal_type', 'goal_reference')
    list_filter = ('mission_type', 'goal_type')
    search_fields = ('name', 'description')

    def goal_target(self, obj):
        """Determine the goal target based on mission type and goal type."""
        if obj.goal_type == "read_fact":
            return "1 Fact" if obj.mission_type == "daily" else "5 Facts"
        return obj.goal_reference


class MissionCompletionAdmin(admin.ModelAdmin):
    """Admin configuration for managing mission completions."""
    list_display = ('user', 'mission', 'progress', 'status', 'completed_at')
    fields = ('user', 'mission', 'progress', 'status', 'completed_at')
    list_filter = ('status', 'mission__mission_type')
    search_fields = ('user__username', 'mission__name')


class BadgeAdmin(admin.ModelAdmin):
    """Admin configuration for managing badges."""
    list_display = ('name', 'badge_level', 'criteria_type', 'threshold', 'is_active', 'badge_image')
    fields = ('name', 'description', 'image', 'criteria_type', 'threshold', 'badge_level', 'is_active')
    list_filter = ('badge_level', 'criteria_type', 'is_active')
    search_fields = ('name', 'criteria_type')

    def badge_image(self, obj):
        """Display the badge image in the admin interface."""
        if obj.image:
            return format_html('<img src="{}" width="50" height="50" />'.format(obj.image.url))
        return "No Image"

    badge_image.allow_tags = True
    badge_image.short_description = "Badge Image"


admin.site.register(Badge, BadgeAdmin)
admin.site.register(UserBadge)
admin.site.register(Mission, MissionAdmin)
admin.site.register(MissionCompletion, MissionCompletionAdmin)


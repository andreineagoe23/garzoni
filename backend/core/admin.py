from django.contrib import admin
from django.utils.html import format_html
from .models import (
    Path,
    Course,
    Lesson,
    Quiz,
    UserProfile,
    UserProgress,
    Mission,
    MissionCompletion,
    SimulatedSavingsAccount,
    Question,
    Reward,
    Badge,
    UserBadge,
    Referral
)


@admin.register(Referral)
class ReferralAdmin(admin.ModelAdmin):
    list_display = ('referrer', 'referred_user', 'created_at')
    
class LessonAdmin(admin.ModelAdmin):
    list_display = ('title', 'course', 'short_description', 'exercise_type', 'image', 'video_url')
    fields = (
        'title',
        'course',
        'short_description',
        'detailed_content',
        'image',
        'video_url',
        'exercise_type',
        'exercise_data',
    )
    list_filter = ('course', 'exercise_type')  
    search_fields = ('title', 'short_description', 'exercise_type')

class MissionAdmin(admin.ModelAdmin):
    list_display = ('name', 'mission_type', 'goal_type', 'points_reward')
    fields = ('name', 'description', 'points_reward', 'mission_type', 'goal_type', 'goal_reference')
    list_filter = ('mission_type', 'goal_type')
    search_fields = ('name', 'description')

class MissionCompletionAdmin(admin.ModelAdmin):
    list_display = ('user', 'mission', 'progress', 'status', 'completed_at')
    fields = ('user', 'mission', 'progress', 'status', 'completed_at')
    list_filter = ('status', 'mission__mission_type')
    search_fields = ('user__username', 'mission__name')

class SimulatedSavingsAccountAdmin(admin.ModelAdmin):
    list_display = ('user', 'balance')
    fields = ('user', 'balance')
    search_fields = ('user__username',)

class QuestionAdmin(admin.ModelAdmin):
    list_display = ('text', 'order')
    fields = ('text', 'options', 'order')
    list_filter = ('order',)
    search_fields = ('text',)

class RewardAdmin(admin.ModelAdmin):
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

class BadgeAdmin(admin.ModelAdmin):
    list_display = ('name', 'badge_level', 'criteria_type', 'threshold', 'is_active', 'badge_image')
    fields = ('name', 'description', 'image', 'criteria_type', 'threshold', 'badge_level', 'is_active')
    list_filter = ('badge_level', 'criteria_type', 'is_active')
    search_fields = ('name', 'criteria_type')

    def badge_image(self, obj):
        if obj.image:
            return format_html('<img src="{}" width="50" height="50" />'.format(obj.image.url))
        return "No Image"

    badge_image.allow_tags = True
    badge_image.short_description = "Badge Image"

admin.site.register(Badge, BadgeAdmin)
admin.site.register(Lesson, LessonAdmin)
admin.site.register(Path)
admin.site.register(Course)
admin.site.register(Quiz)
admin.site.register(UserProfile)
admin.site.register(UserProgress)
admin.site.register(Mission, MissionAdmin)
admin.site.register(MissionCompletion, MissionCompletionAdmin)
admin.site.register(SimulatedSavingsAccount, SimulatedSavingsAccountAdmin)
admin.site.register(Question, QuestionAdmin)
admin.site.register(Reward, RewardAdmin)
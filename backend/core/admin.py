from django.contrib import admin
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
)

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

# Register models in the admin panel
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
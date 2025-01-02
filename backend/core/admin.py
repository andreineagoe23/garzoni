from django.contrib import admin
from .models import Path, Course, Lesson, Quiz, UserProfile, UserProgress, Mission, MissionCompletion

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
    list_display = ('name', 'description', 'points_reward')
    search_fields = ('name', 'description')

class MissionCompletionAdmin(admin.ModelAdmin):
    list_display = ('user', 'mission', 'status')
    list_filter = ('status',)
    search_fields = ('user__username', 'mission__name')

# Register models in the admin panel
admin.site.register(Lesson, LessonAdmin)
admin.site.register(Path)
admin.site.register(Course)
admin.site.register(Quiz)
admin.site.register(UserProfile)
admin.site.register(UserProgress)
admin.site.register(Mission, MissionAdmin)
admin.site.register(MissionCompletion, MissionCompletionAdmin)

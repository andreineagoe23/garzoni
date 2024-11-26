from django.contrib import admin
from .models import Path, Course, Lesson, Quiz, UserProfile, UserProgress, Mission


class LessonAdmin(admin.ModelAdmin):
    list_display = ('title', 'course', 'short_description')
    fields = ('title', 'course', 'short_description', 'detailed_content', 'image', 'video_url')


class MissionAdmin(admin.ModelAdmin):
    list_display = ('name', 'description', 'points_reward', 'status', 'user')
    list_filter = ('status',)
    search_fields = ('name', 'user__username')


admin.site.register(Lesson, LessonAdmin)
admin.site.register(Path)
admin.site.register(Course)
admin.site.register(Quiz)
admin.site.register(UserProfile)
admin.site.register(UserProgress)
admin.site.register(Mission, MissionAdmin)
from django.contrib import admin
from .models import Path, Course, Lesson, Quiz, UserProfile, UserProgress

class LessonAdmin(admin.ModelAdmin):
    list_display = ('title', 'course', 'short_description')
    fields = ('title', 'course', 'short_description', 'detailed_content', 'image', 'video_url')

admin.site.register(Lesson, LessonAdmin)
admin.site.register(Path)
admin.site.register(Course)
admin.site.register(Quiz)
admin.site.register(UserProfile)
admin.site.register(UserProgress)

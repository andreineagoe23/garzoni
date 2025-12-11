# education/admin.py
from django.contrib import admin
from django.core.exceptions import ValidationError

from education.models import (
    Path, Course, Lesson, LessonSection, Quiz, UserProgress,
    Question, Exercise, UserExerciseProgress, PollResponse
)


class LessonSectionInline(admin.TabularInline):
    """Inline configuration for managing lesson sections."""
    model = LessonSection
    extra = 1
    fieldsets = [
        (None, {
            'fields': ('order', 'title', 'content_type')
        }),
        ('Text Content', {
            'fields': ('text_content',),
            'classes': ('collapse',),
        }),
        ('Video Content', {
            'fields': ('video_url',),
            'classes': ('collapse',),
        }),
        ('Exercise Content', {
            'fields': ('exercise_type', 'exercise_data'),
            'classes': ('collapse',),
            'description': """
                <strong>Exercise Data Format:</strong>
                <ul>
                    <li><strong>Multiple Choice:</strong> 
                        <pre>{
                        "question": "Your question here",
                        "options": ["Option 1", "Option 2", "Option 3"],
                        "correctAnswer": 0 
                        }</pre>
                    </li>
                    <li><strong>Budget Allocation:</strong> 
                        <pre>{
  "question": "Allocate the budget",
  "categories": ["Category 1", "Category 2"],
  "total": 1000 
}</pre>
                    </li>
                </ul>
            """,
        }),
    ]


@admin.register(Lesson)
class LessonAdmin(admin.ModelAdmin):
    """Admin configuration for managing lessons."""
    inlines = [LessonSectionInline]
    list_display = ('title', 'course', 'section_count')
    
    def section_count(self, obj):
        """Return the count of sections in a lesson."""
        return obj.sections.count()


@admin.register(Exercise)
class ExerciseAdmin(admin.ModelAdmin):
    """Admin configuration for managing exercises."""
    list_display = ('type', 'category', 'difficulty', 'version', 'is_published', 'created_at')
    list_filter = ('type', 'category', 'difficulty', 'is_published')
    search_fields = ('question', 'category', 'misconception_tags')
    readonly_fields = ('preview',)
    fieldsets = (
        (None, {
            'fields': ('type', 'category', 'difficulty', 'version', 'is_published')
        }),
        ('Content', {
            'fields': ('question', 'exercise_data', 'correct_answer', 'preview')
        }),
        ('Quality Metadata', {
            'fields': ('misconception_tags', 'error_patterns')
        })
    )

    def preview(self, obj):
        return obj.question

    preview.short_description = "Learner preview"

    def save_model(self, request, obj, form, change):
        if change:
            existing = Exercise.objects.get(pk=obj.pk)
            if existing.is_published and existing.version == obj.version:
                raise ValidationError(
                    "Published exercises are immutable. Increment version to publish a new revision."
                )
        super().save_model(request, obj, form, change)


@admin.register(UserExerciseProgress)
class UserExerciseProgressAdmin(admin.ModelAdmin):
    """Admin configuration for managing user exercise progress."""
    list_display = ('user', 'exercise', 'completed', 'attempts')
    list_filter = ('completed', 'exercise__type')
    search_fields = ('user__username', 'exercise__question')


@admin.register(Question)
class QuestionAdmin(admin.ModelAdmin):
    """Admin configuration for managing questions."""
    list_display = ('text', 'type', 'order', 'is_active')
    list_filter = ('type', 'is_active')
    search_fields = ('text',)


@admin.register(PollResponse)
class PollResponseAdmin(admin.ModelAdmin):
    """Admin configuration for managing poll responses."""
    list_display = ('question', 'answer', 'responded_at')
    list_filter = ('question',)


admin.site.register(Path)
admin.site.register(Course)
admin.site.register(Quiz)
admin.site.register(UserProgress)


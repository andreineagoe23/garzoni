# education/admin.py
import json

from django import forms
from django.contrib import admin
from django.contrib.admin.widgets import AdminTextareaWidget
from django.core.exceptions import ValidationError
from django.db import models, transaction
from django.utils.html import format_html, format_html_join

from education.models import (
    Path,
    Course,
    Lesson,
    LessonSection,
    Quiz,
    UserProgress,
    Question,
    Exercise,
    MultipleChoiceChoice,
    UserExerciseProgress,
    PollResponse,
    SectionCompletion,
    EducationAuditLog,
)


class PrettyJSONWidget(AdminTextareaWidget):
    """Lightweight JSON helper to pretty-print payloads in admin."""

    def format_value(self, value):  # pragma: no cover - formatting helper
        if value in (None, ""):
            return ""
        try:
            parsed = value if isinstance(value, (dict, list)) else json.loads(value)
            return json.dumps(parsed, indent=2, ensure_ascii=False)
        except Exception:
            return super().format_value(value)


class LessonSectionInlineForm(forms.ModelForm):
    """Rich inline form mirroring the front-end lesson section editor."""

    class Meta:
        model = LessonSection
        fields = (
            "order",
            "is_published",
            "title",
            "content_type",
            "text_content",
            "video_url",
            "exercise_type",
            "exercise_data",
        )
        widgets = {
            "exercise_data": PrettyJSONWidget(attrs={"rows": 6, "style": "font-family:monospace"}),
        }
        help_texts = {
            "text_content": "Rich text content (uses CKEditor, matches learner view).",
            "video_url": "Public video URL (e.g. YouTube share link) shown to learners.",
            "exercise_data": "JSON payload for the selected exercise type; keep keys aligned with front-end schema.",
        }


class LessonSectionInline(admin.StackedInline):
    """Inline configuration for managing lesson sections."""

    form = LessonSectionInlineForm
    model = LessonSection
    extra = 0
    ordering = ("order",)
    show_change_link = True
    readonly_fields = ("updated_at", "updated_by")
    fieldsets = [
        (
            None,
            {
                "fields": (
                    ("order", "is_published"),
                    "title",
                    "content_type",
                )
            },
        ),
        (
            "Text Content",
            {
                "fields": ("text_content",),
                "classes": ("collapse",),
            },
        ),
        (
            "Video Content",
            {
                "fields": ("video_url",),
                "classes": ("collapse",),
            },
        ),
        (
            "Exercise Content",
            {
                "fields": ("exercise_type", "exercise_data"),
                "classes": ("collapse",),
                "description": """
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
            },
        ),
        (
            "Editorial Metadata",
            {
                "fields": ("updated_at", "updated_by"),
            },
        ),
    ]


class EducationAuditMixin:
    """Lightweight audit logger for lesson-related admin actions."""

    audit_target_type = None

    def log_audit(
        self, request, obj, action, extra=None, target_type=None
    ):  # pragma: no cover - admin side effect
        target = target_type or self.audit_target_type
        if not target or not obj:
            return
        EducationAuditLog.objects.create(
            user=request.user if request and request.user.is_authenticated else None,
            action=action,
            target_type=target,
            target_id=obj.pk,
            metadata=extra or {},
        )

    def save_model(self, request, obj, form, change):
        super().save_model(request, obj, form, change)
        self.log_audit(request, obj, "updated" if change else "created")

    def delete_model(self, request, obj):
        self.log_audit(request, obj, "deleted")
        super().delete_model(request, obj)

    def delete_queryset(self, request, queryset):
        for obj in queryset:
            self.log_audit(request, obj, "deleted")
        super().delete_queryset(request, queryset)


@admin.register(Lesson)
class LessonAdmin(EducationAuditMixin, admin.ModelAdmin):
    audit_target_type = "Lesson"
    """Admin configuration for managing lessons."""
    inlines = [LessonSectionInline]
    list_display = ("title", "course", "section_count", "published_section_count", "last_updated")
    list_filter = ("course",)
    search_fields = ("title", "course__title")
    actions = ["migrate_legacy_content"]
    fieldsets = (
        (None, {"fields": ("course", "title", "short_description")}),
        (
            "Legacy lesson content (editable but superseded by lesson sections)",
            {
                "classes": ("collapse",),
                "fields": (
                    "detailed_content",
                    "image",
                    "video_url",
                    "exercise_type",
                    "exercise_data",
                ),
            },
        ),
    )

    def section_count(self, obj):
        """Return the count of sections in a lesson."""
        return obj.sections.count()

    def published_section_count(self, obj):
        """Return the count of published sections in a lesson."""
        return obj.sections.filter(is_published=True).count()

    def last_updated(self, obj):
        """Return the most recent section update timestamp for the lesson."""
        latest_section = obj.sections.order_by("-updated_at").first()
        return latest_section.updated_at if latest_section else None

    def save_formset(self, request, form, formset, change):
        """Persist inline sections while tracking editor metadata."""

        instances = formset.save(commit=False)

        for obj in formset.deleted_objects:
            obj.delete()

        for instance in instances:
            was_new = instance.pk is None
            if isinstance(instance, LessonSection):
                instance.updated_by = request.user
            instance.save()
            self.log_audit(
                request,
                instance,
                "created" if was_new else "updated",
                extra={"parent_lesson": form.instance.pk},
                target_type="LessonSection",
            )

        formset.save_m2m()

    @admin.action(description="Migrate legacy content into sections")
    def migrate_legacy_content(self, request, queryset):
        created_sections = 0
        for lesson in queryset:
            next_order = lesson.sections.count()
            payloads = []

            if lesson.detailed_content:
                payloads.append(
                    {
                        "title": lesson.title,
                        "content_type": "text",
                        "text_content": lesson.detailed_content,
                    }
                )
            if lesson.video_url:
                payloads.append(
                    {
                        "title": f"{lesson.title} - Video",
                        "content_type": "video",
                        "video_url": lesson.video_url,
                    }
                )
            if lesson.exercise_type:
                payloads.append(
                    {
                        "title": f"{lesson.title} - Exercise",
                        "content_type": "exercise",
                        "exercise_type": lesson.exercise_type,
                        "exercise_data": lesson.exercise_data or {},
                    }
                )

            for offset, payload in enumerate(payloads, start=1):
                LessonSection.objects.get_or_create(
                    lesson=lesson,
                    order=next_order + offset,
                    defaults={**payload, "is_published": True},
                )
                created_sections += 1

        self.message_user(
            request,
            f"Created {created_sections} lesson section(s) from legacy content.",
        )


class MultipleChoiceChoiceInline(admin.StackedInline):
    """Inline for managing discrete multiple-choice options."""

    model = MultipleChoiceChoice
    extra = 0
    fields = ("order", "text", "is_correct", "explanation")
    ordering = ("order",)


@admin.register(Exercise)
class ExerciseAdmin(EducationAuditMixin, admin.ModelAdmin):
    audit_target_type = "Exercise"
    """Admin configuration for managing exercises."""

    list_display = ("type", "category", "difficulty", "version", "is_published", "created_at")
    list_filter = ("type", "category", "difficulty", "is_published")
    search_fields = ("question", "category", "misconception_tags")
    readonly_fields = ("preview",)
    fieldsets = (
        (None, {"fields": ("type", "category", "difficulty", "version", "is_published")}),
        ("Content", {"fields": ("question", "exercise_data", "correct_answer", "preview")}),
        ("Quality Metadata", {"fields": ("misconception_tags", "error_patterns")}),
    )
    formfield_overrides = {
        models.JSONField: {"widget": PrettyJSONWidget},
    }
    actions = ["publish_selected", "duplicate_for_editing"]

    def get_inlines(self, request, obj=None):
        if obj and obj.type == "multiple-choice":
            return [MultipleChoiceChoiceInline]
        return []

    def preview(self, obj):
        if not obj:
            return "-"

        parts = [format_html("<strong>{}</strong>", obj.question)]
        if obj.type == "multiple-choice":
            options = (
                obj.exercise_data.get("options") if isinstance(obj.exercise_data, dict) else None
            )
            if options:
                items = format_html_join("", "<li>{}</li>", ((opt,) for opt in options))
                parts.append(format_html("<ol>{}</ol>", items))
        elif obj.type == "budget-allocation":
            data = obj.exercise_data if isinstance(obj.exercise_data, dict) else {}
            categories = data.get("categories", [])
            total = data.get("total")
            summary = f"Categories: {', '.join(categories)}" if categories else "No categories"
            if total is not None:
                summary = f"{summary} (Total {total})"
            parts.append(summary)
        return format_html("<div>{}</div>", format_html("<br/>".join(parts)))

    preview.short_description = "Learner preview"

    def save_model(self, request, obj, form, change):
        if change:
            existing = Exercise.objects.get(pk=obj.pk)
            if existing.is_published and existing.version == obj.version:
                raise ValidationError(
                    "Published exercises are immutable. Increment version to publish a new revision."
                )
        super().save_model(request, obj, form, change)

    def save_related(self, request, form, formsets, change):
        super().save_related(request, form, formsets, change)

        exercise = form.instance
        if exercise.type != "multiple-choice":
            return

        choices = list(exercise.multiple_choice_choices.all())
        if not choices:
            return

        exercise.exercise_data = exercise.exercise_data or {}
        exercise.exercise_data["options"] = [choice.text for choice in choices]
        correct_indices = [idx for idx, choice in enumerate(choices) if choice.is_correct]
        exercise.correct_answer = (
            correct_indices if len(correct_indices) != 1 else correct_indices[0]
        )
        exercise.save(update_fields=["exercise_data", "correct_answer"])
        self.log_audit(request, exercise, "updated", extra={"synced_choices": len(choices)})

    @admin.action(description="Publish selected exercises")
    def publish_selected(self, request, queryset):
        updated = queryset.update(is_published=True)
        self.message_user(request, f"Published {updated} exercise(s).")
        for exercise in queryset:
            self.log_audit(request, exercise, "published")

    @admin.action(description="Duplicate as next version for editing")
    def duplicate_for_editing(self, request, queryset):
        created = 0
        with transaction.atomic():
            for exercise in queryset:
                clone = Exercise.objects.get(pk=exercise.pk)
                clone.pk = None
                clone.version = exercise.version + 1
                clone.is_published = False
                clone.save()

                for choice in exercise.multiple_choice_choices.all():
                    MultipleChoiceChoice.objects.create(
                        exercise=clone,
                        order=choice.order,
                        text=choice.text,
                        is_correct=choice.is_correct,
                        explanation=choice.explanation,
                    )
                created += 1
        self.message_user(request, f"Created {created} draft version(s).")
        for exercise in queryset:
            self.log_audit(
                request, exercise, "version duplicated", extra={"new_version": exercise.version + 1}
            )


@admin.register(UserExerciseProgress)
class UserExerciseProgressAdmin(admin.ModelAdmin):
    """Admin configuration for managing user exercise progress."""

    list_display = ("user", "exercise", "completed", "attempts")
    list_filter = ("completed", "exercise__type")
    search_fields = ("user__username", "exercise__question")


@admin.register(Question)
class QuestionAdmin(admin.ModelAdmin):
    """Admin configuration for managing questions."""

    list_display = ("text", "type", "order", "is_active")
    list_filter = ("type", "is_active")
    search_fields = ("text",)


@admin.register(PollResponse)
class PollResponseAdmin(admin.ModelAdmin):
    """Admin configuration for managing poll responses."""

    list_display = ("question", "answer", "responded_at")
    list_filter = ("question",)


admin.site.register(Path)
admin.site.register(Course)
admin.site.register(Quiz)


@admin.register(UserProgress)
class UserProgressAdmin(admin.ModelAdmin):
    """Surface engagement and streak data for progress tracking."""

    list_display = (
        "user",
        "course",
        "is_course_complete",
        "completed_lessons_count",
        "completed_sections_count",
        "streak",
        "last_completed_date",
    )
    list_filter = ("course", "is_course_complete")
    search_fields = ("user__username", "course__title")

    def completed_lessons_count(self, obj):
        return obj.completed_lessons.count()

    completed_lessons_count.short_description = "Lessons"

    def completed_sections_count(self, obj):
        return obj.completed_sections.count()

    completed_sections_count.short_description = "Sections"


@admin.register(LessonSection)
class LessonSectionAdmin(EducationAuditMixin, admin.ModelAdmin):
    audit_target_type = "LessonSection"
    """Standalone admin for lesson sections to manage draft/publish workflows."""

    list_display = (
        "title",
        "lesson",
        "content_type",
        "order",
        "is_published",
        "updated_at",
        "updated_by",
    )
    list_filter = ("content_type", "is_published", "lesson__course")
    search_fields = ("title", "lesson__title", "lesson__course__title")
    ordering = ("lesson", "order")
    readonly_fields = ("updated_at", "updated_by")

    def save_model(self, request, obj, form, change):
        obj.updated_by = request.user
        super().save_model(request, obj, form, change)
        self.log_audit(request, obj, "updated" if change else "created")


@admin.register(EducationAuditLog)
class EducationAuditLogAdmin(admin.ModelAdmin):
    """Read-only view of recent education edits for accountability."""

    list_display = ("action", "target_type", "target_id", "user", "created_at")
    list_filter = ("target_type", "action")
    search_fields = ("target_type", "target_id", "user__username")
    readonly_fields = ("action", "target_type", "target_id", "user", "metadata", "created_at")
    ordering = ("-created_at",)

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(SectionCompletion)
class SectionCompletionAdmin(admin.ModelAdmin):
    """Admin to inspect section-level completions for troubleshooting engagement."""

    list_display = ("section", "user", "lesson", "course", "completed_at")
    list_filter = ("section__lesson__course", "section__lesson")
    search_fields = ("section__title", "user_progress__user__username", "section__lesson__title")

    def user(self, obj):
        return getattr(obj.user_progress, "user", None)

    def lesson(self, obj):
        return getattr(obj.section, "lesson", None)

    def course(self, obj):
        if obj.section and obj.section.lesson:
            return obj.section.lesson.course
        return None

    user.admin_order_field = "user_progress__user"
    lesson.admin_order_field = "section__lesson"
    course.admin_order_field = "section__lesson__course"

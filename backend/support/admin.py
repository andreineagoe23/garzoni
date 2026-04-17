# support/admin.py
from django.contrib import admin
from support.models import SupportEntry, SupportFeedback, ContactMessage


@admin.register(SupportEntry)
class SupportEntryAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "category",
        "question_preview",
        "is_active",
        "helpful_count",
        "not_helpful_count",
    )
    list_filter = ("category", "is_active")

    def question_preview(self, obj):
        return (obj.question[:60] + "…") if len(obj.question) > 60 else obj.question

    question_preview.short_description = "Question"


@admin.register(SupportFeedback)
class SupportFeedbackAdmin(admin.ModelAdmin):
    list_display = ("id", "user", "support_entry_preview", "vote", "created_at")
    list_filter = ("vote",)

    def support_entry_preview(self, obj):
        q = obj.support_entry.question
        return (q[:50] + "…") if len(q) > 50 else q

    support_entry_preview.short_description = "Entry"


@admin.register(ContactMessage)
class ContactMessageAdmin(admin.ModelAdmin):
    """Contact form and feedback hub submissions (not FAQ votes)."""

    list_display = ("id", "email", "topic", "message_preview", "created_at")
    list_filter = ("topic",)
    search_fields = ("email", "topic", "message")
    ordering = ("-created_at",)
    readonly_fields = ("email", "topic", "message", "created_at")

    def message_preview(self, obj):
        return (obj.message[:80] + "…") if len(obj.message) > 80 else obj.message

    message_preview.short_description = "Message"

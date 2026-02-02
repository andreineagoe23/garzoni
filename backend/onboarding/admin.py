from django.contrib import admin
from onboarding.models import QuestionnaireVersion, QuestionnaireProgress


@admin.register(QuestionnaireVersion)
class QuestionnaireVersionAdmin(admin.ModelAdmin):
    list_display = ["version", "is_active", "created_at"]
    list_filter = ["is_active", "created_at"]
    search_fields = ["version"]
    readonly_fields = ["created_at"]


@admin.register(QuestionnaireProgress)
class QuestionnaireProgressAdmin(admin.ModelAdmin):
    list_display = [
        "user",
        "version",
        "status",
        "current_section_index",
        "current_question_index",
        "started_at",
        "updated_at",
        "completed_at",
        "rewards_granted",
    ]
    list_filter = ["status", "rewards_granted", "version", "started_at"]
    search_fields = ["user__username", "user__email"]
    readonly_fields = ["started_at", "updated_at", "completed_at"]
    raw_id_fields = ["user", "version"]


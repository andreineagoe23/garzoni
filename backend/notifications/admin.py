from django.contrib import admin

from notifications.models import NotificationIdempotency


@admin.register(NotificationIdempotency)
class NotificationIdempotencyAdmin(admin.ModelAdmin):
    list_display = ("purpose", "key", "created_at")
    search_fields = ("key", "purpose")
    readonly_fields = ("key", "purpose", "metadata", "created_at")

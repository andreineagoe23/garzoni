from django.contrib import admin

from core.admin_mixins import ReadOnlyAdminMixin
from notifications.models import NotificationIdempotency


@admin.register(NotificationIdempotency)
class NotificationIdempotencyAdmin(ReadOnlyAdminMixin, admin.ModelAdmin):
    # Idempotency keys gate duplicate sends; mutating them could re-fire
    # notifications, so this is strictly view-only.
    list_display = ("purpose", "key", "created_at")
    search_fields = ("key", "purpose")
    readonly_fields = ("key", "purpose", "metadata", "created_at")

from django.db import models


class NotificationIdempotency(models.Model):
    """
    Prevents duplicate sends when Celery retries or overlapping schedulers run.
    """

    key = models.CharField(max_length=255, unique=True, db_index=True)
    purpose = models.CharField(max_length=64, db_index=True)
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "notifications_idempotency"
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return f"{self.purpose}:{self.key[:40]}"

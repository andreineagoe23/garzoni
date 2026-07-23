from django.db import models


class PushTicket(models.Model):
    """
    An accepted Expo push ticket, awaiting its delivery receipt.

    Expo's `/push/send` response only says the message was *queued*. The real
    APNs/FCM verdict arrives later from `/push/getReceipts`, and it is the only
    place a revoked APNs key (`InvalidCredentials`) or a dead device
    (`DeviceNotRegistered`) ever surfaces. Without this table every layer
    reports success while Apple silently drops everything — which is exactly how
    push stayed broken here for months.
    """

    STATUS_PENDING = "pending"
    STATUS_OK = "ok"
    STATUS_ERROR = "error"
    STATUS_EXPIRED = "expired"
    STATUS_CHOICES = [
        (STATUS_PENDING, "Pending"),
        (STATUS_OK, "Delivered"),
        (STATUS_ERROR, "Error"),
        (STATUS_EXPIRED, "Expired before check"),
    ]

    ticket_id = models.CharField(max_length=128, unique=True, db_index=True)
    user_id = models.IntegerField(null=True, blank=True, db_index=True)
    token = models.CharField(max_length=200, blank=True, default="")
    purpose = models.CharField(max_length=64, blank=True, default="")
    status = models.CharField(
        max_length=16, choices=STATUS_CHOICES, default=STATUS_PENDING, db_index=True
    )
    error_code = models.CharField(max_length=64, blank=True, default="")
    detail = models.TextField(blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    checked_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "notifications_push_ticket"
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return f"{self.ticket_id[:20]} {self.status}"


class NotificationIdempotency(models.Model):
    """
    Prevents duplicate sends when Celery retries or overlapping schedulers run.
    """

    key = models.CharField(max_length=255, unique=True, db_index=True)
    purpose = models.CharField(max_length=64, db_index=True)
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name_plural = "Notification idempotencies"
        db_table = "notifications_idempotency"
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return f"{self.purpose}:{self.key[:40]}"

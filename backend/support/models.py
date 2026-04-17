from django.db import models
from django.contrib.auth.models import User


class SupportEntry(models.Model):
    category = models.CharField(max_length=100)
    question = models.TextField()
    answer = models.TextField()
    is_active = models.BooleanField(default=True)
    helpful_count = models.PositiveIntegerField(default=0)
    not_helpful_count = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.question

    class Meta:
        db_table = "core_supportentry"
        constraints = [
            models.CheckConstraint(
                check=models.Q(helpful_count__gte=0),
                name="supportentry_helpful_count_gte_0",
            ),
            models.CheckConstraint(
                check=models.Q(not_helpful_count__gte=0),
                name="supportentry_not_helpful_count_gte_0",
            ),
        ]


class SupportFeedback(models.Model):
    """
    Tracks user feedback on support entries to prevent duplicate votes and maintain user-specific feedback.
    """

    user = models.ForeignKey(User, on_delete=models.CASCADE, null=True, blank=True)
    support_entry = models.ForeignKey(SupportEntry, on_delete=models.CASCADE)
    vote = models.CharField(
        max_length=20, choices=[("helpful", "Helpful"), ("not_helpful", "Not Helpful")]
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("user", "support_entry")
        indexes = [
            models.Index(fields=["user", "support_entry"]),
        ]
        db_table = "core_supportfeedback"

    def __str__(self):
        return f"{self.user.username if self.user else 'Anonymous'} - {self.support_entry.question[:50]}"


class ContactMessage(models.Model):
    email = models.EmailField()
    topic = models.CharField(max_length=100)
    message = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.email} - {self.topic}"

    class Meta:
        db_table = "core_contactmessage"

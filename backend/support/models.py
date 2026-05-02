from django.db import models
from django.contrib.auth.models import User
from django.utils import timezone


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


class Conversation(models.Model):
    """Persistent tutor conversation per user. One active conversation at a time."""

    SOURCE_CHOICES = [
        ("chat", "Chat"),
        ("exercise_hint", "Exercise Hint"),
        ("exercise_explain", "Exercise Explain"),
        ("voice", "Voice"),
        ("coach_brief", "Coach Brief"),
    ]

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="ai_conversations")
    source = models.CharField(max_length=32, choices=SOURCE_CHOICES, default="chat")
    summary = models.TextField(blank=True, default="")
    total_tokens = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "core_ai_conversation"
        indexes = [models.Index(fields=["user", "source", "-updated_at"])]

    def __str__(self):
        return f"Conversation({self.user_id}, {self.source}, {self.updated_at:%Y-%m-%d})"

    def trim_history(self, max_messages: int = 40) -> None:
        """Keep only the most recent max_messages, delete older ones."""
        ids_to_keep = list(
            self.messages.order_by("-created_at").values_list("id", flat=True)[:max_messages]
        )
        self.messages.exclude(id__in=ids_to_keep).delete()


class Message(models.Model):
    """Single turn within a Conversation."""

    ROLE_CHOICES = [
        ("system", "System"),
        ("user", "User"),
        ("assistant", "Assistant"),
        ("tool", "Tool"),
    ]

    conversation = models.ForeignKey(
        Conversation, on_delete=models.CASCADE, related_name="messages"
    )
    role = models.CharField(max_length=16, choices=ROLE_CHOICES)
    content = models.TextField()
    tool_call_id = models.CharField(max_length=64, blank=True, default="")
    tool_name = models.CharField(max_length=64, blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "core_ai_message"
        ordering = ["created_at"]
        indexes = [models.Index(fields=["conversation", "created_at"])]

    def __str__(self):
        return f"{self.role}: {self.content[:60]}"

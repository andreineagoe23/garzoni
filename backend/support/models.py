from django.db import models
from django.contrib.auth.models import User


class FAQ(models.Model):
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
        db_table = "core_faq"
        constraints = [
            models.CheckConstraint(
                check=models.Q(helpful_count__gte=0),
                name="faq_helpful_count_gte_0",
            ),
            models.CheckConstraint(
                check=models.Q(not_helpful_count__gte=0),
                name="faq_not_helpful_count_gte_0",
            ),
        ]


class FAQFeedback(models.Model):
    """
    Tracks user feedback on FAQs to prevent duplicate votes and maintain user-specific feedback.
    """

    user = models.ForeignKey(User, on_delete=models.CASCADE, null=True, blank=True)
    faq = models.ForeignKey(FAQ, on_delete=models.CASCADE)
    vote = models.CharField(
        max_length=20, choices=[("helpful", "Helpful"), ("not_helpful", "Not Helpful")]
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("user", "faq")
        indexes = [
            models.Index(fields=["user", "faq"]),
        ]
        db_table = "core_faqfeedback"

    def __str__(self):
        return f"{self.user.username if self.user else 'Anonymous'} - {self.faq.question[:50]}"


class ContactMessage(models.Model):
    email = models.EmailField()
    topic = models.CharField(max_length=100)
    message = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.email} - {self.topic}"

    class Meta:
        db_table = "core_contactmessage"

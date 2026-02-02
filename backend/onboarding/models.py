from django.db import models
from django.contrib.auth.models import User
from django.utils import timezone
from django.core.validators import MinValueValidator
import uuid


class QuestionnaireVersion(models.Model):
    """
    Tracks different versions of the questionnaire to handle changes
    without breaking in-progress runs.
    """

    version = models.PositiveIntegerField(unique=True, help_text="Version number")
    is_active = models.BooleanField(
        default=True, help_text="Whether this version is currently active"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    questionnaire_structure = models.JSONField(
        help_text="Complete questionnaire structure with questions, sections, and skip logic"
    )

    def __str__(self):
        return f"Questionnaire v{self.version}"

    class Meta:
        db_table = "onboarding_questionnaireversion"
        ordering = ["-version"]


class QuestionnaireProgress(models.Model):
    """
    Tracks partial responses, current question index, and timestamp
    for users completing the onboarding questionnaire.
    """

    STATUS_CHOICES = [
        ("in_progress", "In Progress"),
        ("completed", "Completed"),
        ("abandoned", "Abandoned"),
    ]

    user = models.OneToOneField(
        User, on_delete=models.CASCADE, related_name="questionnaire_progress"
    )
    version = models.ForeignKey(
        QuestionnaireVersion,
        on_delete=models.PROTECT,
        related_name="progress_entries",
        help_text="Questionnaire version this progress is for",
    )
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="in_progress")
    current_section_index = models.PositiveIntegerField(default=0)
    current_question_index = models.PositiveIntegerField(default=0)
    answers = models.JSONField(
        default=dict,
        help_text="Stored answers keyed by question_id",
    )
    section_answers = models.JSONField(
        default=dict,
        help_text="Answers organized by section for summary display",
    )
    started_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    rewards_granted = models.BooleanField(
        default=False, help_text="Whether rewards have been granted for completion"
    )
    completion_idempotency_key = models.CharField(
        max_length=64,
        unique=True,
        null=True,
        blank=True,
        help_text="Idempotency key to prevent duplicate reward grants",
    )
    time_spent_per_question = models.JSONField(
        default=dict,
        help_text="Time spent (in seconds) per question_id",
    )

    def __str__(self):
        return f"{self.user.username} - Questionnaire Progress (v{self.version.version})"

    def get_total_questions(self):
        """Total number of questions across all sections."""
        if not self.version.questionnaire_structure:
            return 0
        sections = self.version.questionnaire_structure.get("sections", [])
        return sum(len(s.get("questions", [])) for s in sections)

    def get_current_question_number(self):
        """1-based index of current question (questions answered so far + 1)."""
        total = self.get_total_questions()
        if total == 0:
            return 0
        sections = self.version.questionnaire_structure.get("sections", [])
        n = 0
        for i, sec in enumerate(sections):
            qs = sec.get("questions", [])
            for j in range(len(qs)):
                if i == self.current_section_index and j == self.current_question_index:
                    return n + 1
                n += 1
        return min(n + 1, total)

    def get_progress_percentage(self):
        """Completion percentage based on questions answered (not sections)."""
        total = self.get_total_questions()
        if total == 0:
            return 0
        if self.status == "completed":
            return 100
        # We're on current_question_number (1-based); questions answered = that - 1
        current = self.get_current_question_number()
        answered = max(0, current - 1)
        return int((answered / total) * 100)

    def get_completed_sections_count(self):
        """Get the number of completed sections."""
        if not self.version.questionnaire_structure:
            return 0
        sections = self.version.questionnaire_structure.get("sections", [])
        if not sections:
            return 0
        return min(
            self.current_section_index + (1 if self.status == "completed" else 0),
            len(sections),
        )

    class Meta:
        db_table = "onboarding_questionnaireprogress"
        indexes = [
            models.Index(fields=["user", "status"]),
            models.Index(fields=["updated_at"]),
        ]

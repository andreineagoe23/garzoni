from django.db import models
from django.contrib.auth.models import User
from django.utils import timezone
from core.utils import normalize_text_encoding


class Badge(models.Model):
    """
    Represents a badge that users can earn by meeting specific criteria.
    Includes details such as the badge name, description, image, criteria type, threshold, and level.
    """

    BADGE_LEVELS = [
        ("bronze", "Bronze"),
        ("silver", "Silver"),
        ("gold", "Gold"),
    ]
    CRITERIA_TYPES = [
        ("lessons_completed", "Lessons Completed"),
        ("courses_completed", "Courses Completed"),
        ("streak_days", "Streak Days"),
        ("points_earned", "Points Earned"),
        ("missions_completed", "Missions Completed"),
        ("savings_balance", "Savings Balance"),
    ]

    name = models.CharField(max_length=100)
    description = models.TextField()
    image = models.ImageField(upload_to="badges/", null=False, blank=False)
    criteria_type = models.CharField(max_length=50, choices=CRITERIA_TYPES)
    threshold = models.IntegerField()
    badge_level = models.CharField(max_length=10, choices=BADGE_LEVELS, default="bronze")
    is_active = models.BooleanField(default=True)
    criteria_slug = models.CharField(
        max_length=120,
        blank=True,
        default="",
        db_index=True,
        help_text="Optional content-specific criterion (e.g. path:slug). Evaluated in addition to criteria_type.",
    )

    def __str__(self):
        return self.name

    def save(self, *args, **kwargs):
        self.name = normalize_text_encoding(self.name) or ""
        self.description = normalize_text_encoding(self.description) or ""
        super().save(*args, **kwargs)

    class Meta:
        db_table = "core_badge"


class UserBadge(models.Model):
    """
    Represents a badge earned by a user. Tracks the user, the badge, and the timestamp when it was earned.
    Ensures that each user can earn a specific badge only once.
    """

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="earned_badges")
    badge = models.ForeignKey(Badge, on_delete=models.CASCADE)
    earned_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("user", "badge")
        db_table = "core_userbadge"

    def __str__(self):
        return f"{self.user.username} - {self.badge.name}"


class Mission(models.Model):
    """
    Represents a mission or task that users can complete to earn rewards or points.
    Missions can be categorized as daily or weekly and have specific goals such as completing lessons,
    adding savings, reading finance facts, or completing a learning path.
    """

    MISSION_TYPES = [("daily", "Daily"), ("weekly", "Weekly")]
    GOAL_TYPES = [
        ("complete_lesson", "Complete Lesson"),
        ("add_savings", "Add Savings"),
        ("read_fact", "Read Finance Fact"),
        ("complete_path", "Complete Path"),
        ("clear_review_queue", "Clear Review Queue"),
        ("streak_rescue", "Streak Rescue"),
    ]

    name = models.CharField(max_length=100)
    description = models.TextField()
    points_reward = models.IntegerField()
    mission_type = models.CharField(max_length=10, choices=MISSION_TYPES, default="daily")
    goal_type = models.CharField(max_length=50, choices=GOAL_TYPES, default="complete_lesson")
    goal_reference = models.JSONField(null=True, blank=True)
    fact = models.ForeignKey(
        "finance.FinanceFact",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        limit_choices_to={"is_active": True},
        related_name="missions",
    )
    # Template fields for admin
    is_template = models.BooleanField(
        default=False, help_text="If True, this is a template for generating missions"
    )
    purpose_statement = models.TextField(
        blank=True, help_text="Why this mission matters to the user"
    )
    # Mastery targeting
    target_weakest_skills = models.BooleanField(
        default=False, help_text="Target user's weakest skills for this mission"
    )
    min_difficulty = models.IntegerField(
        null=True, blank=True, help_text="Minimum difficulty level"
    )
    max_difficulty = models.IntegerField(
        null=True, blank=True, help_text="Maximum difficulty level"
    )

    def __str__(self):
        return f"{self.name} ({self.mission_type})"

    def clean(self):
        """Validate goal_reference based on goal_type."""
        from django.core.exceptions import ValidationError

        if not self.goal_reference:
            self.goal_reference = {}

        if self.goal_type == "complete_lesson":
            if "required_lessons" not in self.goal_reference:
                self.goal_reference["required_lessons"] = 1
            if not isinstance(self.goal_reference.get("required_lessons"), int):
                raise ValidationError("required_lessons must be an integer")
            if self.goal_reference["required_lessons"] < 1:
                raise ValidationError("required_lessons must be at least 1")

        elif self.goal_type == "add_savings":
            if "target" not in self.goal_reference:
                self.goal_reference["target"] = 100
            if not isinstance(self.goal_reference.get("target"), (int, float)):
                raise ValidationError("target must be a number")
            if self.goal_reference["target"] <= 0:
                raise ValidationError("target must be positive")

        elif self.goal_type == "clear_review_queue":
            if "target_count" not in self.goal_reference:
                self.goal_reference["target_count"] = 5
            if not isinstance(self.goal_reference.get("target_count"), int):
                raise ValidationError("target_count must be an integer")
            if self.goal_reference["target_count"] < 1:
                raise ValidationError("target_count must be at least 1")

        elif self.goal_type == "complete_path":
            # Path completion doesn't need specific goal_reference
            pass

        elif self.goal_type == "read_fact":
            # Fact reading doesn't need specific goal_reference
            pass

        elif self.goal_type == "streak_rescue":
            pass

    def save(self, *args, **kwargs):
        """Override save to run validation and normalize user-facing text."""
        self.name = normalize_text_encoding(self.name) or ""
        self.description = normalize_text_encoding(self.description) or ""
        self.purpose_statement = normalize_text_encoding(self.purpose_statement) or ""
        self.clean()
        super().save(*args, **kwargs)

    class Meta:
        db_table = "core_mission"


class MultiStepMission(models.Model):
    """Narrative mission that connects lessons, exercises, tools, and chat."""

    MISSION_TYPES = [("weekly", "Weekly"), ("campaign", "Campaign")]

    name = models.CharField(max_length=120)
    slug = models.SlugField(max_length=140, unique=True)
    description = models.TextField()
    mission_type = models.CharField(max_length=20, choices=MISSION_TYPES, default="weekly")
    steps = models.JSONField(default=list, blank=True)
    points_reward = models.IntegerField(default=0)
    badge_name = models.CharField(max_length=120, blank=True, default="")
    is_active = models.BooleanField(default=True)
    starts_at = models.DateTimeField(null=True, blank=True)
    ends_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name

    def save(self, *args, **kwargs):
        self.name = normalize_text_encoding(self.name) or ""
        self.description = normalize_text_encoding(self.description) or ""
        self.badge_name = normalize_text_encoding(self.badge_name) or ""
        super().save(*args, **kwargs)

    class Meta:
        db_table = "core_multistepmission"
        indexes = [
            models.Index(fields=["is_active", "mission_type"]),
            models.Index(fields=["starts_at", "ends_at"]),
        ]


class MultiStepMissionProgress(models.Model):
    user = models.ForeignKey(
        User, related_name="multi_step_mission_progress", on_delete=models.CASCADE
    )
    mission = models.ForeignKey(
        MultiStepMission, related_name="progress_rows", on_delete=models.CASCADE
    )
    completed_steps = models.JSONField(default=list, blank=True)
    status = models.CharField(
        max_length=20,
        choices=[
            ("not_started", "Not Started"),
            ("in_progress", "In Progress"),
            ("completed", "Completed"),
        ],
        default="not_started",
    )
    started_at = models.DateTimeField(default=timezone.now)
    completed_at = models.DateTimeField(null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    def mark_step_complete(self, step_id: str):
        steps = list(self.completed_steps or [])
        if step_id not in steps:
            steps.append(step_id)
            self.completed_steps = steps
        total_steps = len(self.mission.steps or [])
        if total_steps and len(steps) >= total_steps:
            self.status = "completed"
            self.completed_at = self.completed_at or timezone.now()
        elif steps:
            self.status = "in_progress"
        self.save(update_fields=["completed_steps", "status", "completed_at", "updated_at"])

    class Meta:
        verbose_name_plural = "Multi-step mission progress"
        db_table = "core_multistepmissionprogress"
        unique_together = ("user", "mission")
        indexes = [
            models.Index(fields=["user", "status"]),
            models.Index(fields=["mission", "status"]),
        ]


class MissionCompletion(models.Model):
    """
    Tracks the progress and completion status of missions assigned to users.
    It includes fields for progress, status, and completion timestamp,
    and provides methods to update progress dynamically.
    """

    user = models.ForeignKey(User, related_name="mission_completions", on_delete=models.CASCADE)
    mission = models.ForeignKey(Mission, related_name="completions", on_delete=models.CASCADE)
    cycle_id = models.CharField(
        max_length=40,
        default="",
        blank=True,
        db_index=True,
        help_text="Period key for this row (daily ISO date, weekly ISO week). Empty = legacy rolling row.",
    )
    progress = models.IntegerField(default=0)
    status = models.CharField(
        max_length=20,
        choices=[
            ("not_started", "Not Started"),
            ("in_progress", "In Progress"),
            ("completed", "Completed"),
        ],
        default="not_started",
    )
    completed_at = models.DateTimeField(null=True, blank=True)
    # Mission swapping
    swapped_at = models.DateTimeField(
        null=True, blank=True, help_text="When this mission was swapped"
    )
    swapped_from_mission = models.ForeignKey(
        "self",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="swapped_to",
    )
    # Completion tracking for analytics
    first_try_bonus = models.BooleanField(
        default=False, help_text="Completed without retries/hints"
    )
    mastery_bonus = models.BooleanField(default=False, help_text="Completed with high mastery")
    xp_awarded = models.IntegerField(default=0, help_text="Actual XP awarded (server-calculated)")
    completion_time_seconds = models.IntegerField(
        null=True, blank=True, help_text="Time to complete in seconds"
    )
    # Idempotency
    completion_idempotency_key = models.CharField(
        max_length=64,
        null=True,
        blank=True,
        unique=True,
        help_text="Prevents duplicate completions",
    )

    class Meta:
        db_table = "core_missioncompletion"
        unique_together = [("user", "mission", "completion_idempotency_key")]
        constraints = [
            models.UniqueConstraint(
                fields=["user", "mission", "cycle_id"],
                name="missioncompletion_user_mission_cycle_uniq",
            ),
        ]
        indexes = [
            models.Index(fields=["user", "cycle_id"], name="core_missio_user_cycle_idx"),
        ]

    def update_progress(self, increment=0):
        if self.status == "completed":
            return

        goal_type = self.mission.goal_type
        mission_type = self.mission.mission_type
        goal_reference = self.mission.goal_reference or {}

        if goal_type == "complete_path":
            # Late import to avoid circular dependency
            from education.models import Path, Course, UserProgress

            best_progress = 0

            for path in Path.objects.all():
                total_courses = Course.objects.filter(path=path).count()
                if total_courses == 0:
                    continue

                completed_courses = UserProgress.objects.filter(
                    user=self.user, course__path=path, is_course_complete=True
                ).count()

                path_progress = int((completed_courses / total_courses) * 100)
                if path_progress > best_progress:
                    best_progress = path_progress

            self.progress = best_progress

        elif goal_type == "add_savings":
            target = goal_reference.get("target", 100)
            self.progress = min(self.progress + (increment / target) * 100, 100)

        elif goal_type == "read_fact":
            if mission_type == "daily":
                self.progress = 100
            elif mission_type == "weekly":
                self.progress = min(self.progress + 20, 100)  # 5 facts = 100%

        elif goal_type == "complete_lesson":
            required = goal_reference.get("required_lessons", 1)
            self.progress = min(self.progress + (100 / required), 100)

        elif goal_type == "clear_review_queue":
            # Late import to avoid circular dependency
            from education.models import Mastery

            as_of = timezone.now()
            due_count = Mastery.objects.filter(user=self.user, due_at__lte=as_of).count()
            target = goal_reference.get("target_count", 5)
            if due_count == 0:
                self.progress = 100
            else:
                completed = max(target - due_count, 0)
                self.progress = min(int((completed / target) * 100), 100)

        elif goal_type == "streak_rescue":
            self.progress = min(self.progress + max(float(increment), 1.0), 100)

        # Finalize mission if complete
        if self.progress >= 100:
            self.status = "completed"
            self.completed_at = timezone.now()

            if self.xp_awarded == 0:
                from decimal import Decimal

                from gamification.services.rewards import grant_reward

                base_xp = int(self.mission.points_reward or 0)
                if base_xp > 0:
                    result = grant_reward(
                        self.user,
                        f"mission_auto_complete:{self.user_id}:{self.mission_id}:{self.cycle_id}",
                        points=base_xp,
                        coins=Decimal("0"),
                        bump_streak="none",
                        evaluate_badges=True,
                    )
                    if result.granted:
                        self.xp_awarded = base_xp

            # Optional: reward badge
            if not UserBadge.objects.filter(user=self.user, badge__name="Mission Master").exists():
                try:
                    badge = Badge.objects.get(name="Mission Master")
                    UserBadge.objects.create(user=self.user, badge=badge)
                except Badge.DoesNotExist:
                    pass

        self.save()


class RewardLedgerEntry(models.Model):
    """
    Idempotent record of a reward grant (points/coins) so retries and split code paths
    cannot double-award the same logical event.
    """

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="reward_ledger_entries")
    event_key = models.CharField(max_length=220, db_index=True)
    points = models.IntegerField(default=0)
    coins = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "core_rewardledgerentry"
        constraints = [
            models.UniqueConstraint(
                fields=["user", "event_key"],
                name="reward_ledger_user_event_uniq",
            ),
        ]

    def __str__(self):
        return f"{self.user_id}:{self.event_key}"


class StreakItem(models.Model):
    """
    Represents items that users can use to preserve streaks or boost XP.
    """

    ITEM_TYPES = [
        ("streak_freeze", "Streak Freeze"),
        ("streak_boost", "Streak Boost"),
    ]

    user = models.ForeignKey(User, related_name="streak_items", on_delete=models.CASCADE)
    item_type = models.CharField(max_length=20, choices=ITEM_TYPES)
    quantity = models.PositiveIntegerField(default=0)
    expires_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "core_streakitem"
        unique_together = [("user", "item_type")]

    def __str__(self):
        return f"{self.user.username} - {self.get_item_type_display()} x{self.quantity}"


class MissionPerformance(models.Model):
    """
    Tracks analytics for mission performance and skill impact.
    """

    user = models.ForeignKey(User, related_name="mission_performance", on_delete=models.CASCADE)
    mission = models.ForeignKey(Mission, related_name="performance", on_delete=models.CASCADE)
    completion = models.OneToOneField(
        MissionCompletion,
        related_name="performance",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
    )
    # Performance metrics
    time_to_completion_seconds = models.IntegerField(null=True, blank=True)
    drop_off_stage = models.CharField(max_length=50, null=True, blank=True)
    skill_improvements = models.JSONField(default=dict, help_text="Skill proficiency changes")
    mastery_before = models.JSONField(default=dict, help_text="Mastery levels before mission")
    mastery_after = models.JSONField(default=dict, help_text="Mastery levels after mission")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "core_missionperformance"


class Duel(models.Model):
    """Persistent XP race between two users over a fixed window."""

    DURATION_CHOICES = [
        (24, "24 hours"),
        (72, "3 days"),
        (168, "7 days"),
    ]

    STATUS_PENDING = "pending"
    STATUS_ACTIVE = "active"
    STATUS_WON_CHALLENGER = "won_by_challenger"
    STATUS_WON_OPPONENT = "won_by_opponent"
    STATUS_DRAW = "draw"
    STATUS_DECLINED = "declined"
    STATUS_CANCELLED = "cancelled"
    STATUS_EXPIRED = "expired"

    STATUS_CHOICES = [
        (STATUS_PENDING, "Pending"),
        (STATUS_ACTIVE, "Active"),
        (STATUS_WON_CHALLENGER, "Won by challenger"),
        (STATUS_WON_OPPONENT, "Won by opponent"),
        (STATUS_DRAW, "Draw"),
        (STATUS_DECLINED, "Declined"),
        (STATUS_CANCELLED, "Cancelled"),
        (STATUS_EXPIRED, "Expired"),
    ]

    FINAL_STATUSES = {
        STATUS_WON_CHALLENGER,
        STATUS_WON_OPPONENT,
        STATUS_DRAW,
        STATUS_DECLINED,
        STATUS_CANCELLED,
        STATUS_EXPIRED,
    }

    challenger = models.ForeignKey(User, related_name="duels_initiated", on_delete=models.CASCADE)
    opponent = models.ForeignKey(User, related_name="duels_received", on_delete=models.CASCADE)
    status = models.CharField(max_length=24, choices=STATUS_CHOICES, default=STATUS_PENDING)
    duration_hours = models.PositiveIntegerField()
    bonus_xp = models.PositiveIntegerField(default=100)

    created_at = models.DateTimeField(auto_now_add=True)
    accepted_at = models.DateTimeField(null=True, blank=True)
    ends_at = models.DateTimeField(null=True, blank=True)
    finished_at = models.DateTimeField(null=True, blank=True)

    challenger_xp_start = models.IntegerField(default=0)
    opponent_xp_start = models.IntegerField(default=0)
    challenger_xp_end = models.IntegerField(null=True, blank=True)
    opponent_xp_end = models.IntegerField(null=True, blank=True)

    winner = models.ForeignKey(
        User,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="duels_won",
    )

    class Meta:
        db_table = "core_duel"
        indexes = [
            models.Index(fields=["challenger", "status"], name="duel_chal_status_idx"),
            models.Index(fields=["opponent", "status"], name="duel_opp_status_idx"),
            models.Index(fields=["status", "ends_at"], name="duel_status_ends_idx"),
        ]

    def __str__(self):
        return f"Duel #{self.id} {self.challenger_id} vs {self.opponent_id} ({self.status})"

    @property
    def is_final(self) -> bool:
        return self.status in self.FINAL_STATUSES


# Celery implementations live in gamification.tasks; names are registered as
# gamification.models.reset_* — re-export so imports match Beat / introspection.
from gamification.tasks import reset_daily_missions, reset_weekly_missions  # noqa: E402

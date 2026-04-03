from django.db import models
from django.contrib.auth.models import User
from decimal import Decimal
from django.utils import timezone
import uuid
from django.core import signing


class UserProfile(models.Model):
    """
    The UserProfile model extends the default User model with additional attributes like earned money, points,
    referral details, and preferences such as dark mode and email reminders. It also tracks user activity
    through streaks and last completed dates, providing methods to update these attributes dynamically.
    """

    REMINDER_CHOICES = [
        ("none", "No Reminders"),
        ("weekly", "Weekly"),
        ("monthly", "Monthly"),
    ]

    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="profile")
    earned_money = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    points = models.IntegerField(default=0)
    profile_avatar = models.URLField(null=True, blank=True)
    recommended_courses = models.JSONField(default=list, blank=True)
    recommendations_generated_at = models.DateTimeField(null=True, blank=True)
    referral_code = models.CharField(
        max_length=20,
        unique=True,
        blank=False,
        null=True,
    )
    referral_points = models.PositiveIntegerField(default=0)
    dark_mode = models.BooleanField(default=False)
    has_paid = models.BooleanField(default=False)
    is_premium = models.BooleanField(default=False)
    subscription_plan_id = models.CharField(
        max_length=32,
        blank=True,
        null=True,
        help_text="Subscription tier identifier (starter, plus, pro).",
    )
    stripe_payment_id = models.CharField(max_length=255, blank=True, null=True, db_index=True)
    stripe_customer_id = models.CharField(
        max_length=255,
        blank=True,
        null=True,
        db_index=True,
        help_text="Stripe customer ID; used for portal and to resolve subscription.",
    )
    stripe_subscription_id = models.CharField(
        max_length=255,
        blank=True,
        null=True,
        db_index=True,
        help_text="Stripe subscription ID for webhook updates (e.g. trial ended).",
    )
    subscription_status = models.CharField(
        max_length=50,
        default="inactive",
        help_text="Tracks the latest status returned by Stripe for this user's checkout session.",
    )
    trial_end = models.DateTimeField(
        null=True,
        blank=True,
        help_text="When the subscription trial ends (from Stripe); used for day-5 reminder.",
    )
    email_reminder_preference = models.CharField(
        max_length=10, choices=REMINDER_CHOICES, default="none"
    )
    sound_enabled = models.BooleanField(
        default=True, help_text="Allow lesson/exercise audio feedback."
    )
    animations_enabled = models.BooleanField(
        default=True, help_text="Allow celebratory and mascot animations."
    )
    streak = models.IntegerField(default=0)
    last_completed_date = models.DateField(null=True, blank=True)
    last_login_date = models.DateField(null=True, blank=True)
    last_reminder_sent = models.DateTimeField(null=True, blank=True)
    # Duolingo-like hearts system (lives)
    hearts = models.PositiveSmallIntegerField(default=5)
    hearts_last_refill_at = models.DateTimeField(default=timezone.now)
    # Financial profile (single source of truth for tools)
    goal_types = models.JSONField(default=list, blank=True)
    timeframe = models.CharField(max_length=32, blank=True, default="")
    risk_comfort = models.CharField(max_length=32, blank=True, default="")
    income_range = models.CharField(max_length=64, blank=True, default="")
    savings_rate_estimate = models.CharField(max_length=32, blank=True, default="")
    investing_experience = models.CharField(max_length=32, blank=True, default="")
    # Expo / mobile push (lesson reminders, streak alerts); updated via POST /api/auth/push-token/
    expo_push_token = models.CharField(max_length=200, blank=True, null=True)

    def __str__(self):
        return self.user.username

    def add_money(self, amount):
        amount = Decimal(str(amount))
        self.earned_money += amount
        self.save()

    def add_points(self, points):
        self.points += points
        self.save()

    def update_streak(self):
        today = timezone.now().date()

        if self.last_completed_date == today:
            return

        if self.last_completed_date:
            difference = (today - self.last_completed_date).days
            if difference == 1:
                self.streak += 1
            else:
                self.streak = 1
        else:
            self.streak = 1

        self.last_completed_date = today
        self.save()

    def save(self, *args, **kwargs):
        if not self.referral_code or self.referral_code.strip() == "":
            self.referral_code = None
        if not self.referral_code:
            self.referral_code = uuid.uuid4().hex[:8].upper()
        super().save(*args, **kwargs)

    def get_unsubscribe_token(self) -> str:
        """
        One-click unsubscribe token for reminder emails.
        Uses Django signing so we don't need to store a token in the DB.
        """
        return signing.dumps(
            {"profile_id": self.pk},
            salt="monevo.email.unsubscribe",
        )

    class Meta:
        verbose_name = "User Profile"
        verbose_name_plural = "User Profiles"
        db_table = "core_userprofile"


class UserEmailPreference(models.Model):
    """Per-email-category preferences and reminder cadence."""

    REMINDER_FREQUENCY_CHOICES = [
        ("none", "No Reminders"),
        ("weekly", "Weekly"),
        ("monthly", "Monthly"),
    ]

    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="email_preferences")
    reminders = models.BooleanField(default=True)
    streak_alerts = models.BooleanField(default=True)
    weekly_digest = models.BooleanField(default=True)
    billing_alerts = models.BooleanField(default=True)
    marketing = models.BooleanField(default=False)
    reminder_frequency = models.CharField(
        max_length=10, choices=REMINDER_FREQUENCY_CHOICES, default="weekly"
    )
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "core_useremailpreference"

    def __str__(self):
        return f"Email prefs for {self.user.username}"


class Referral(models.Model):
    """
    Tracks referrals made by users. Links the referrer to the referred user and records the timestamp of the referral.
    Ensures that each referred user is linked to only one referrer.
    """

    referrer = models.ForeignKey(User, on_delete=models.CASCADE, related_name="referrals_made")
    referred_user = models.OneToOneField(
        User, on_delete=models.CASCADE, related_name="referral_received"
    )
    created_at = models.DateTimeField(auto_now_add=True)

    referral_code = models.CharField(max_length=20, unique=True, blank=True)
    referral_points = models.PositiveIntegerField(default=0)

    def __str__(self):
        return f"{self.referrer.username} -> {self.referred_user.username}"

    class Meta:
        db_table = "core_referral"


class FriendRequest(models.Model):
    """
    Represents a friend request between two users. Tracks the sender, receiver,
    the status of the request (pending, accepted, or rejected), and the timestamp of creation.
    """

    STATUS_CHOICES = [
        ("pending", "Pending"),
        ("accepted", "Accepted"),
        ("rejected", "Rejected"),
    ]

    sender = models.ForeignKey(User, on_delete=models.CASCADE, related_name="sent_requests")
    receiver = models.ForeignKey(User, on_delete=models.CASCADE, related_name="received_requests")
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default="pending")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("sender", "receiver")
        db_table = "core_friendrequest"

    def __str__(self):
        return f"{self.sender.username} -> {self.receiver.username}"

import logging
import uuid
from datetime import timedelta
from decimal import Decimal

from django.contrib.auth.models import User
from django.core import signing
from django.db import models, transaction
from django.utils import timezone

logger = logging.getLogger(__name__)


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
    # Google (and other) avatar URLs can exceed URLField's default max_length=200.
    profile_avatar = models.URLField(max_length=2000, null=True, blank=True)
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
    stripe_payment_id = models.CharField(
        max_length=255, blank=True, null=True, db_index=True
    )
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
        max_length=10, choices=REMINDER_CHOICES, default="weekly"
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
    # Sign in with Apple: stable subject from Apple identity token (`sub` claim)
    apple_sub = models.CharField(
        max_length=255,
        unique=True,
        blank=True,
        null=True,
        db_index=True,
    )

    def __str__(self):
        return self.user.username

    def add_money(self, amount):
        amount = Decimal(str(amount))
        UserProfile.objects.filter(pk=self.pk).update(
            earned_money=models.F("earned_money") + amount
        )
        self.refresh_from_db(fields=["earned_money"])

    def add_points(self, points):
        UserProfile.objects.filter(pk=self.pk).update(
            points=models.F("points") + points
        )
        self.refresh_from_db(fields=["points"])

    def _try_bridge_one_gap_day_with_freeze(self, today) -> bool:
        """
        If the profile is more than one calendar day behind `today`, consume one
        streak freeze (if available) and advance `last_completed_date` by one day.
        Emits a zero-value ledger row for auditing.
        """
        if not self.last_completed_date:
            return False
        if (today - self.last_completed_date).days <= 1:
            return False

        from gamification.services.rewards import grant_reward
        from gamification.services.streak_freezes import consume_one_streak_freeze

        if not consume_one_streak_freeze(self.user):
            return False

        old = self.last_completed_date
        self.last_completed_date = old + timedelta(days=1)
        self.save(update_fields=["last_completed_date"])

        evt = (
            f"streak_freeze_used:{self.user_id}:"
            f"{today.isoformat()}:{old.isoformat()}->{self.last_completed_date.isoformat()}"
        )
        try:
            grant_reward(
                self.user,
                evt[:220],
                points=0,
                coins=Decimal("0"),
                bump_streak="none",
                evaluate_badges=False,
                record_zero_ledger=True,
            )
        except Exception:
            logger.debug("streak freeze ledger skipped", exc_info=True)
        return True

    def _bridge_gap_days_with_freezes(self, today) -> None:
        while self._try_bridge_one_gap_day_with_freeze(today):
            pass

    def update_streak(self):
        """
        Canonical learning streak on the profile. Consumes streak freezes one day
        at a time when the user returns after a gap.
        """
        today = timezone.localdate()

        if self.last_completed_date == today:
            return

        if not self.last_completed_date:
            self.streak = 1
            self.last_completed_date = today
            self.save(update_fields=["streak", "last_completed_date"])
            return

        self._bridge_gap_days_with_freezes(today)

        difference = (today - self.last_completed_date).days
        if difference <= 0:
            return
        if difference == 1:
            self.streak = int(self.streak or 0) + 1
            self.last_completed_date = today
            self.save(update_fields=["streak", "last_completed_date"])
            return

        prior_streak = int(self.streak or 0)
        self.streak = 1
        self.last_completed_date = today
        self.save(update_fields=["streak", "last_completed_date"])
        if prior_streak > 3 and getattr(self, "user_id", None):

            def _notify_streak_broken():
                try:
                    from authentication.tasks import send_streak_broken_email

                    send_streak_broken_email.delay(self.user_id, prior_streak)
                except Exception:
                    logger.warning(
                        "streak_broken_notify_enqueue_failed user_id=%s",
                        self.user_id,
                        exc_info=True,
                    )

            transaction.on_commit(_notify_streak_broken)

    def apply_manual_streak_freezes(self, max_uses: int = 1) -> int:
        """Use up to `max_uses` freezes without requiring a lesson completion."""
        today = timezone.localdate()
        used = 0
        for _ in range(max(0, int(max_uses))):
            if not self._try_bridge_one_gap_day_with_freeze(today):
                break
            used += 1
        return used

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
            salt="garzoni.email.unsubscribe",
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

    user = models.OneToOneField(
        User, on_delete=models.CASCADE, related_name="email_preferences"
    )
    reminders = models.BooleanField(default=True)
    streak_alerts = models.BooleanField(default=True)
    weekly_digest = models.BooleanField(default=True)
    billing_alerts = models.BooleanField(default=True)
    marketing = models.BooleanField(default=False)
    push_notifications = models.BooleanField(
        default=True,
        help_text="Allow push notifications; enforced in NotificationService before transactional push.",
    )
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

    referrer = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name="referrals_made"
    )
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

    sender = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name="sent_requests"
    )
    receiver = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name="received_requests"
    )
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default="pending")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("sender", "receiver")
        db_table = "core_friendrequest"

    def __str__(self):
        return f"{self.sender.username} -> {self.receiver.username}"

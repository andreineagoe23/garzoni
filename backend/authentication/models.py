from django.db import models
from django.contrib.auth.models import User
from decimal import Decimal
from django.utils import timezone
import uuid

class UserProfile(models.Model):
    """
    The UserProfile model extends the default User model with additional attributes like earned money, points, 
    referral details, and preferences such as dark mode and email reminders. It also tracks user activity 
    through streaks and last completed dates, providing methods to update these attributes dynamically.
    """
    REMINDER_CHOICES = [
        ('none', 'No Reminders'),
        ('daily', 'Daily'),
        ('weekly', 'Weekly')
    ]

    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='profile')
    earned_money = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    points = models.IntegerField(default=0)
    profile_avatar = models.URLField(null=True, blank=True)
    recommended_courses = models.JSONField(default=list, blank=True)
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
    stripe_payment_id = models.CharField(
        max_length=255,
        blank=True,
        null=True,
        db_index=True
    )
    subscription_status = models.CharField(
        max_length=50,
        default='inactive',
        help_text="Tracks the latest status returned by Stripe for this user's checkout session."
    )
    email_reminder_preference = models.CharField(
        max_length=10,
        choices=REMINDER_CHOICES,
        default='none'
    )
    streak = models.IntegerField(default=0)
    last_completed_date = models.DateField(null=True, blank=True)
    last_login_date = models.DateField(null=True, blank=True)
    last_reminder_sent = models.DateTimeField(null=True, blank=True)

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
        if not self.referral_code or self.referral_code.strip() == '':
            self.referral_code = None
        if not self.referral_code:
            self.referral_code = uuid.uuid4().hex[:8].upper()
        super().save(*args, **kwargs)

    class Meta:
        verbose_name = "User Profile"
        verbose_name_plural = "User Profiles"
        db_table = 'core_userprofile'


class Referral(models.Model):
    """
    Tracks referrals made by users. Links the referrer to the referred user and records the timestamp of the referral.
    Ensures that each referred user is linked to only one referrer.
    """
    referrer = models.ForeignKey(User, on_delete=models.CASCADE, related_name='referrals_made')
    referred_user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='referral_received')
    created_at = models.DateTimeField(auto_now_add=True)

    referral_code = models.CharField(max_length=20, unique=True, blank=True)
    referral_points = models.PositiveIntegerField(default=0)

    def __str__(self):
        return f"{self.referrer.username} -> {self.referred_user.username}"

    class Meta:
        db_table = 'core_referral'


class FriendRequest(models.Model):
    """
    Represents a friend request between two users. Tracks the sender, receiver, 
    the status of the request (pending, accepted, or rejected), and the timestamp of creation.
    """
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('accepted', 'Accepted'),
        ('rejected', 'Rejected'),
    ]

    sender = models.ForeignKey(User, on_delete=models.CASCADE, related_name='sent_requests')
    receiver = models.ForeignKey(User, on_delete=models.CASCADE, related_name='received_requests')
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='pending')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('sender', 'receiver')
        db_table = 'core_friendrequest'

    def __str__(self):
        return f"{self.sender.username} -> {self.receiver.username}"


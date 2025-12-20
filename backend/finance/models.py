from django.db import models
from django.contrib.auth.models import User


class FinanceFact(models.Model):
    """
    Represents a financial fact that can be displayed to users.
    Each fact belongs to a category and can be marked as active or inactive.
    """

    text = models.TextField()
    category = models.CharField(max_length=50, default="General")
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.text[:50] + "..."

    class Meta:
        db_table = "core_financefact"


class UserFactProgress(models.Model):
    """
    Tracks the progress of users in reading financial facts.
    Links a user to a specific fact and records the timestamp when it was read.
    """

    user = models.ForeignKey(User, on_delete=models.CASCADE)
    fact = models.ForeignKey(FinanceFact, on_delete=models.CASCADE)
    read_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("user", "fact")
        db_table = "core_userfactprogress"


class SimulatedSavingsAccount(models.Model):
    """
    Represents a simulated savings account for a user, allowing them to track and manage their virtual balance.
    Provides functionality to add funds to the balance.
    """

    user = models.OneToOneField(User, on_delete=models.CASCADE)
    balance = models.DecimalField(max_digits=10, decimal_places=2, default=0)

    def add_to_balance(self, amount):
        self.balance += amount
        self.save()

    class Meta:
        db_table = "core_simulatedsavingsaccount"


class Tool(models.Model):
    """
    Represents a financial tool or resource that users can access.
    Each tool is categorized and includes a name, description, URL, and optional icon.
    """

    name = models.CharField(max_length=100)
    description = models.TextField()
    category = models.CharField(
        max_length=50,
        choices=[
            ("basic_finance", "Basic Finance"),
            ("real_estate", "Real Estate"),
            ("crypto", "Crypto"),
            ("forex", "Forex"),
        ],
    )
    url = models.URLField(blank=True, null=True)
    icon = models.CharField(max_length=50, blank=True, null=True)

    class Meta:
        db_table = "core_tool"


class Reward(models.Model):
    """
    Represents a reward that users can purchase or donate towards.
    Rewards can be shop items or donation causes, with details like cost, type, and optional image.
    """

    REWARD_TYPES = [("shop", "Shop Item"), ("donate", "Donation Cause")]

    name = models.CharField(max_length=200)
    description = models.TextField()
    cost = models.DecimalField(max_digits=10, decimal_places=2)
    type = models.CharField(max_length=10, choices=REWARD_TYPES)
    image = models.ImageField(upload_to="rewards/", blank=True, null=True)
    is_active = models.BooleanField(default=True)
    donation_organization = models.CharField(max_length=200, blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name

    class Meta:
        db_table = "core_reward"


class UserPurchase(models.Model):
    """
    Represents a record of a user purchasing a reward.
    Tracks the user, the reward purchased, and the timestamp of the purchase.
    """

    user = models.ForeignKey(User, on_delete=models.CASCADE)
    reward = models.ForeignKey(Reward, on_delete=models.CASCADE)
    purchased_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.user.username} - {self.reward.name}"

    class Meta:
        db_table = "core_userpurchase"


class StripePayment(models.Model):
    """
    Represents a record of a payment made by a user through Stripe.
    Tracks the user, payment ID, amount, currency, and the timestamp of creation.
    """

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="payments")
    stripe_payment_id = models.CharField(max_length=255, unique=True)
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    currency = models.CharField(max_length=3, default="GBP")
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.user.username} - {self.amount} {self.currency}"

    class Meta:
        db_table = "core_stripepayment"


class PortfolioEntry(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    asset_type = models.CharField(max_length=20, choices=[("stock", "Stock"), ("crypto", "Crypto")])
    symbol = models.CharField(max_length=10)  # e.g., AAPL, BTC
    quantity = models.DecimalField(max_digits=20, decimal_places=8)
    purchase_price = models.DecimalField(max_digits=20, decimal_places=8)
    purchase_date = models.DateField()
    current_price = models.DecimalField(max_digits=20, decimal_places=8, null=True, blank=True)
    last_updated = models.DateTimeField(auto_now=True)

    def calculate_value(self):
        return self.quantity * (self.current_price or self.purchase_price)

    def calculate_gain_loss(self):
        if not self.current_price:
            return 0
        return (self.current_price - self.purchase_price) * self.quantity

    def calculate_gain_loss_percentage(self):
        if not self.current_price:
            return 0
        return ((self.current_price - self.purchase_price) / self.purchase_price) * 100

    class Meta:
        verbose_name_plural = "Portfolio Entries"
        ordering = ["-purchase_date"]
        db_table = "core_portfolioentry"


class FinancialGoal(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    goal_name = models.CharField(max_length=100)
    target_amount = models.DecimalField(max_digits=20, decimal_places=2)
    current_amount = models.DecimalField(max_digits=20, decimal_places=2, default=0)
    deadline = models.DateField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def progress_percentage(self):
        return (self.current_amount / self.target_amount) * 100 if self.target_amount > 0 else 0

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "Financial Goal"
        verbose_name_plural = "Financial Goals"
        db_table = "core_financialgoal"

    def __str__(self):
        return f"{self.user.username}'s {self.goal_name}"


class FunnelEvent(models.Model):
    """Capture funnel activity for pricing and checkout flows."""

    user = models.ForeignKey(User, null=True, blank=True, on_delete=models.SET_NULL)
    event_type = models.CharField(max_length=64)
    status = models.CharField(max_length=32, default="success")
    session_id = models.CharField(max_length=255, blank=True)
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["event_type", "created_at"]),
            models.Index(fields=["status", "created_at"]),
        ]

    def __str__(self):
        return f"{self.event_type} ({self.status})"

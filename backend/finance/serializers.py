# finance/serializers.py
from decimal import InvalidOperation
from rest_framework import serializers

from core.media_url import absolute_file_field_url
from finance.models import (
    FinanceFact,
    SimulatedSavingsAccount,
    Reward,
    UserPurchase,
    PortfolioEntry,
    FinancialGoal,
    ASSET_TYPE_CHOICES,
)
from django.utils import timezone


class SimulatedSavingsAccountSerializer(serializers.ModelSerializer):
    """
    Serializer for the SimulatedSavingsAccount model.
    Represents a user's simulated savings account, including the user and current balance.
    """

    class Meta:
        model = SimulatedSavingsAccount
        fields = ["id", "user", "balance"]
        read_only_fields = ["user"]


class RewardSerializer(serializers.ModelSerializer):
    """
    Serializer for the Reward model.
    Represents rewards that users can redeem, including details such as name, description, cost, type, image, and donation organization.
    """

    image = serializers.SerializerMethodField()

    class Meta:
        model = Reward
        fields = [
            "id",
            "name",
            "description",
            "cost",
            "type",
            "image",
            "donation_organization",
        ]

    def get_image(self, obj):
        if obj.image:
            return absolute_file_field_url(self.context.get("request"), obj.image)
        return None


class UserPurchaseSerializer(serializers.ModelSerializer):
    """
    Serializer for the UserPurchase model.
    Tracks purchases made by users, including the reward purchased and the timestamp of the purchase.
    """

    reward = RewardSerializer(read_only=True)

    class Meta:
        model = UserPurchase
        fields = ["id", "reward", "purchased_at"]
        read_only_fields = ["reward", "purchased_at"]

    def create(self, validated_data):
        """
        Creates a new UserPurchase instance for the authenticated user.
        """
        reward = validated_data.get("reward")
        return UserPurchase.objects.create(user=self.context["request"].user, reward=reward)


# Known crypto symbols (CoinGecko-style). Used to infer asset_type when saving.
CRYPTO_SYMBOLS = frozenset(
    {
        "btc",
        "bitcoin",
        "eth",
        "ethereum",
        "sol",
        "solana",
        "xrp",
        "ripple",
        "ada",
        "cardano",
        "doge",
        "dogecoin",
        "bnb",
        "binancecoin",
        "matic",
        "polynomial",
        "dot",
        "polkadot",
        "avax",
        "avalanche",
        "link",
        "chainlink",
        "uni",
        "uniswap",
        "atom",
        "cosmos",
        "ltc",
        "litecoin",
        "near",
        "fil",
        "filecoin",
        "apt",
        "aptos",
        "arb",
        "arbitrum",
        "op",
        "optimism",
        "inj",
        "injective",
        "sui",
        "stx",
        "stacks",
        "rune",
        "thorchain",
        "ftm",
        "fantom",
    }
)


class PortfolioEntrySerializer(serializers.ModelSerializer):
    current_value = serializers.SerializerMethodField()
    gain_loss = serializers.SerializerMethodField()
    gain_loss_percentage = serializers.SerializerMethodField()

    class Meta:
        model = PortfolioEntry
        fields = [
            "id",
            "asset_type",
            "symbol",
            "quantity",
            "purchase_price",
            "purchase_date",
            "current_price",
            "last_updated",
            "current_value",
            "gain_loss",
            "gain_loss_percentage",
            "is_paper_trade",
        ]
        read_only_fields = ["current_price", "last_updated"]

    def validate_asset_type(self, value):
        if not value or not value.strip():
            raise serializers.ValidationError("Asset type is required.")
        raw = value.strip().lower()
        valid = {choice[0] for choice in ASSET_TYPE_CHOICES}
        if raw not in valid:
            raise serializers.ValidationError(
                f"Asset type must be one of: {', '.join(sorted(valid))}."
            )
        return raw

    def validate_symbol(self, value):
        if not value or not str(value).strip():
            raise serializers.ValidationError("Symbol is required.")
        return str(value).strip()[:32]

    def validate_quantity(self, value):
        if value is None:
            raise serializers.ValidationError("Quantity is required.")
        try:
            q = float(value)
        except (TypeError, ValueError, InvalidOperation):
            raise serializers.ValidationError("Quantity must be a positive number.")
        if q <= 0:
            raise serializers.ValidationError("Quantity must be greater than zero.")
        return value

    def validate_purchase_price(self, value):
        if value is None:
            raise serializers.ValidationError("Purchase price is required.")
        try:
            p = float(value)
        except (TypeError, ValueError, InvalidOperation):
            raise serializers.ValidationError("Purchase price must be a number.")
        if p < 0:
            raise serializers.ValidationError("Purchase price cannot be negative.")
        return value

    def validate(self, attrs):
        symbol = (attrs.get("symbol") or "").strip().lower()
        asset_type = (attrs.get("asset_type") or "stock").strip().lower()
        # Only infer stock vs crypto from symbol when user picked one of those
        if symbol and asset_type in ("stock", "crypto"):
            if symbol in CRYPTO_SYMBOLS:
                attrs["asset_type"] = "crypto"
            else:
                attrs["asset_type"] = "stock"
        return attrs

    def get_current_value(self, obj):
        return obj.calculate_value()

    def get_gain_loss(self, obj):
        return obj.calculate_gain_loss()

    def get_gain_loss_percentage(self, obj):
        return obj.calculate_gain_loss_percentage()


class FinancialGoalSerializer(serializers.ModelSerializer):
    progress_percentage = serializers.SerializerMethodField()
    remaining_amount = serializers.SerializerMethodField()
    days_remaining = serializers.SerializerMethodField()
    status = serializers.SerializerMethodField()

    class Meta:
        model = FinancialGoal
        fields = [
            "id",
            "goal_name",
            "target_amount",
            "current_amount",
            "deadline",
            "created_at",
            "updated_at",
            "progress_percentage",
            "remaining_amount",
            "days_remaining",
            "status",
        ]
        read_only_fields = ["created_at", "updated_at"]

    def to_internal_value(self, data):
        """Map legacy client keys (name, target_date) to model fields."""
        if hasattr(data, "keys"):
            data = dict(data)
            if "name" in data:
                raw = data.pop("name")
                if raw is not None and str(raw).strip() and "goal_name" not in data:
                    data["goal_name"] = str(raw).strip()
            if "target_date" in data and "deadline" not in data:
                data["deadline"] = data.pop("target_date")
            elif "target_date" in data:
                data.pop("target_date")
        return super().to_internal_value(data)

    def get_status(self, obj):
        if obj.target_amount <= 0:
            return "not_started"
        if obj.current_amount >= obj.target_amount:
            return "completed"
        if obj.current_amount > 0:
            return "in_progress"
        return "not_started"

    def get_progress_percentage(self, obj):
        return obj.progress_percentage()

    def get_remaining_amount(self, obj):
        return obj.target_amount - obj.current_amount

    def get_days_remaining(self, obj):
        if obj.deadline:
            return (obj.deadline - timezone.now().date()).days
        return None

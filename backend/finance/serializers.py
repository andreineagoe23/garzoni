# finance/serializers.py
from rest_framework import serializers
from finance.models import (
    FinanceFact, SimulatedSavingsAccount, Reward, UserPurchase,
    PortfolioEntry, FinancialGoal
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
    class Meta:
        model = Reward
        fields = ['id', 'name', 'description', 'cost', 'type', 'image', 'donation_organization']


class UserPurchaseSerializer(serializers.ModelSerializer):
    """
    Serializer for the UserPurchase model.
    Tracks purchases made by users, including the reward purchased and the timestamp of the purchase.
    """
    reward = RewardSerializer(read_only=True)

    class Meta:
        model = UserPurchase
        fields = ['id', 'reward', 'purchased_at']
        read_only_fields = ['reward', 'purchased_at']

    def create(self, validated_data):
        """
        Creates a new UserPurchase instance for the authenticated user.
        """
        reward = validated_data.get('reward')
        return UserPurchase.objects.create(
            user=self.context['request'].user,
            reward=reward
        )


class PortfolioEntrySerializer(serializers.ModelSerializer):
    current_value = serializers.SerializerMethodField()
    gain_loss = serializers.SerializerMethodField()
    gain_loss_percentage = serializers.SerializerMethodField()

    class Meta:
        model = PortfolioEntry
        fields = [
            'id', 'asset_type', 'symbol', 'quantity', 'purchase_price',
            'purchase_date', 'current_price', 'last_updated',
            'current_value', 'gain_loss', 'gain_loss_percentage'
        ]
        read_only_fields = ['current_price', 'last_updated']

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

    class Meta:
        model = FinancialGoal
        fields = ['id', 'goal_name', 'target_amount', 'current_amount', 
                 'deadline', 'created_at', 'updated_at', 'progress_percentage',
                 'remaining_amount', 'days_remaining']
        read_only_fields = ['created_at', 'updated_at']

    def get_progress_percentage(self, obj):
        return obj.progress_percentage()

    def get_remaining_amount(self, obj):
        return obj.target_amount - obj.current_amount

    def get_days_remaining(self, obj):
        if obj.deadline:
            return (obj.deadline - timezone.now().date()).days
        return None


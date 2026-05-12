from rest_framework import serializers

from budgeting.models import (
    BudgetEnvelope,
    LinkedAccount,
    SpendingAnomaly,
    Transaction,
)


class LinkedAccountSerializer(serializers.ModelSerializer):
    class Meta:
        model = LinkedAccount
        fields = [
            "id",
            "provider",
            "display_name",
            "mask",
            "institution_name",
            "currency",
            "status",
            "last_synced_at",
            "consent_granted_at",
            "consent_revoked_at",
        ]
        read_only_fields = fields


class TransactionSerializer(serializers.ModelSerializer):
    category_slug = serializers.SerializerMethodField()

    class Meta:
        model = Transaction
        fields = [
            "id",
            "amount",
            "currency",
            "description",
            "merchant_name",
            "posted_at",
            "is_pending",
            "category_slug",
            "provider_category_raw",
            "source",
        ]
        read_only_fields = fields

    def get_category_slug(self, obj):
        if obj.category_id:
            return getattr(obj.category, "slug", None)
        return None


class BudgetEnvelopeSerializer(serializers.ModelSerializer):
    spent_this_period = serializers.DecimalField(
        max_digits=20, decimal_places=2, read_only=True, default=0
    )

    class Meta:
        model = BudgetEnvelope
        fields = [
            "id",
            "category",
            "label",
            "monthly_target",
            "currency",
            "is_active",
            "spent_this_period",
        ]
        read_only_fields = ["id", "spent_this_period"]


class BudgetEnvelopeCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = BudgetEnvelope
        fields = ["category", "label", "monthly_target", "currency", "is_active"]

    def validate_monthly_target(self, value):
        if value < 0:
            raise serializers.ValidationError("monthly_target must be non-negative")
        return value


class SpendingAnomalySerializer(serializers.ModelSerializer):
    class Meta:
        model = SpendingAnomaly
        fields = [
            "id",
            "kind",
            "severity",
            "category",
            "summary",
            "detail",
            "detected_for",
            "metadata",
            "resolved_at",
            "created_at",
        ]
        read_only_fields = fields

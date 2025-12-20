# support/serializers.py
from rest_framework import serializers
from support.models import FAQ, FAQFeedback, ContactMessage


class FAQSerializer(serializers.ModelSerializer):
    user_vote = serializers.SerializerMethodField()

    class Meta:
        model = FAQ
        fields = [
            "id",
            "category",
            "question",
            "answer",
            "helpful_count",
            "not_helpful_count",
            "user_vote",
        ]

    def get_user_vote(self, obj):
        request = self.context.get("request")
        if request and request.user.is_authenticated:
            feedback = FAQFeedback.objects.filter(faq=obj, user=request.user).first()
            return feedback.vote if feedback else None
        return None

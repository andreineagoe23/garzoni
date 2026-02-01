from rest_framework import serializers
from django.core.validators import MinValueValidator
from onboarding.models import QuestionnaireProgress, QuestionnaireVersion


class QuestionnaireVersionSerializer(serializers.ModelSerializer):
    class Meta:
        model = QuestionnaireVersion
        fields = ["version", "is_active", "created_at", "questionnaire_structure"]
        read_only_fields = ["created_at"]


class QuestionnaireProgressSerializer(serializers.ModelSerializer):
    progress_percentage = serializers.SerializerMethodField()
    completed_sections_count = serializers.SerializerMethodField()
    total_sections = serializers.SerializerMethodField()
    total_questions = serializers.SerializerMethodField()
    current_question_number = serializers.SerializerMethodField()

    class Meta:
        model = QuestionnaireProgress
        fields = [
            "id",
            "version",
            "status",
            "current_section_index",
            "current_question_index",
            "answers",
            "section_answers",
            "started_at",
            "updated_at",
            "completed_at",
            "rewards_granted",
            "progress_percentage",
            "completed_sections_count",
            "total_sections",
            "total_questions",
            "current_question_number",
        ]
        read_only_fields = [
            "id",
            "started_at",
            "updated_at",
            "completed_at",
            "rewards_granted",
        ]

    def get_progress_percentage(self, obj):
        return obj.get_progress_percentage()

    def get_completed_sections_count(self, obj):
        return obj.get_completed_sections_count()

    def get_total_sections(self, obj):
        if not obj.version.questionnaire_structure:
            return 0
        sections = obj.version.questionnaire_structure.get("sections", [])
        return len(sections)

    def get_total_questions(self, obj):
        return obj.get_total_questions()

    def get_current_question_number(self, obj):
        return obj.get_current_question_number()


class QuestionnaireAnswerSerializer(serializers.Serializer):
    """Serializer for saving individual answers."""

    question_id = serializers.CharField(required=True)
    answer = serializers.JSONField(required=True)
    section_index = serializers.IntegerField(required=True, validators=[MinValueValidator(0)])
    question_index = serializers.IntegerField(required=True, validators=[MinValueValidator(0)])
    time_spent_seconds = serializers.FloatField(required=False, allow_null=True, min_value=0)


class QuestionnaireNextQuestionResponseSerializer(serializers.Serializer):
    """Serializer for the next question response."""

    question = serializers.JSONField()
    section_index = serializers.IntegerField()
    question_index = serializers.IntegerField()
    total_sections = serializers.IntegerField()
    total_questions_in_section = serializers.IntegerField()
    total_questions = serializers.IntegerField(required=False)
    current_question_number = serializers.IntegerField(required=False)
    progress_percentage = serializers.IntegerField()
    is_last_question = serializers.BooleanField()
    section_summary = serializers.JSONField(required=False, allow_null=True)


class QuestionnaireCompletionSerializer(serializers.Serializer):
    """Serializer for completing the questionnaire."""

    idempotency_key = serializers.CharField(required=False, allow_blank=True)

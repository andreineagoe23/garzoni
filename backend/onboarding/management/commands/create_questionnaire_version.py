from django.core.management.base import BaseCommand
from onboarding.models import QuestionnaireVersion


class Command(BaseCommand):
    help = "Create the initial questionnaire version"

    def handle(self, *args, **options):
        # Deactivate any existing active versions
        QuestionnaireVersion.objects.filter(is_active=True).update(is_active=False)

        # Create version 1 with a sample questionnaire structure
        questionnaire_structure = {
            "sections": [
                {
                    "id": "experience",
                    "title": "Financial Experience",
                    "questions": [
                        {
                            "id": "experience_level",
                            "type": "multiple_choice",
                            "text": "What's your experience level with personal finance?",
                            "options": [
                                {"value": "beginner", "label": "Beginner"},
                                {"value": "intermediate", "label": "Intermediate"},
                                {"value": "advanced", "label": "Advanced"},
                            ],
                            "required": True,
                        },
                        {
                            "id": "primary_goals",
                            "type": "multiple_select",
                            "text": "What are your primary financial goals? (Select all that apply)",
                            "options": [
                                {"value": "budgeting", "label": "Better Budgeting"},
                                {"value": "saving", "label": "Saving Money"},
                                {"value": "investing", "label": "Investing"},
                                {"value": "debt", "label": "Paying Off Debt"},
                                {"value": "retirement", "label": "Retirement Planning"},
                            ],
                            "required": True,
                        },
                    ],
                },
                {
                    "id": "focus_areas",
                    "title": "Focus Areas",
                    "questions": [
                        {
                            "id": "focus_area",
                            "type": "multiple_choice",
                            "text": "What area would you like to focus on first?",
                            "options": [
                                {"value": "budgeting", "label": "Budgeting"},
                                {"value": "saving", "label": "Saving"},
                                {"value": "investing", "label": "Investing"},
                                {"value": "debt_management", "label": "Debt Management"},
                            ],
                            "required": True,
                            "skip_if": {
                                "field": "experience_level",
                                "operator": "==",
                                "value": "advanced",
                            },
                        },
                        {
                            "id": "time_commitment",
                            "type": "multiple_choice",
                            "text": "How much time can you commit per week?",
                            "options": [
                                {"value": "15_min", "label": "15 minutes"},
                                {"value": "30_min", "label": "30 minutes"},
                                {"value": "1_hour", "label": "1 hour"},
                                {"value": "2_plus_hours", "label": "2+ hours"},
                            ],
                            "required": True,
                        },
                    ],
                },
                {
                    "id": "preferences",
                    "title": "Learning Preferences",
                    "questions": [
                        {
                            "id": "learning_style",
                            "type": "multiple_choice",
                            "text": "How do you prefer to learn?",
                            "options": [
                                {"value": "visual", "label": "Visual (diagrams, charts)"},
                                {"value": "reading", "label": "Reading"},
                                {"value": "interactive", "label": "Interactive exercises"},
                                {"value": "mixed", "label": "Mixed approach"},
                            ],
                            "required": True,
                        },
                    ],
                },
            ],
        }

        version, created = QuestionnaireVersion.objects.get_or_create(
            version=1,
            defaults={
                "is_active": True,
                "questionnaire_structure": questionnaire_structure,
            },
        )

        if created:
            self.stdout.write(
                self.style.SUCCESS(f"Successfully created questionnaire version {version.version}")
            )
        else:
            version.is_active = True
            version.questionnaire_structure = questionnaire_structure
            version.save()
            self.stdout.write(
                self.style.SUCCESS(f"Successfully updated questionnaire version {version.version}")
            )


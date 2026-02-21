from django.db import migrations


def shorten_questionnaire(apps, schema_editor):
    """Replace questionnaire with a short version (~1-2 min): 2 sections, 6 questions."""
    QuestionnaireVersion = apps.get_model("onboarding", "QuestionnaireVersion")
    short_structure = {
        "sections": [
            {
                "id": "goals",
                "title": "Goals",
                "questions": [
                    {
                        "id": "primary_goal",
                        "type": "multiple_choice",
                        "text": "What's your top money goal right now?",
                        "options": [
                            {"value": "budget", "label": "Build a budget"},
                            {"value": "debt", "label": "Pay down debt"},
                            {"value": "savings", "label": "Grow savings"},
                            {"value": "invest", "label": "Start investing"},
                        ],
                        "required": True,
                    },
                    {
                        "id": "biggest_challenge",
                        "type": "multiple_choice",
                        "text": "What's your biggest challenge?",
                        "options": [
                            {"value": "overspending", "label": "Overspending"},
                            {"value": "no_plan", "label": "No clear plan"},
                            {"value": "debt", "label": "Debt"},
                            {"value": "confidence", "label": "Low confidence"},
                        ],
                        "required": True,
                    },
                    {
                        "id": "time_horizon",
                        "type": "multiple_choice",
                        "text": "When do you want to see progress?",
                        "options": [
                            {"value": "30_days", "label": "30 days"},
                            {"value": "3_months", "label": "3 months"},
                            {"value": "6_months", "label": "6 months"},
                            {"value": "year", "label": "A year"},
                        ],
                        "required": True,
                    },
                ],
            },
            {
                "id": "snapshot",
                "title": "Quick snapshot",
                "questions": [
                    {
                        "id": "income_type",
                        "type": "multiple_choice",
                        "text": "How do you get paid?",
                        "options": [
                            {"value": "salaried", "label": "Steady paycheck"},
                            {"value": "variable", "label": "Variable / freelance"},
                            {"value": "student", "label": "Student"},
                            {"value": "other", "label": "Other"},
                        ],
                        "required": True,
                    },
                    {
                        "id": "budgeting_style",
                        "type": "multiple_choice",
                        "text": "How do you manage money today?",
                        "options": [
                            {"value": "no_track", "label": "I don't track it"},
                            {"value": "basic", "label": "Basic tracking"},
                            {"value": "app", "label": "App or spreadsheet"},
                            {"value": "budget_plan", "label": "Strict budget plan"},
                        ],
                        "required": True,
                    },
                    {
                        "id": "learning_style",
                        "type": "multiple_choice",
                        "text": "How do you prefer to learn?",
                        "options": [
                            {"value": "quick", "label": "Quick lessons"},
                            {"value": "deep", "label": "Deep dives"},
                            {"value": "interactive", "label": "Interactive"},
                            {"value": "visual", "label": "Videos & visuals"},
                        ],
                        "required": True,
                    },
                ],
            },
        ],
    }
    version = QuestionnaireVersion.objects.filter(is_active=True).first()
    if not version:
        version = QuestionnaireVersion.objects.order_by("-version").first()
    if version:
        version.questionnaire_structure = short_structure
        version.save(update_fields=["questionnaire_structure"])


def noop_reverse(apps, schema_editor):
    """No reverse - previous structure not restored."""
    pass


class Migration(migrations.Migration):
    dependencies = [
        ("onboarding", "0002_seed_questionnaire_version"),
    ]

    operations = [
        migrations.RunPython(shorten_questionnaire, noop_reverse),
    ]

from django.core.management.base import BaseCommand
from onboarding.models import QuestionnaireVersion


class Command(BaseCommand):
    help = "Create the initial questionnaire version"

    def handle(self, *args, **options):
        # Deactivate any existing active versions
        QuestionnaireVersion.objects.filter(is_active=True).update(is_active=False)

        # Create version 1 with the onboarding questionnaire structure
        questionnaire_structure = {
            "sections": [
                {
                    "id": "goals",
                    "title": "Goals & Motivation",
                    "questions": [
                        {
                            "id": "primary_goals",
                            "type": "multiple_select",
                            "text": "What are your top money goals right now?",
                            "options": [
                                {"value": "build_budget", "label": "Build a realistic budget"},
                                {"value": "pay_down_debt", "label": "Pay down debt faster"},
                                {"value": "grow_savings", "label": "Grow savings / emergency fund"},
                                {"value": "start_investing", "label": "Start investing"},
                                {"value": "retirement", "label": "Plan for retirement"},
                                {"value": "improve_credit", "label": "Improve my credit score"},
                            ],
                            "required": True,
                        },
                        {
                            "id": "biggest_challenge",
                            "type": "multiple_choice",
                            "text": "What's your biggest challenge today?",
                            "options": [
                                {"value": "overspending", "label": "Overspending / impulse buys"},
                                {"value": "inconsistent_income", "label": "Inconsistent income"},
                                {"value": "debt_payments", "label": "High debt payments"},
                                {"value": "no_plan", "label": "I don't have a clear plan"},
                                {
                                    "value": "investing_confidence",
                                    "label": "Low investing confidence",
                                },
                            ],
                            "required": True,
                        },
                        {
                            "id": "time_horizon",
                            "type": "multiple_choice",
                            "text": "When do you want to feel real progress?",
                            "options": [
                                {"value": "30_days", "label": "In the next 30 days"},
                                {"value": "3_months", "label": "Within 3 months"},
                                {"value": "6_months", "label": "Within 6 months"},
                                {"value": "12_months", "label": "Within a year"},
                            ],
                            "required": True,
                        },
                    ],
                },
                {
                    "id": "snapshot",
                    "title": "Current Snapshot",
                    "questions": [
                        {
                            "id": "income_type",
                            "type": "multiple_choice",
                            "text": "Which best describes your income?",
                            "options": [
                                {"value": "salaried", "label": "Salaried / steady paycheck"},
                                {"value": "hourly", "label": "Hourly / variable"},
                                {"value": "self_employed", "label": "Self-employed / freelance"},
                                {"value": "student", "label": "Student"},
                                {"value": "retired", "label": "Retired"},
                                {"value": "other", "label": "Other"},
                            ],
                            "required": True,
                        },
                        {
                            "id": "budgeting_style",
                            "type": "multiple_choice",
                            "text": "How do you currently manage your money?",
                            "options": [
                                {"value": "no_budget", "label": "I don't track it"},
                                {
                                    "value": "basic_tracking",
                                    "label": "Basic tracking (notes or mental)",
                                },
                                {"value": "app_budget", "label": "App-based budget"},
                                {
                                    "value": "detailed_budget",
                                    "label": "Detailed spreadsheet budget",
                                },
                                {"value": "envelope", "label": "Envelope / cash system"},
                            ],
                            "required": True,
                        },
                        {
                            "id": "debt_status",
                            "type": "multiple_choice",
                            "text": "How would you describe your debt situation?",
                            "options": [
                                {"value": "none", "label": "No debt"},
                                {"value": "credit_cards", "label": "Mostly credit cards"},
                                {"value": "student_loans", "label": "Student loans"},
                                {"value": "mortgage", "label": "Mortgage"},
                                {"value": "mixed", "label": "A mix of several types"},
                            ],
                            "required": True,
                        },
                    ],
                },
                {
                    "id": "investing",
                    "title": "Investing & Risk",
                    "questions": [
                        {
                            "id": "investing_experience",
                            "type": "multiple_choice",
                            "text": "How comfortable are you with investing?",
                            "options": [
                                {"value": "new", "label": "Completely new"},
                                {"value": "beginner", "label": "Know the basics"},
                                {"value": "intermediate", "label": "Have invested before"},
                                {"value": "advanced", "label": "Very confident"},
                            ],
                            "required": True,
                        },
                        {
                            "id": "risk_comfort",
                            "type": "multiple_choice",
                            "text": "What level of risk feels right?",
                            "options": [
                                {"value": "low", "label": "Low risk, steady growth"},
                                {"value": "balanced", "label": "Balanced risk and growth"},
                                {"value": "growth", "label": "Higher growth, some volatility"},
                                {"value": "aggressive", "label": "Aggressive growth"},
                            ],
                            "required": True,
                        },
                        {
                            "id": "interest_areas",
                            "type": "multiple_select",
                            "text": "What topics are you most curious about?",
                            "options": [
                                {"value": "index_funds", "label": "Index funds & ETFs"},
                                {"value": "stocks", "label": "Stocks"},
                                {
                                    "value": "retirement_accounts",
                                    "label": "Retirement accounts (401k/IRA)",
                                },
                                {"value": "real_estate", "label": "Real estate"},
                                {"value": "crypto", "label": "Crypto"},
                                {"value": "taxes", "label": "Taxes & optimization"},
                            ],
                            "required": True,
                        },
                    ],
                },
                {
                    "id": "learning",
                    "title": "Learning Preferences",
                    "questions": [
                        {
                            "id": "learning_style",
                            "type": "multiple_choice",
                            "text": "How do you prefer to learn?",
                            "options": [
                                {"value": "quick_lessons", "label": "Quick lessons"},
                                {"value": "deep_dives", "label": "Deep dives"},
                                {"value": "visual", "label": "Visual explainers"},
                                {"value": "interactive", "label": "Interactive exercises"},
                                {"value": "coaching", "label": "Guided coaching"},
                            ],
                            "required": True,
                        },
                        {
                            "id": "time_commitment",
                            "type": "multiple_choice",
                            "text": "How much time can you commit each week?",
                            "options": [
                                {"value": "10_min", "label": "10 minutes"},
                                {"value": "20_min", "label": "20 minutes"},
                                {"value": "30_min", "label": "30 minutes"},
                                {"value": "1_hour", "label": "1 hour"},
                                {"value": "2_plus", "label": "2+ hours"},
                            ],
                            "required": True,
                        },
                        {
                            "id": "accountability",
                            "type": "multiple_choice",
                            "text": "What keeps you motivated?",
                            "options": [
                                {"value": "reminders", "label": "Gentle reminders"},
                                {"value": "goals", "label": "Clear milestones"},
                                {"value": "streaks", "label": "Streaks & gamification"},
                                {"value": "community", "label": "Community support"},
                                {"value": "self_driven", "label": "I'm self-driven"},
                            ],
                            "required": True,
                        },
                    ],
                },
                {
                    "id": "personalization",
                    "title": "Personalization",
                    "questions": [
                        {
                            "id": "confidence_level",
                            "type": "multiple_choice",
                            "text": "How confident do you feel about your financial plan?",
                            "options": [
                                {"value": "1", "label": "Not confident"},
                                {"value": "2", "label": "A little"},
                                {"value": "3", "label": "Somewhat"},
                                {"value": "4", "label": "Confident"},
                                {"value": "5", "label": "Very confident"},
                            ],
                            "required": True,
                        },
                        {
                            "id": "support_focus",
                            "type": "multiple_select",
                            "text": "Where should we focus first?",
                            "options": [
                                {"value": "budgeting_tools", "label": "Budgeting tools"},
                                {"value": "debt_plan", "label": "Debt payoff plan"},
                                {"value": "savings_plan", "label": "Savings plan"},
                                {"value": "investment_plan", "label": "Investment plan"},
                                {"value": "credit_score", "label": "Credit score"},
                                {"value": "income_growth", "label": "Income growth"},
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

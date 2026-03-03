"""
Update Quick Check sections that use the generic question with lesson-specific wording.
Preserves section IDs and order; only updates exercise_data (question + options).
"""

from django.core.management.base import BaseCommand

from education.models import LessonSection, LessonSectionTranslation

# Section ID -> { question, options, correctAnswer (index) }
UPDATES = {
    1173: {
        "question": "Which of these best describes a budget?",
        "options": [
            "A plan for how you'll spend and save your money",
            "A list of things you bought last month",
            "The amount left in your bank account",
            "A type of savings account",
        ],
        "correctAnswer": 0,
    },
    1193: {
        "question": "Why is tracking income and expenses useful for your finances?",
        "options": [
            "It shows where your money goes so you can adjust spending",
            "It increases your income automatically",
            "It replaces the need for a budget",
            "Banks require it for all accounts",
        ],
        "correctAnswer": 0,
    },
    1198: {
        "question": "What is credit in simple terms?",
        "options": [
            "Borrowing money or buying something now and paying for it later",
            "The cash you keep in your wallet",
            "A gift from the bank",
            "Another word for your salary",
        ],
        "correctAnswer": 0,
    },
    1218: {
        "question": "When managing debt, what is a good first step to take?",
        "options": [
            "List all debts and prioritise by rate or balance",
            "Ignore small debts and focus only on the largest",
            "Borrow more to pay off existing debt",
            "Close all accounts and start over",
        ],
        "correctAnswer": 0,
    },
    1223: {
        "question": "What does investing aim to do with your money?",
        "options": [
            "Grow your money over time through assets like shares or funds",
            "Keep your money in a single safe place",
            "Spend money on things that hold value",
            "Replace your main income immediately",
        ],
        "correctAnswer": 0,
    },
    1243: {
        "question": "What should a solid investment plan include?",
        "options": [
            "Your goals, time horizon, and how much risk you can accept",
            "Only the names of funds you like",
            "A list of past returns from other people",
            "Guarantees of future performance",
        ],
        "correctAnswer": 0,
    },
    1258: {
        "question": "What is a key benefit of rental property investing?",
        "options": [
            "Potential rental income and long-term value growth",
            "No need to maintain the property",
            "Tenants pay all taxes and insurance",
            "Guaranteed returns with no risk",
        ],
        "correctAnswer": 0,
    },
    1273: {
        "question": "Why is risk management important in real estate investing?",
        "options": [
            "To limit losses and protect your capital when markets or tenants change",
            "To avoid paying any insurance",
            "To ensure you never sell at a loss",
            "Banks do not require it",
        ],
        "correctAnswer": 0,
    },
    1288: {
        "question": "What is a real estate syndication?",
        "options": [
            "A group of investors pooling money to buy and run a property together",
            "A single investor owning many properties alone",
            "A type of mortgage with no interest",
            "A government scheme that buys your property",
        ],
        "correctAnswer": 0,
    },
    1383: {
        "question": "When your income is irregular, what helps most with budgeting?",
        "options": [
            "Building a buffer and planning spending around your lowest expected income",
            "Spending everything in high-earning months",
            "Ignoring the pattern and budgeting like a fixed salary",
            "Borrowing the same amount every month",
        ],
        "correctAnswer": 0,
    },
    1398: {
        "question": "How do needs differ from wants in spending?",
        "options": [
            "Needs are essential to live and work; wants are things we'd like but can skip",
            "Needs are cheap and wants are expensive",
            "They are the same; it depends on the person",
            "Wants are more important than needs",
        ],
        "correctAnswer": 0,
    },
    1413: {
        "question": "What is a high-yield savings account?",
        "options": [
            "A savings account that pays a higher interest rate than typical accounts",
            "An account that only rich people can use",
            "A type of current account with no fees",
            "An account that guarantees to double your money",
        ],
        "correctAnswer": 0,
    },
}


class Command(BaseCommand):
    help = "Replace generic Quick Check questions with lesson-specific wording."

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Show what would be updated without saving.",
        )

    def handle(self, *args, **options):
        dry_run = options["dry_run"]
        if dry_run:
            self.stdout.write("DRY RUN – no changes will be saved.")

        updated = 0
        for section_id, payload in UPDATES.items():
            section = LessonSection.objects.filter(id=section_id).first()
            if not section:
                self.stdout.write(self.style.WARNING(f"Section {section_id} not found, skipping."))
                continue
            if section.content_type != "exercise" or not section.exercise_data:
                self.stdout.write(
                    self.style.WARNING(
                        f"Section {section_id} is not an exercise or has no data, skipping."
                    )
                )
                continue

            new_data = {**(section.exercise_data or {}), **payload}
            if dry_run:
                self.stdout.write(
                    f"Would update section {section_id} ({section.lesson.title}): {payload['question'][:50]}..."
                )
            else:
                section.exercise_data = new_data
                section.save(update_fields=["exercise_data"])
                for trans in LessonSectionTranslation.objects.filter(section_id=section_id):
                    if (
                        trans.exercise_data
                        and trans.exercise_data.get("question")
                        == "What's one way to use what you learned in this lesson?"
                    ):
                        trans.exercise_data = {**(trans.exercise_data or {}), **payload}
                        trans.save(update_fields=["exercise_data"])
            updated += 1

        self.stdout.write(
            self.style.SUCCESS(
                f"Updated {updated} section(s)."
                if not dry_run
                else f"Would update {updated} section(s)."
            )
        )

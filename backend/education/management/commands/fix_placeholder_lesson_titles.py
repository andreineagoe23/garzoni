"""
Fix lessons that were created with generic placeholder titles.

Renames: "Lesson 1: Introduction", "Lesson 2: Core Concepts", "Lesson 3: Key Strategies",
"Lesson 4: Practical Application", "Lesson 5: Next Steps" to course-specific titles.
"""

from django.core.management.base import BaseCommand
from django.db import transaction

from education.models import Lesson

GENERIC_TITLES = [
    "Lesson 1: Introduction",
    "Lesson 2: Core Concepts",
    "Lesson 3: Key Strategies",
    "Lesson 4: Practical Application",
    "Lesson 5: Next Steps",
]

# course title -> [lesson 1 title, ..., lesson 5 title] (no "Lesson N: " prefix)
COURSE_LESSON_TITLES = {
    "Understanding Income & Expenses": [
        "What Are Income and Expenses?",
        "Tracking Your Money Flow",
        "Fixed vs. Variable Expenses",
        "Needs vs. Wants",
        "Your First Income & Expense Review",
    ],
    "Emergency Funds & Financial Safety Nets": [
        "Why You Need an Emergency Fund",
        "How Much to Save",
        "Where to Keep Your Emergency Fund",
        "Building Your Emergency Fund",
        "When and How to Use It",
    ],
    "Financial Goal Setting & Clarity": [
        "Defining Your Financial Goals",
        "Short-Term vs. Long-Term Goals",
        "Prioritizing Your Goals",
        "Creating an Action Plan",
        "Reviewing and Adjusting Your Goals",
    ],
    "Debt Management & Optimization": [
        "Understanding Your Debt",
        "The Debt Avalanche vs. Snowball",
        "Prioritizing and Paying Down Debt",
        "Avoiding New Debt",
        "Becoming Debt-Free",
    ],
    "Property Financing & Mortgages": [
        "Mortgage Basics",
        "Types of Mortgages",
        "Getting Pre-Approved",
        "Understanding Mortgage Terms",
        "Refinancing and Optimization",
    ],
    "Rental Income & Cash Flow Analysis": [
        "What Is Cash Flow?",
        "Calculating Rental Income",
        "Managing Rental Expenses",
        "Cash Flow Analysis",
        "Maximizing Rental Returns",
    ],
    "DeFi & Yield Strategies": [
        "Introduction to DeFi",
        "Yield Farming Basics",
        "Liquidity Pools",
        "DeFi Risks and Rewards",
        "Building a DeFi Strategy",
    ],
    "Crypto Risk Management & Security": [
        "Securing Your Crypto Assets",
        "Wallets and Cold Storage",
        "Avoiding Scams and Phishing",
        "Managing Crypto Risk",
        "Your Security Checklist",
    ],
    "Technical Analysis for Forex": [
        "Technical Analysis Basics",
        "Chart Patterns and Indicators",
        "Support and Resistance",
        "Backtesting Your Strategy",
        "Creating a Trading Routine",
    ],
    "Trading Psychology & Capital Protection": [
        "The Psychology of Trading",
        "Managing Emotions and Bias",
        "Protecting Your Capital",
        "Building a Trading Mindset",
        "Long-Term Trading Success",
    ],
}


class Command(BaseCommand):
    help = "Rename lessons with generic placeholder titles to course-specific titles."

    def add_arguments(self, parser):
        parser.add_argument("--dry-run", action="store_true")

    def handle(self, *args, **options):
        dry_run = options["dry_run"]
        updated = 0

        with transaction.atomic():
            for lesson in Lesson.objects.select_related("course").filter(title__in=GENERIC_TITLES):
                course_title = lesson.course.title
                titles = COURSE_LESSON_TITLES.get(course_title)
                if not titles:
                    self.stderr.write(
                        self.style.WARNING(
                            f"No mapping for course {course_title!r}, skipping lesson {lesson.id}"
                        )
                    )
                    continue
                idx = GENERIC_TITLES.index(lesson.title)
                new_title = titles[idx]
                old_title = lesson.title
                if lesson.title != new_title:
                    if not dry_run:
                        lesson.title = new_title
                        lesson.save(update_fields=["title"])
                    self.stdout.write(f"  {course_title} / {old_title!r} -> {new_title!r}")
                    updated += 1
            if dry_run:
                transaction.set_rollback(True)

        self.stdout.write(
            self.style.SUCCESS(
                f"{'Would update' if dry_run else 'Updated'} {updated} lesson title(s)."
            )
        )

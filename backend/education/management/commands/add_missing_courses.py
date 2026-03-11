"""
Add missing courses (and placeholder lessons) to existing paths.

New courses per path (by sort_order):
  Path 1 (Basic Finance): Understanding Income & Expenses, Emergency Funds & Financial Safety Nets
  Path 2 (Financial Mindset): Financial Goal Setting & Clarity
  Path 3 (Personal Finance): Debt Management & Optimization
  Path 4 (Real Estate): Property Financing & Mortgages, Rental Income & Cash Flow Analysis
  Path 5 (Crypto): DeFi & Yield Strategies, Crypto Risk Management & Security
  Path 6 (Forex): Technical Analysis for Forex, Trading Psychology & Capital Protection

Each new course gets 5 placeholder lessons with 9 sections each (Overview, Core Concept, Knowledge Check 1, etc.).
"""

from django.core.management.base import BaseCommand
from django.db import transaction, models

from education.models import Path, Course, Lesson, LessonSection
from education.lesson_section_structure import SECTION_TEMPLATE_9

# path sort_order (1-6) -> list of new course titles to add (in order)
NEW_COURSES_BY_PATH_ORDER = {
    1: [
        "Understanding Income & Expenses",
        "Emergency Funds & Financial Safety Nets",
    ],
    2: [
        "Financial Goal Setting & Clarity",
    ],
    3: [
        "Debt Management & Optimization",
    ],
    4: [
        "Property Financing & Mortgages",
        "Rental Income & Cash Flow Analysis",
    ],
    5: [
        "DeFi & Yield Strategies",
        "Crypto Risk Management & Security",
    ],
    6: [
        "Technical Analysis for Forex",
        "Trading Psychology & Capital Protection",
    ],
}

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

# Fallback for any course not in the mapping (no prefix)
PLACEHOLDER_LESSON_TITLES = [
    "Introduction",
    "Core Concepts",
    "Key Strategies",
    "Practical Application",
    "Next Steps",
]


class Command(BaseCommand):
    help = "Add missing courses and 5 placeholder lessons each. Idempotent: skips existing course titles."

    def add_arguments(self, parser):
        parser.add_argument("--dry-run", action="store_true")

    def handle(self, *args, **options):
        dry_run = options["dry_run"]
        created_courses = 0
        created_lessons = 0

        paths = list(Path.objects.all().order_by("sort_order", "id")[:6])
        path_by_order = {i + 1: p for i, p in enumerate(paths)}

        with transaction.atomic():
            for path_order, new_titles in NEW_COURSES_BY_PATH_ORDER.items():
                path = path_by_order.get(path_order)
                if not path:
                    self.stderr.write(
                        self.style.WARNING(
                            f"Path with sort_order {path_order} not found, skipping."
                        )
                    )
                    continue
                existing_titles = set(path.courses.values_list("title", flat=True))
                max_order = path.courses.aggregate(max_order=models.Max("order"))["max_order"] or 0
                next_order = max_order + 1
                for title in new_titles:
                    if title in existing_titles:
                        self.stdout.write(
                            self.style.NOTICE(f"Course already exists: {path.title} / {title}")
                        )
                        continue
                    if dry_run:
                        self.stdout.write(
                            f"Would create course: {path.title} / {title} (order={next_order})"
                        )
                        created_courses += 1
                        next_order += 1
                        continue
                    course = Course.objects.create(
                        path=path,
                        title=title,
                        description="Content to be added.",
                        order=next_order,
                        is_active=True,
                    )
                    created_courses += 1
                    next_order += 1
                    existing_titles.add(title)
                    lesson_titles = COURSE_LESSON_TITLES.get(title, PLACEHOLDER_LESSON_TITLES)
                    for idx, lesson_title in enumerate(lesson_titles, start=1):
                        lesson = Lesson.objects.create(
                            course=course,
                            title=lesson_title,
                            short_description="",
                            detailed_content="<p>Content to be added.</p>",
                        )
                        created_lessons += 1
                        self._create_nine_sections(lesson)
                    self.stdout.write(self.style.SUCCESS(f"Created course: {title} with 5 lessons"))

            if dry_run:
                transaction.set_rollback(True)

        self.stdout.write(
            self.style.SUCCESS(
                f"{'Would create' if dry_run else 'Created'}: {created_courses} course(s), {created_lessons} lesson(s)."
            )
        )

    def _create_nine_sections(self, lesson):
        for order, title, content_type, _ in SECTION_TEMPLATE_9:
            LessonSection.objects.create(
                lesson=lesson,
                order=order,
                title=title,
                content_type=content_type,
                text_content="<p>Content to be added.</p>" if content_type == "text" else "",
                video_url=(
                    "https://www.youtube.com/embed/J7dJ_tN1q1E" if content_type == "video" else None
                ),
                exercise_type="multiple-choice" if content_type == "exercise" else None,
                exercise_data=(
                    {
                        "question": f"Review: {lesson.title}",
                        "options": [
                            "Placeholder – run import_lesson_exercises to populate.",
                            "Option B",
                            "Option C",
                            "Option D",
                        ],
                        "correctAnswer": 0,
                    }
                    if content_type == "exercise"
                    else None
                ),
                is_published=True,
            )

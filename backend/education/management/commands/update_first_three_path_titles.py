"""
Update titles for the first 6 paths, their courses, and lessons to match the new naming.

Path 1 (Basic Finance): lesson titles updated.
Path 2: title -> "Financial Mindset (Starter)"; lesson titles updated.
Path 3: title -> "Personal Finance (Plus)"; lesson titles updated.
Path 4: title -> "Real Estate (Plus)"; lesson titles updated.
Path 5: title -> "Crypto (Pro)"; lesson titles updated.
Path 6: title -> "Forex (Pro)"; lesson titles updated.

Also updates PathTranslation and LessonTranslation.
"""

from django.core.management.base import BaseCommand
from django.db import transaction

from education.models import (
    Path,
    Course,
    Lesson,
    PathTranslation,
    CourseTranslation,
    LessonTranslation,
)

# Path 2–6 display names (no subscription tier in title: no " (Starter)", " (Plus)", " (Pro)")
PATH_TITLES = {
    2: "Financial Mindset",
    3: "Personal Finance",
    4: "Real Estate",
    5: "Crypto",
    6: "Forex",
}

# Map: course title (exact match) -> list of 5 lesson titles in order.
# Path 1: Introduction to Budgeting, Understanding Credit, Basic Investment Strategies
PATH_1_COURSE_LESSONS = {
    "Introduction to Budgeting": [
        "What Is a Budget?",
        "Why Budgeting Matters",
        "Setting Clear Financial Goals",
        "How to Create a Simple Budget",
        "Tracking Income and Expenses",
    ],
    "Understanding Credit": [
        "What Is Credit?",
        "Types of Credit Explained",
        "How Credit Scores Work",
        "How to Build Credit Responsibly",
        "Managing Debt Effectively",
    ],
    "Basic Investment Strategies": [
        "Introduction to Investing",
        "Types of Investment Assets",
        "Understanding Risk and Return",
        "Diversification Explained",
        "Creating a Simple Investment Plan",
    ],
}

# Path 2: Financial Growth Mindset, Resilience in Financial Setbacks, Cultivating Financial Discipline, Building a Positive Money Mindset
PATH_2_COURSE_LESSONS = {
    "Financial Growth Mindset": [
        "Lifelong Learning and Financial Growth",
        "Networking and Financial Opportunity",
        "Setting a Long-Term Financial Vision",
        "Learning From Financial Mistakes",
        "Building Long-Term Direction",
    ],
    "Resilience in Financial Setbacks": [
        "Rethinking Financial Failure",
        "Preparing for Financial Emergencies",
        "Managing Financial Stress Effectively",
        "Building a Financial Safety Net",
        "Recovering After a Financial Crisis",
    ],
    "Cultivating Financial Discipline": [
        "Delayed Gratification in Personal Finance",
        "Setting Financial Boundaries",
        "Building Consistent Money Habits",
        "Automating Positive Financial Behaviors",
        "Strengthening Self-Control With Money",
    ],
    "Building a Positive Money Mindset": [
        "Understanding Your Money Story",
        "Identifying and Overcoming Money Blocks",
        "Gratitude and Financial Perspective",
        "Scarcity vs. Abundance Thinking",
        "Beliefs That Shape Financial Behavior",
    ],
}

# Path 3: Building Wealth, Maximizing Savings, Smart Spending, Budgeting Beyond Basics
PATH_3_COURSE_LESSONS = {
    "Building Wealth": [
        "Understanding Passive Income",
        "Strategies for Protecting Wealth",
        "How Inflation Affects Purchasing Power",
        "How Compound Interest Works",
        "Assets and Liabilities Explained",
    ],
    "Maximizing Savings": [
        "Understanding High-Yield Savings Accounts",
        "Setting Structured Savings Goals",
        "Identifying Hidden Savings Opportunities",
        "Using Sinking Funds Effectively",
        "Running a Structured No-Spend Period",
    ],
    "Smart Spending": [
        "Distinguishing Needs From Wants",
        "Practicing Intentional Spending",
        "Negotiating Everyday Expenses",
        "Avoiding Lifestyle Inflation",
        "Aligning Spending With Personal Values",
    ],
    "Budgeting Beyond Basics": [
        "Budgeting With Irregular Income",
        "Adjusting a Budget Over Time",
        "Using Technology for Budget Tracking",
        "Managing Finances as a Couple",
        "Conducting an Annual Financial Review",
    ],
}

# Path 4: Real Estate (Plus)
PATH_4_COURSE_LESSONS = {
    "Real Estate Basics": [
        "Real Estate Investing Fundamentals",
        "The Property Buying Process",
        "Evaluating Rental Property Investments",
        "Financing a Property Investment",
        "Managing Rental Property Effectively",
    ],
    "Market Research and Analysis": [
        "Analyzing Property Values",
        "Understanding Real Estate Cycles",
        "Risk Management in Real Estate",
        "Conducting Due Diligence",
        "Evaluating Market Trends",
    ],
    "Advanced Real Estate Strategies": [
        "The Fix and Flip Strategy",
        "Investing in Commercial Real Estate",
        "Understanding Real Estate Syndications",
        "The BRRRR Method Explained",
        "Scaling From Residential to Commercial",
    ],
}

# Path 5: Crypto (Pro) – DB course title is "Buying, Selling and Storing Crypto"
PATH_5_COURSE_LESSONS = {
    "Introduction to Cryptocurrency": [
        "What Is Cryptocurrency?",
        "How Blockchain Technology Works",
        "Types of Cryptocurrencies Explained",
        "Wallets and Security Fundamentals",
        "Recognizing Risks and Scams",
    ],
    "Buying, Selling and Storing Crypto": [
        "How to Buy Cryptocurrency",
        "Storing Cryptocurrency Securely",
        "Selling and Trading Crypto",
        "Using Decentralized Exchanges",
        "Understanding Crypto Taxes",
    ],
    "Advanced Cryptocurrency Concepts": [
        "Understanding Decentralized Finance (DeFi)",
        "Non-Fungible Tokens Explained",
        "Emerging Trends in Cryptocurrency",
        "How Smart Contracts Work",
        "Staking and Yield Farming Compared",
    ],
}

# Path 6: Forex (Pro)
PATH_6_COURSE_LESSONS = {
    "Introduction to Forex Trading": [
        "What Is the Forex Market?",
        "Understanding Currency Pairs",
        "Essential Forex Terminology",
        "How to Read Price Charts",
        "The Psychology of Trading",
    ],
    "Fundamentals of Forex Trading Strategies": [
        "Technical Analysis Basics",
        "Fundamental Analysis in Forex",
        "Common Forex Trading Strategies",
        "Backtesting a Trading Strategy",
        "Building a Structured Trading Routine",
    ],
    "Risk Management in Forex": [
        "Managing Leverage and Position Size",
        "Using Stop Loss and Take Profit Orders",
        "Developing a Structured Trading Plan",
        "Using a Trading Journal Effectively",
        "Understanding and Managing Drawdowns",
    ],
}

COURSE_LESSON_TITLES_BY_PATH_ORDER = [
    PATH_1_COURSE_LESSONS,
    PATH_2_COURSE_LESSONS,
    PATH_3_COURSE_LESSONS,
    PATH_4_COURSE_LESSONS,
    PATH_5_COURSE_LESSONS,
    PATH_6_COURSE_LESSONS,
]


class Command(BaseCommand):
    help = "Update titles for the first 6 paths, their courses, and lessons to the new naming."

    def add_arguments(self, parser):
        parser.add_argument("--dry-run", action="store_true", help="Print changes without saving.")

    def handle(self, *args, **options):
        dry_run = options["dry_run"]
        if dry_run:
            self.stdout.write("DRY RUN – no changes will be saved.")

        paths = list(Path.objects.all().order_by("sort_order", "id")[:6])
        if len(paths) < 6:
            self.stderr.write(self.style.ERROR("Expected at least 6 paths."))
            return

        updated_paths = 0
        updated_lessons = 0

        with transaction.atomic():
            for path_index, path in enumerate(paths):
                path_sort = path_index + 1  # 1-based
                course_to_lessons = COURSE_LESSON_TITLES_BY_PATH_ORDER[path_index]

                # Update path title for paths 2–6
                if path_sort in PATH_TITLES:
                    new_path_title = PATH_TITLES[path_sort]
                    if path.title != new_path_title:
                        if not dry_run:
                            path.title = new_path_title
                            path.save(update_fields=["title"])
                            PathTranslation.objects.filter(path=path).update(title=new_path_title)
                        self.stdout.write(f"Path {path_sort}: {path.title!r} -> {new_path_title!r}")
                        updated_paths += 1

                for course in path.courses.order_by("order", "id"):
                    titles = course_to_lessons.get(course.title)
                    if not titles:
                        self.stderr.write(
                            self.style.WARNING(
                                f"Path {path_sort}: course {course.title!r} not in mapping; skipping."
                            )
                        )
                        continue
                    lessons = list(course.lessons.order_by("id"))
                    if len(lessons) != len(titles):
                        self.stderr.write(
                            self.style.WARNING(
                                f"Course {course.title!r} has {len(lessons)} lessons, expected {len(titles)}; skipping."
                            )
                        )
                        continue
                    for lesson, new_title in zip(lessons, titles):
                        if lesson.title != new_title:
                            if not dry_run:
                                lesson.title = new_title
                                lesson.save(update_fields=["title"])
                                LessonTranslation.objects.filter(lesson=lesson).update(
                                    title=new_title
                                )
                            self.stdout.write(f"  Lesson: {lesson.title!r} -> {new_title!r}")
                            updated_lessons += 1

            if dry_run:
                transaction.set_rollback(True)

        self.stdout.write(
            self.style.SUCCESS(
                f"{'Would update' if dry_run else 'Updated'}: {updated_paths} path(s), {updated_lessons} lesson(s)."
            )
        )

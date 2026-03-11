"""
Set Course.order for all paths so dashboard and API show courses in the intended order.
"""

from django.core.management.base import BaseCommand
from django.db import transaction

from education.models import Path, Course

# path title -> list of course titles in display order
# Order: income → budget → safety → credit → investing / spending → save → debt → structure → wealth
COURSE_ORDER_BY_PATH_TITLE = {
    "Basic Finance": [
        "Understanding Income & Expenses",
        "Introduction to Budgeting",
        "Emergency Funds & Financial Safety Nets",
        "Understanding Credit",
        "Basic Investment Strategies",
    ],
    "Financial Mindset": [
        "Financial Growth Mindset",
        "Resilience in Financial Setbacks",
        "Cultivating Financial Discipline",
        "Building a Positive Money Mindset",
        "Financial Goal Setting & Clarity",
    ],
    "Personal Finance": [
        "Smart Spending",
        "Maximizing Savings",
        "Debt Management & Optimization",
        "Budgeting Beyond Basics",
        "Building Wealth",
    ],
    "Real Estate": [
        "Real Estate Basics",
        "Market Research and Analysis",
        "Property Financing & Mortgages",
        "Rental Income & Cash Flow Analysis",
        "Advanced Real Estate Strategies",
    ],
    "Crypto": [
        "Introduction to Cryptocurrency",
        "Buying, Selling and Storing Crypto",
        "Crypto Risk Management & Security",
        "Advanced Cryptocurrency Concepts",
        "DeFi & Yield Strategies",
    ],
    "Forex": [
        "Introduction to Forex Trading",
        "Fundamentals of Forex Trading Strategies",
        "Risk Management in Forex",
        "Technical Analysis for Forex",
        "Trading Psychology & Capital Protection",
    ],
}


class Command(BaseCommand):
    help = "Set course order for all paths to match the intended display order."

    def add_arguments(self, parser):
        parser.add_argument("--dry-run", action="store_true")

    def handle(self, *args, **options):
        dry_run = options["dry_run"]
        paths_by_title = {p.title: p for p in Path.objects.all()}
        updated = 0

        with transaction.atomic():
            for path_title, titles in COURSE_ORDER_BY_PATH_TITLE.items():
                path = paths_by_title.get(path_title)
                if not path:
                    self.stderr.write(
                        self.style.WARNING(f"Path {path_title!r} not found, skipping.")
                    )
                    continue
                courses_by_title = {c.title: c for c in path.courses.all()}
                for order_index, title in enumerate(titles):
                    course = courses_by_title.get(title)
                    if not course:
                        self.stderr.write(
                            self.style.WARNING(
                                f"Path {path.title!r}: course {title!r} not found, skipping."
                            )
                        )
                        continue
                    if course.order != order_index:
                        if not dry_run:
                            course.order = order_index
                            course.save(update_fields=["order"])
                        self.stdout.write(f"  {path.title} / {title}: order -> {order_index}")
                        updated += 1
            if dry_run:
                transaction.set_rollback(True)

        self.stdout.write(
            self.style.SUCCESS(
                f"{'Would update' if dry_run else 'Updated'} {updated} course order(s)."
            )
        )

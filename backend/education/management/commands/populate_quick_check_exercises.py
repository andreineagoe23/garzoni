"""
Management command to populate exercise data for "Quick Check" lesson sections.
Run with: python manage.py populate_quick_check_exercises [--dry-run] [--exercise-type TYPE]
"""

from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils.html import strip_tags

from education.models import LessonSection


class Command(BaseCommand):
    help = (
        "Populate exercise_data for lesson sections with content_type='exercise' and title='Quick Check'. "
        "Generates multiple-choice questions based on lesson content."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Show what would be updated without making changes.",
        )
        parser.add_argument(
            "--exercise-type",
            type=str,
            choices=["multiple-choice", "drag-and-drop", "numeric", "budget-allocation"],
            default="multiple-choice",
            help="Type of exercise to generate (default: multiple-choice)",
        )
        parser.add_argument(
            "--title-filter",
            type=str,
            default="Quick Check",
            help="Filter sections by title (default: 'Quick Check')",
        )

    def handle(self, *args, **options):
        dry_run = options["dry_run"]
        exercise_type = options["exercise_type"]
        title_filter = options["title_filter"]

        # Find all exercise sections with the specified title that need exercise data
        sections = LessonSection.objects.filter(
            content_type="exercise",
            title=title_filter,
        ).select_related("lesson", "lesson__course")

        sections_to_update = [s for s in sections if not s.exercise_data or not s.exercise_type]

        if not sections_to_update:
            self.stdout.write(
                self.style.SUCCESS(
                    f"No sections found with title '{title_filter}' that need exercise data."
                )
            )
            return

        self.stdout.write(f"Found {len(sections_to_update)} section(s) to update.\n")

        updated_count = 0
        skipped_count = 0

        for section in sections_to_update:
            lesson = section.lesson
            course_title = lesson.course.title if lesson.course else "this course"

            # Generate exercise data based on lesson title and content
            exercise_data = self._generate_exercise_data(
                lesson, section, exercise_type, course_title
            )

            if not exercise_data:
                self.stdout.write(
                    self.style.WARNING(
                        f"Skipping {section.id}: Could not generate exercise data for '{lesson.title}'"
                    )
                )
                skipped_count += 1
                continue

            message = (
                f"Section {section.id} ({lesson.title}): "
                f"Would set exercise_type='{exercise_type}' and populate exercise_data"
            )

            if dry_run:
                self.stdout.write(self.style.WARNING(message))
                self.stdout.write(f"  Question: {exercise_data.get('question', 'N/A')[:80]}...")
                continue

            try:
                with transaction.atomic():
                    section.exercise_type = exercise_type
                    section.exercise_data = exercise_data
                    section.save(update_fields=["exercise_type", "exercise_data"])
                    updated_count += 1
                    self.stdout.write(
                        self.style.SUCCESS(f"Updated section {section.id} for '{lesson.title}'")
                    )
            except Exception as e:
                self.stdout.write(
                    self.style.ERROR(f"Error updating section {section.id}: {str(e)}")
                )
                skipped_count += 1

        if dry_run:
            self.stdout.write(
                self.style.NOTICE(
                    f"\nDry run complete. Would update {len(sections_to_update)} section(s)."
                )
            )
        else:
            self.stdout.write(
                self.style.SUCCESS(
                    f"\nSummary: Updated {updated_count} section(s), skipped {skipped_count}."
                )
            )

    def _generate_exercise_data(self, lesson, section, exercise_type, course_title):
        """Generate exercise data based on lesson content and exercise type."""
        lesson_title = lesson.title
        lesson_summary = self._get_lesson_summary(lesson)

        if exercise_type == "multiple-choice":
            return self._generate_multiple_choice(lesson_title, lesson_summary, course_title)
        elif exercise_type == "drag-and-drop":
            return self._generate_drag_and_drop(lesson_title, lesson_summary, course_title)
        elif exercise_type == "numeric":
            return self._generate_numeric(lesson_title, lesson_summary, course_title)
        elif exercise_type == "budget-allocation":
            return self._generate_budget_allocation(lesson_title, lesson_summary, course_title)
        return None

    def _generate_multiple_choice(self, lesson_title, lesson_summary, course_title):
        """Generate a multiple-choice question based on lesson content."""
        # Extract key topic from lesson title (e.g., "What is a Budget?" -> "budget")
        topic_keywords = self._extract_topic_keywords(lesson_title)

        # Generate question based on lesson title pattern
        if "What is" in lesson_title or "What are" in lesson_title:
            question = f"Based on '{lesson_title}', which statement is most accurate?"
            options = [
                lesson_summary[:150] + ("..." if len(lesson_summary) > 150 else ""),
                "This concept is not important for financial planning",
                "It only applies to advanced investors",
                "It requires no understanding to implement",
            ]
        elif "How to" in lesson_title or "How do" in lesson_title:
            question = f"What is the most important step when applying '{lesson_title}'?"
            options = [
                "Understand the fundamentals before taking action",
                "Skip planning and start immediately",
                "Only follow advice from social media",
                "Ignore your personal financial situation",
            ]
        elif "Understanding" in lesson_title or "Introduction" in lesson_title:
            question = f"Which best describes the main concept covered in '{lesson_title}'?"
            options = [
                lesson_summary[:150] + ("..." if len(lesson_summary) > 150 else ""),
                "An unrelated financial topic",
                "Something only experts need to know",
                "A concept that doesn't apply to real life",
            ]
        else:
            # Generic question
            question = f"What is the key takeaway from '{lesson_title}'?"
            options = [
                lesson_summary[:150] + ("..." if len(lesson_summary) > 150 else ""),
                "This lesson has no practical application",
                "It's only relevant for specific situations",
                "The concepts are too complex to understand",
            ]

        return {
            "question": question,
            "options": options,
            "correctAnswer": 0,
            "explanation": f"This answer aligns with the core concepts presented in '{lesson_title}'.",
        }

    def _generate_drag_and_drop(self, lesson_title, lesson_summary, course_title):
        """Generate a drag-and-drop exercise based on lesson content."""
        # Create a simple ordering exercise
        if "Budget" in lesson_title:
            items = [
                "Track your income and expenses",
                "Categorize your spending",
                "Set spending limits",
                "Review and adjust regularly",
            ]
            question = f"Arrange these steps in the correct order for '{lesson_title}':"
        elif "Credit" in lesson_title:
            items = [
                "Understand what credit is",
                "Learn about credit scores",
                "Build your credit history",
                "Manage debt effectively",
            ]
            question = f"Order these concepts from '{lesson_title}' from basic to advanced:"
        elif "Investment" in lesson_title or "Investing" in lesson_title:
            items = [
                "Understand risk and reward",
                "Learn about different investment types",
                "Diversify your portfolio",
                "Create an investment plan",
            ]
            question = f"Arrange these steps for '{lesson_title}' in logical order:"
        else:
            items = [
                "Learn the fundamentals",
                "Understand key concepts",
                "Apply the knowledge",
                "Review and practice",
            ]
            question = f"Order these learning steps for '{lesson_title}':"

        return {
            "question": question,
            "items": items,
            "hints": [
                "Start with the foundational concepts",
                "Build understanding before application",
                "Practice reinforces learning",
            ],
        }

    def _generate_numeric(self, lesson_title, lesson_summary, course_title):
        """Generate a numeric exercise based on lesson content."""
        # Simple calculation exercises
        if "Budget" in lesson_title:
            question = (
                "You have a monthly income of $5,000. Following the 50/30/20 rule, "
                "how much should you allocate to savings? (Enter the dollar amount)"
            )
            expected_value = 1000
            hints = [
                "The 50/30/20 rule allocates 20% to savings",
                "Calculate 20% of $5,000",
                "20% = 0.20 or 1/5",
            ]
        elif "Credit" in lesson_title:
            question = (
                "If you have a credit card with a $10,000 limit and you've used $3,000, "
                "what is your credit utilization percentage? (Enter the percentage)"
            )
            expected_value = 30
            hints = [
                "Credit utilization = (Used / Limit) × 100",
                "Calculate: ($3,000 / $10,000) × 100",
                "Keep utilization below 30% for good credit",
            ]
        else:
            question = (
                "If you invest $1,000 at a 5% annual interest rate, "
                "how much interest will you earn in one year? (Enter the dollar amount)"
            )
            expected_value = 50
            hints = [
                "Simple interest = Principal × Rate",
                "Calculate: $1,000 × 0.05",
                "5% = 0.05 as a decimal",
            ]

        return {
            "question": question,
            "expected_value": expected_value,
            "tolerance": 0.01,
            "unit": "USD" if expected_value >= 1 else "%",
            "placeholder": "Enter your answer",
            "validation": "Check your calculation and try again",
            "hints": hints,
        }

    def _generate_budget_allocation(self, lesson_title, lesson_summary, course_title):
        """Generate a budget allocation exercise."""
        question = (
            "Allocate your monthly income of $4,000 according to the 50/30/20 rule. "
            "Categories: Needs, Wants, Savings"
        )
        return {
            "question": question,
            "income": 4000,
            "categories": ["Needs", "Wants", "Savings"],
            "target": {"category": "Savings", "min": 800},
            "hints": [
                "50% goes to Needs = $2,000",
                "30% goes to Wants = $1,200",
                "20% goes to Savings = $800",
            ],
        }

    def _extract_topic_keywords(self, lesson_title):
        """Extract key topic keywords from lesson title."""
        # Simple keyword extraction
        keywords = []
        common_words = {"what", "is", "are", "the", "a", "an", "to", "of", "and", "or"}
        words = lesson_title.lower().split()
        keywords = [w for w in words if w not in common_words and len(w) > 3]
        return keywords[:3]  # Return top 3 keywords

    def _get_lesson_summary(self, lesson):
        """Extract a summary from lesson content."""
        # Try short_description first
        if lesson.short_description:
            return strip_tags(lesson.short_description).strip()

        # Fall back to detailed_content
        if lesson.detailed_content:
            content = strip_tags(lesson.detailed_content).strip()
            # Return first 200 characters
            return content[:200] + ("..." if len(content) > 200 else "")

        # Fall back to title-based summary
        return f"{lesson.title} covers essential concepts for financial learning."

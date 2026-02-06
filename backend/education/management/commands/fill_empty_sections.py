"""
Find lesson sections with empty content and optionally fill them with placeholder content.
  python manage.py fill_empty_sections           # report only
  python manage.py fill_empty_sections --fill   # fill empty sections
  python manage.py fill_empty_sections --fill --dry-run  # show what would be filled
"""

from django.core.management.base import BaseCommand
from django.utils.html import strip_tags

from education.models import Lesson, LessonSection


def is_text_empty(text_content):
    if text_content is None:
        return True
    plain = strip_tags(str(text_content)).strip()
    return not plain


def is_exercise_data_empty(exercise_data):
    if exercise_data is None:
        return True
    if not isinstance(exercise_data, dict):
        return True
    # Has question and options?
    if not exercise_data.get("question") and not exercise_data.get("options"):
        return True
    return False


def is_video_empty(video_url):
    return not (video_url and str(video_url).strip())


class Command(BaseCommand):
    help = "Find lesson sections with empty content; use --fill to add placeholder content."

    def add_arguments(self, parser):
        parser.add_argument(
            "--fill",
            action="store_true",
            help="Fill empty sections with placeholder content.",
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="With --fill: only show what would be done, do not save.",
        )

    def handle(self, *args, **options):
        fill = options["fill"]
        dry_run = options["dry_run"]

        sections = LessonSection.objects.select_related("lesson", "lesson__course").order_by(
            "lesson__course", "lesson", "order"
        )
        empty = []
        for s in sections:
            is_empty = False
            reason = []
            if s.content_type == "text":
                if is_text_empty(s.text_content):
                    is_empty = True
                    reason.append("text_content empty")
            elif s.content_type == "video":
                if is_video_empty(s.video_url):
                    is_empty = True
                    reason.append("video_url empty")
                if is_text_empty(s.text_content):
                    reason.append("text_content empty (optional)")
            elif s.content_type == "exercise":
                if is_exercise_data_empty(s.exercise_data):
                    is_empty = True
                    reason.append("exercise_data empty or missing question/options")

            if is_empty:
                empty.append((s, reason))

        if not empty:
            self.stdout.write(self.style.SUCCESS("No empty sections found."))
            return

        self.stdout.write(
            self.style.WARNING(f"Found {len(empty)} section(s) with empty content:\n")
        )
        for s, reasons in empty:
            lesson = s.lesson
            course = lesson.course.title if lesson.course else "?"
            self.stdout.write(
                f"  [{course}] {lesson.title} → section #{s.order} '{s.title}' ({s.content_type}): {', '.join(reasons)}"
            )

        if not fill:
            self.stdout.write("")
            self.stdout.write("Run with --fill to fill these with placeholder content.")
            return

        if dry_run:
            self.stdout.write(self.style.NOTICE("\nDry run: would fill the sections above.\n"))
            return

        filled = 0
        for s, reasons in empty:
            if self._fill_section(s):
                filled += 1
                self.stdout.write(self.style.SUCCESS(f"  Filled: {s.lesson.title} → '{s.title}'"))

        self.stdout.write(self.style.SUCCESS(f"\nFilled {filled} section(s)."))

    def _fill_section(self, section):
        lesson = section.lesson
        course_title = lesson.course.title if lesson.course else "this course"
        summary = (lesson.short_description or "").strip() or f"key ideas from {lesson.title}"

        updated = False

        if section.content_type == "text" and is_text_empty(section.text_content):
            section.text_content = (
                f"<p>Quick check: reinforce what you just learned.</p>\n\n"
                f"<p><strong>Recap:</strong> {summary}</p>\n\n"
                f"<p>Consider: how does this apply to your own {course_title} goals? "
                "Jot down one concrete step you could take.</p>"
            )
            updated = True

        elif section.content_type == "video" and is_video_empty(section.video_url):
            section.video_url = "https://www.youtube.com/watch?v=ysz5S6PUM-U"
            if is_text_empty(section.text_content):
                section.text_content = f"<p>Watch the video below to reinforce {lesson.title}.</p>"
            updated = True

        elif section.content_type == "exercise" and is_exercise_data_empty(section.exercise_data):
            section.exercise_type = section.exercise_type or "multiple-choice"
            section.exercise_data = {
                "question": f"What is the main takeaway from '{lesson.title}'?",
                "options": [
                    f"The lesson explains: {summary}",
                    "It covers unrelated topics",
                    "It only lists definitions",
                    "I'm not sure yet",
                ],
                "correctAnswer": 0,
                "explanation": "Review the lesson content and try again if needed.",
                "prompt": "Choose the option that best matches what you learned.",
            }
            updated = True

        if updated:
            section.save()
        return updated

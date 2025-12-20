from django.core.management.base import BaseCommand
from django.utils.html import strip_tags
from django.db import transaction

from education.models import Lesson, LessonSection


class Command(BaseCommand):
    help = (
        "Ensure every lesson has at least two text sections, two exercises, and one video section. "
        "Existing sections are preserved and new ones are appended in order."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Show the actions that would be taken without creating sections.",
        )

    def handle(self, *args, **options):
        dry_run = options["dry_run"]
        created_count = 0

        for lesson in Lesson.objects.select_related("course").prefetch_related("sections"):
            with transaction.atomic():
                existing_sections = list(lesson.sections.order_by("order"))
                next_order = existing_sections[-1].order + 1 if existing_sections else 1

                missing_builders = []

                # Text sections
                text_sections = [s for s in existing_sections if s.content_type == "text"]
                missing_text_needed = max(0, 2 - len(text_sections))
                for idx in range(missing_text_needed):
                    missing_builders.append(
                        lambda order, l=lesson, step=idx, existing=len(
                            text_sections
                        ): self._build_text_section(l, order, existing + step)
                    )

                # Video section
                has_video = any(s.content_type == "video" for s in existing_sections)
                if not has_video:
                    missing_builders.append(
                        lambda order, l=lesson: self._build_video_section(l, order)
                    )

                # Exercise sections
                exercise_sections = [s for s in existing_sections if s.content_type == "exercise"]
                for _ in range(2 - len(exercise_sections)):
                    missing_builders.append(
                        lambda order, l=lesson, existing=len(
                            exercise_sections
                        ): self._build_exercise_section(l, order, existing + 1)
                    )
                    exercise_sections.append(None)

                for builder in missing_builders:
                    section_payload = builder(next_order)
                    next_order += 1

                    message = (
                        f"Would create section '{section_payload['title']}' "
                        f"(type={section_payload['content_type']}) for {lesson}"
                    )

                    if dry_run:
                        self.stdout.write(self.style.WARNING(message))
                        continue

                    LessonSection.objects.create(**section_payload)
                    created_count += 1
                    self.stdout.write(self.style.SUCCESS(message.replace("Would ", "")))

        if dry_run:
            self.stdout.write(self.style.NOTICE("Dry run complete."))
        else:
            self.stdout.write(self.style.SUCCESS(f"Created {created_count} missing sections."))

    def _build_text_section(self, lesson, order, existing_count):
        course_title = lesson.course.title if lesson.course else "Learning Path"
        summary = self._lesson_summary(lesson, course_title)

        if existing_count == 0:
            title_suffix = "Overview"
            text_content = (
                f"{summary}\n\nWhat you'll learn in {lesson.title}:\n"
                "- The core promise of the lesson and why it matters for your goals.\n"
                "- A quick orientation so you can skim before watching the video.\n"
                f"- How this topic fits into the broader {course_title} journey.\n\n"
                "Tip: Read this overview, then watch the video to see the ideas in action."
            )
        else:
            title_suffix = "Key takeaways"
            text_content = (
                f"Review the essentials from {lesson.title}:\n"
                f"- Core idea: {summary}\n"
                f"- Applied value: it accelerates your progress in {course_title}.\n"
                "- Signals you understand it: you can explain the idea simply and name one use case.\n"
                "Use these notes to confirm you're ready for the exercises and next lesson."
            )

        return {
            "lesson": lesson,
            "order": order,
            "title": f"{lesson.title}: {title_suffix}",
            "content_type": "text",
            "text_content": text_content,
            "is_published": True,
        }

    def _build_video_section(self, lesson, order):
        fallback_video = "https://www.youtube.com/watch?v=ysz5S6PUM-U"
        summary = self._lesson_summary(
            lesson, lesson.course.title if lesson.course else "this course"
        )
        return {
            "lesson": lesson,
            "order": order,
            "title": f"{lesson.title}: Watch and learn",
            "content_type": "video",
            "video_url": lesson.video_url or fallback_video,
            "text_content": (
                f"Watch this walkthrough of {lesson.title}.\n\n"
                f"Focus on how the presenter links the idea back to {summary}. "
                "Pause to note specific steps or visual cues that clarify the topic."
            ),
            "is_published": True,
        }

    def _build_exercise_section(self, lesson, order, index):
        course_title = lesson.course.title if lesson.course else "this course"
        summary = self._lesson_summary(lesson, course_title)
        if index == 1:
            question = (
                f"Which statement best captures the goal of '{lesson.title}' in {course_title}?"
            )
            options = [
                f"It clarifies: {summary}",
                "It introduces unrelated facts",
                "It only lists generic study tips",
                "I'm still unsure how it fits",
            ]
            correct_answer = 0
            explanation = (
                "The lesson is designed to make its core promise clear and show why it matters. "
                "The other options don't align with the summary."
            )
        else:
            question = f"What's the first practical step to apply '{lesson.title}' after this course section?"
            options = [
                "Identify one scenario from your work or study where it fits",
                "Skip to the next lesson without reflection",
                "Rewatch without taking notes",
                "Ignore the course context and experiment randomly",
            ]
            correct_answer = 0
            explanation = (
                "Choosing a real scenario cements the concept and keeps it tied to your goals. "
                "The other options miss intentional practice."
            )

        return {
            "lesson": lesson,
            "order": order,
            "title": f"{lesson.title}: Practice #{index}",
            "content_type": "exercise",
            "exercise_type": "multiple-choice",
            "exercise_data": {
                "question": question,
                "options": options,
                "correctAnswer": correct_answer,
                "explanation": explanation,
                "prompt": (
                    "Use what you just watched and read. If you're unsure, revisit the takeaways and try again."
                ),
            },
            "is_published": True,
        }

    def _lesson_summary(self, lesson, course_title):
        raw_text = lesson.short_description or strip_tags(lesson.detailed_content or "").strip()
        if raw_text:
            return raw_text

        return (
            f"{lesson.title} gives you the background needed for {course_title}, "
            "highlighting the concepts you'll use in the upcoming sections."
        )

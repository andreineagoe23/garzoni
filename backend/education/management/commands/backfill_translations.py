"""
Backfill translation tables from canonical (English) content.
Run after adding translation models so the API can return localized content.

Usage:
  python manage.py backfill_translations              # Create 'en' from canonical, copy to 'ro'
  python manage.py backfill_translations --ro-only   # Only create/update 'ro' (copy of en)
  python manage.py backfill_translations --dry-run   # Show what would be created
"""

from django.core.management.base import BaseCommand
from django.db import transaction

from education.models import (
    Path,
    Course,
    Lesson,
    LessonSection,
    Quiz,
    Exercise,
    PathTranslation,
    CourseTranslation,
    LessonTranslation,
    LessonSectionTranslation,
    QuizTranslation,
    ExerciseTranslation,
)


class Command(BaseCommand):
    help = "Backfill translation tables from canonical content (en) and optionally copy to ro"

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Only print what would be created, do not write",
        )
        parser.add_argument(
            "--ro-only",
            action="store_true",
            help="Only ensure 'ro' translations exist (copy from en or canonical)",
        )

    def handle(self, *args, **options):
        dry_run = options["dry_run"]
        ro_only = options["ro_only"]

        if dry_run:
            self.stdout.write("DRY RUN - no changes will be saved")

        with transaction.atomic():
            if not ro_only:
                self._backfill_paths(dry_run)
                self._backfill_courses(dry_run)
                self._backfill_lessons(dry_run)
                self._backfill_sections(dry_run)
                self._backfill_quizzes(dry_run)
                self._backfill_exercises(dry_run)

            self._ensure_ro(dry_run)

            if dry_run:
                transaction.set_rollback(True)

        self.stdout.write(self.style.SUCCESS("Backfill complete."))

    def _backfill_paths(self, dry_run):
        for path in Path.objects.all():
            _, created = PathTranslation.objects.get_or_create(
                path=path,
                language="en",
                defaults={"title": path.title, "description": path.description or ""},
            )
            if created and not dry_run:
                self.stdout.write(f"  PathTranslation en: path_id={path.id}")

    def _backfill_courses(self, dry_run):
        for course in Course.objects.all():
            _, created = CourseTranslation.objects.get_or_create(
                course=course,
                language="en",
                defaults={
                    "title": course.title,
                    "description": course.description or "",
                },
            )
            if created and not dry_run:
                self.stdout.write(f"  CourseTranslation en: course_id={course.id}")

    def _backfill_lessons(self, dry_run):
        for lesson in Lesson.objects.all():
            _, created = LessonTranslation.objects.get_or_create(
                lesson=lesson,
                language="en",
                defaults={
                    "title": lesson.title,
                    "short_description": lesson.short_description or "",
                    "detailed_content": lesson.detailed_content or "",
                },
            )
            if created and not dry_run:
                self.stdout.write(f"  LessonTranslation en: lesson_id={lesson.id}")

    def _backfill_sections(self, dry_run):
        for section in LessonSection.objects.all():
            _, created = LessonSectionTranslation.objects.get_or_create(
                section=section,
                language="en",
                defaults={
                    "title": section.title or "",
                    "text_content": section.text_content,
                    "exercise_data": section.exercise_data,
                },
            )
            if created and not dry_run:
                self.stdout.write(f"  LessonSectionTranslation en: section_id={section.id}")

    def _backfill_quizzes(self, dry_run):
        for quiz in Quiz.objects.all():
            _, created = QuizTranslation.objects.get_or_create(
                quiz=quiz,
                language="en",
                defaults={
                    "title": quiz.title,
                    "question": quiz.question or "",
                    "choices": quiz.choices or [],
                    "correct_answer": quiz.correct_answer or "",
                },
            )
            if created and not dry_run:
                self.stdout.write(f"  QuizTranslation en: quiz_id={quiz.id}")

    def _backfill_exercises(self, dry_run):
        for exercise in Exercise.objects.all():
            _, created = ExerciseTranslation.objects.get_or_create(
                exercise=exercise,
                language="en",
                defaults={
                    "question": exercise.question or "",
                    "exercise_data": exercise.exercise_data,
                },
            )
            if created and not dry_run:
                self.stdout.write(f"  ExerciseTranslation en: exercise_id={exercise.id}")

    def _ensure_ro(self, dry_run):
        """Create 'ro' translations by copying from 'en' or from canonical where en missing."""
        for path in Path.objects.prefetch_related("translations"):
            en_trans = next((t for t in path.translations.all() if t.language == "en"), None)
            if en_trans:
                self._get_or_create_ro(
                    PathTranslation,
                    path,
                    "path",
                    {"title": en_trans.title, "description": en_trans.description},
                    dry_run,
                    f"Path path_id={path.id}",
                )
            else:
                self._get_or_create_ro(
                    PathTranslation,
                    path,
                    "path",
                    {"title": path.title, "description": path.description or ""},
                    dry_run,
                    f"Path path_id={path.id}",
                )

        for course in Course.objects.prefetch_related("translations"):
            en_trans = next((t for t in course.translations.all() if t.language == "en"), None)
            self._get_or_create_ro(
                CourseTranslation,
                course,
                "course",
                {
                    "title": en_trans.title if en_trans else course.title,
                    "description": (en_trans.description if en_trans else course.description) or "",
                },
                dry_run,
                f"Course course_id={course.id}",
            )

        for lesson in Lesson.objects.prefetch_related("translations"):
            en_trans = next((t for t in lesson.translations.all() if t.language == "en"), None)
            self._get_or_create_ro(
                LessonTranslation,
                lesson,
                "lesson",
                {
                    "title": en_trans.title if en_trans else lesson.title,
                    "short_description": (
                        en_trans.short_description if en_trans else lesson.short_description
                    )
                    or "",
                    "detailed_content": (
                        en_trans.detailed_content if en_trans else lesson.detailed_content
                    )
                    or "",
                },
                dry_run,
                f"Lesson lesson_id={lesson.id}",
            )

        for section in LessonSection.objects.prefetch_related("translations"):
            en_trans = next((t for t in section.translations.all() if t.language == "en"), None)
            self._get_or_create_ro(
                LessonSectionTranslation,
                section,
                "section",
                {
                    "title": en_trans.title if en_trans else (section.title or ""),
                    "text_content": en_trans.text_content if en_trans else section.text_content,
                    "exercise_data": en_trans.exercise_data if en_trans else section.exercise_data,
                },
                dry_run,
                f"Section section_id={section.id}",
            )

        for quiz in Quiz.objects.prefetch_related("translations"):
            en_trans = next((t for t in quiz.translations.all() if t.language == "en"), None)
            self._get_or_create_ro(
                QuizTranslation,
                quiz,
                "quiz",
                {
                    "title": en_trans.title if en_trans else quiz.title,
                    "question": en_trans.question if en_trans else (quiz.question or ""),
                    "choices": en_trans.choices if en_trans else (quiz.choices or []),
                    "correct_answer": (
                        en_trans.correct_answer if en_trans else (quiz.correct_answer or "")
                    ),
                },
                dry_run,
                f"Quiz quiz_id={quiz.id}",
            )

        for exercise in Exercise.objects.prefetch_related("translations"):
            en_trans = next((t for t in exercise.translations.all() if t.language == "en"), None)
            self._get_or_create_ro(
                ExerciseTranslation,
                exercise,
                "exercise",
                {
                    "question": en_trans.question if en_trans else (exercise.question or ""),
                    "exercise_data": en_trans.exercise_data if en_trans else exercise.exercise_data,
                },
                dry_run,
                f"Exercise exercise_id={exercise.id}",
            )

    def _get_or_create_ro(self, model_class, parent, parent_attr, defaults, dry_run, label):
        filter_kw = {parent_attr: parent}
        if not dry_run:
            obj, created = model_class.objects.get_or_create(
                **filter_kw,
                language="ro",
                defaults=defaults,
            )
            if created:
                self.stdout.write(f"  {model_class.__name__} ro: {label}")

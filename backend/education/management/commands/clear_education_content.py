"""
Clear education content tables (and CASCADE-dependent rows) so a fixture can be loaded.
Use before import_education_content when the DB already has content.

Usage:
    python manage.py clear_education_content
"""

from django.core.management.base import BaseCommand
from django.db import connection


class Command(BaseCommand):
    help = "Clear education content tables (TRUNCATE CASCADE) so import_education_content can load a fixture."

    def handle(self, *args, **options):
        sql = """
        TRUNCATE TABLE
          education_content_release_state,
          core_multiplechoicechoice,
          education_exercise_translation,
          education_quiz_translation,
          education_lessonsection_translation,
          education_lesson_translation,
          education_course_translation,
          education_path_translation,
          core_exercise,
          core_quiz,
          core_lessonsection,
          core_lesson,
          core_course,
          core_path
        CASCADE;
        """
        with connection.cursor() as cursor:
            cursor.execute(sql)
        connection.commit()
        self.stdout.write(self.style.SUCCESS("Cleared education content tables."))

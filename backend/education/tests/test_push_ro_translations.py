from io import StringIO
from unittest.mock import MagicMock

from django.test import TestCase

from education.management.commands.push_ro_translations_to_railway import Command
from education.models import (
    Course,
    Exercise,
    ExerciseTranslation,
    Lesson,
    LessonSection,
    LessonSectionTranslation,
    Path,
)


class FakeCursor:
    """Stands in for a Railway cursor: serves fixed rows, records every write."""

    def __init__(self, remote_rows):
        self.remote_rows = remote_rows
        self.writes = []
        self.rowcount = 1

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        return False

    def execute(self, sql, params=None):
        if not sql.lstrip().upper().startswith("SELECT"):
            self.writes.append((sql, params))

    def fetchall(self):
        return self.remote_rows


def _conn(cursor):
    conn = MagicMock()
    conn.cursor.return_value = cursor
    return conn


def _command():
    return Command(stdout=StringIO(), stderr=StringIO())


OPTIONS = ["a", "b", "c", "d"]


class PushSectionTranslationsTests(TestCase):
    def setUp(self):
        path = Path.objects.create(title="Basic Finance", description="d")
        course = Course.objects.create(path=path, title="Budgeting", description="d")
        self.lesson = Lesson.objects.create(
            course=course,
            title="What is a budget?",
            short_description="d",
            detailed_content="<p>d</p>",
        )
        self.lesson.refresh_from_db()
        self.section = LessonSection.objects.create(
            lesson=self.lesson,
            order=3,
            title="Knowledge Check",
            content_type="exercise",
            exercise_type="multiple-choice",
            is_published=True,
            exercise_data={"question": "Which?", "options": OPTIONS, "correctAnswer": 0},
        )
        LessonSectionTranslation.objects.create(
            section=self.section,
            language="ro",
            title="Verificare",
            exercise_data={"question": "Care?", "options": ["ra", "rb", "rc", "rd"]},
        )

    def test_writes_to_the_railway_section_with_the_same_slug_and_order(self):
        sid = self.section.id
        cursor = FakeCursor(
            [
                # Same id as the local section, but a different lesson on Railway.
                (sid, 3, "current-vs-savings-accounts", "multiple-choice", {"options": OPTIONS}),
                (sid + 7, 3, self.lesson.slug, "multiple-choice", {"options": OPTIONS}),
            ]
        )
        pushed, failed = _command()._push_sections(_conn(cursor), False, "exercise")
        self.assertEqual((pushed, failed), (1, 0))
        self.assertEqual(len(cursor.writes), 1)
        self.assertEqual(cursor.writes[0][1][-2:], (sid + 7, "ro"))

    def test_skips_when_railway_options_would_not_align(self):
        cursor = FakeCursor(
            [(self.section.id, 3, self.lesson.slug, "multiple-choice", {"options": ["a", "b"]})]
        )
        pushed, failed = _command()._push_sections(_conn(cursor), False, "exercise")
        self.assertEqual((pushed, failed), (0, 1))
        self.assertEqual(cursor.writes, [])

    def test_skips_when_railway_section_is_a_different_exercise_type(self):
        cursor = FakeCursor(
            [(self.section.id, 3, self.lesson.slug, "drag-and-drop", {"options": OPTIONS})]
        )
        pushed, failed = _command()._push_sections(_conn(cursor), False, "exercise")
        self.assertEqual((pushed, failed), (0, 1))
        self.assertEqual(cursor.writes, [])

    def test_dry_run_writes_nothing(self):
        cursor = FakeCursor(
            [(self.section.id, 3, self.lesson.slug, "multiple-choice", {"options": OPTIONS})]
        )
        pushed, failed = _command()._push_sections(_conn(cursor), True, "exercise")
        self.assertEqual((pushed, failed), (1, 0))
        self.assertEqual(cursor.writes, [])


class PushExerciseTranslationsTests(TestCase):
    def setUp(self):
        self.exercise = Exercise.objects.create(
            type="multiple-choice",
            question="Which?",
            exercise_data={"options": OPTIONS},
            correct_answer=0,
            category="Budgeting",
            is_published=True,
        )
        ExerciseTranslation.objects.create(
            exercise=self.exercise,
            language="ro",
            question="Care?",
            exercise_data={"options": ["ra", "rb", "rc", "rd"]},
        )

    def test_writes_when_railway_english_matches(self):
        cursor = FakeCursor([(self.exercise.id, "Which?", {"options": OPTIONS})])
        pushed, failed = _command()._push_standalone_exercises(_conn(cursor), False)
        self.assertEqual((pushed, failed), (1, 0))
        self.assertEqual(len(cursor.writes), 1)

    def test_skips_when_the_railway_question_differs(self):
        cursor = FakeCursor([(self.exercise.id, "Something else?", {"options": OPTIONS})])
        pushed, failed = _command()._push_standalone_exercises(_conn(cursor), False)
        self.assertEqual((pushed, failed), (0, 1))
        self.assertEqual(cursor.writes, [])

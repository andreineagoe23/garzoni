"""Activity calendar breakdown and ExerciseCompletion on submit."""

import time

from django.contrib.auth.models import User
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APITestCase

from authentication.services.profile import build_activity_calendar_by_type
from education.models import (
    Course,
    DailyActivityLog,
    Exercise,
    ExerciseCompletion,
    Lesson,
    LessonSection,
    Path,
)
from education.services.activity import record_activity


def _make_numeric_exercise(**kwargs):
    defaults = {
        "type": "numeric",
        "question": "What is 2+2?",
        "exercise_data": {"tolerance": "0.01"},
        "correct_answer": 4,
        "category": "Budgeting",
        "is_published": True,
    }
    defaults.update(kwargs)
    return Exercise.objects.create(**defaults)


class BuildActivityCalendarByTypeTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="caluser", password="test-pass-123!")
        self.path = Path.objects.create(title="Path", description="")
        self.course = Course.objects.create(title="Course", description="", path=self.path)
        self.lesson = Lesson.objects.create(
            course=self.course, title="Lesson", detailed_content="x"
        )
        self.section = LessonSection.objects.create(
            lesson=self.lesson,
            order=1,
            title="Sec",
            content_type="text",
            text_content="",
            is_published=True,
        )

    def test_same_day_lesson_section_exercise_and_quiz_counts(self):
        today = timezone.now().date()
        ex = _make_numeric_exercise()
        record_activity(self.user, "lesson", self.lesson.id, course=self.course)
        record_activity(self.user, "section", self.section.id, course=self.course)
        record_activity(self.user, "exercise", ex.id, course=self.course)
        record_activity(self.user, "quiz", 999, course=self.course)

        # Keep all activity rows on today's date for deterministic assertions.
        DailyActivityLog.objects.filter(user=self.user).update(date=today)

        out = build_activity_calendar_by_type(self.user, today, today)
        key = today.isoformat()
        self.assertEqual(out[key]["lessons"], 1)
        self.assertEqual(out[key]["sections"], 1)
        self.assertEqual(out[key]["exercises"], 1)
        self.assertEqual(out[key]["quizzes"], 1)


class ExerciseSubmitCreatesCompletionTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="exuser", password="test-pass-123!")
        self.client.force_authenticate(self.user)
        self.ex = _make_numeric_exercise()

    def test_first_correct_submit_creates_exercise_completion(self):
        url = f"/api/exercises/{self.ex.id}/submit/"
        r = self.client.post(url, {"user_answer": 4}, format="json")
        self.assertEqual(r.status_code, 200)
        self.assertTrue(r.data.get("correct"))
        self.assertEqual(
            ExerciseCompletion.objects.filter(user=self.user, exercise=self.ex).count(),
            1,
        )
        self.assertEqual(
            DailyActivityLog.objects.filter(
                user=self.user, activity_type="exercise", object_id=self.ex.id
            ).count(),
            1,
        )

    def test_second_correct_submit_does_not_duplicate_completion(self):
        url = f"/api/exercises/{self.ex.id}/submit/"
        self.assertEqual(self.client.post(url, {"user_answer": 4}, format="json").status_code, 200)
        # Avoid duplicate-payload throttle (1.5s window) on the second identical submit.
        time.sleep(2)
        self.assertEqual(self.client.post(url, {"user_answer": 4}, format="json").status_code, 200)
        self.assertEqual(
            ExerciseCompletion.objects.filter(user=self.user, exercise=self.ex).count(),
            1,
        )


class ExerciseSubmitSectionIdTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="secuser2", password="test-pass-123!")
        self.client.force_authenticate(self.user)
        self.path = Path.objects.create(title="Path", description="")
        self.course = Course.objects.create(title="Course", description="", path=self.path)
        self.lesson = Lesson.objects.create(
            course=self.course, title="Lesson", detailed_content="x"
        )
        self.ex = _make_numeric_exercise()
        self.section = LessonSection.objects.create(
            lesson=self.lesson,
            order=1,
            title="Ex sec",
            content_type="exercise",
            exercise_type="numeric",
            exercise_data={
                "question": "q",
                "expected_value": 4,
                "exercise_id": self.ex.id,
            },
            is_published=True,
        )

    def test_section_id_matching_exercise_id_succeeds(self):
        url = f"/api/exercises/{self.ex.id}/submit/"
        r = self.client.post(
            url,
            {"user_answer": 4, "section_id": self.section.id},
            format="json",
        )
        self.assertEqual(r.status_code, 200)
        ec = ExerciseCompletion.objects.get(user=self.user, exercise=self.ex)
        self.assertEqual(ec.section_id, self.section.id)

    def test_section_id_wrong_exercise_returns_400(self):
        other = _make_numeric_exercise(question="Other?")
        url = f"/api/exercises/{other.id}/submit/"
        r = self.client.post(
            url,
            {"user_answer": 4, "section_id": self.section.id},
            format="json",
        )
        self.assertEqual(r.status_code, 400)

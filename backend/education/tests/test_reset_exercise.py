from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework.test import APIClient

from education.models import (
    Course,
    Exercise,
    Lesson,
    LessonSection,
    Path,
    SectionCompletion,
    UserExerciseProgress,
    UserProgress,
)


class ResetExerciseTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user("learner", password="testpass123")
        self.client = APIClient()
        self.client.force_authenticate(self.user)

        path = Path.objects.create(title="Basic Finance", description="d")
        self.course = Course.objects.create(path=path, title="Budgeting", description="d")
        self.lesson = Lesson.objects.create(
            course=self.course,
            title="What is a budget?",
            short_description="d",
            detailed_content="<p>d</p>",
        )
        self.exercise = Exercise.objects.create(
            type="multiple-choice",
            question="Which is it?",
            exercise_data={"options": ["a", "b", "c", "d"], "correctAnswer": 1},
            correct_answer={"index": 1},
            category="Budgeting",
            is_published=True,
        )

    def _section(self, order, data):
        return LessonSection.objects.create(
            lesson=self.lesson,
            order=order,
            title=f"Knowledge Check {order}",
            content_type="exercise",
            exercise_type="multiple-choice",
            exercise_data=data,
        )

    def test_in_lesson_check_does_not_500(self):
        # Regression: reset_exercise filtered Exercise on a `section` field that
        # does not exist, raising an uncaught FieldError. Every retry from the
        # lesson flow returned 500.
        section = self._section(3, {"options": ["a", "b", "c", "d"], "correctAnswer": 1})
        response = self.client.post("/api/exercises/reset/", {"section_id": section.id})
        self.assertEqual(response.status_code, 200)
        self.assertFalse(response.data["reset"])

    def test_section_linked_to_catalog_exercise_resets_progress(self):
        section = self._section(
            6,
            {
                "options": ["a", "b", "c", "d"],
                "correctAnswer": 1,
                "catalog_exercise_id": self.exercise.id,
            },
        )
        progress = UserExerciseProgress.objects.create(
            user=self.user, exercise=self.exercise, attempts=3, completed=True, user_answer=2
        )
        response = self.client.post("/api/exercises/reset/", {"section_id": section.id})
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data["reset"])
        progress.refresh_from_db()
        self.assertEqual(progress.attempts, 0)
        self.assertFalse(progress.completed)
        self.assertIsNone(progress.user_answer)

    def test_retry_never_walks_section_completion_backwards(self):
        # Retrying a question is "let me answer it again", not "undo my
        # progress" — the journey tile must not drop back below 100%.
        section = self._section(3, {"options": ["a", "b", "c", "d"], "correctAnswer": 1})
        progress = UserProgress.objects.create(user=self.user, course=self.course)
        SectionCompletion.objects.create(user_progress=progress, section=section)
        self.client.post("/api/exercises/reset/", {"section_id": section.id})
        self.assertTrue(
            SectionCompletion.objects.filter(user_progress=progress, section=section).exists(),
        )

    def test_missing_section_is_404(self):
        response = self.client.post("/api/exercises/reset/", {"section_id": 99999})
        self.assertEqual(response.status_code, 404)

    def test_no_stored_progress_is_not_an_error(self):
        response = self.client.post("/api/exercises/reset/", {"exercise_id": self.exercise.id})
        self.assertEqual(response.status_code, 200)
        self.assertFalse(response.data["reset"])

    def test_requires_an_identifier(self):
        response = self.client.post("/api/exercises/reset/", {})
        self.assertEqual(response.status_code, 400)


class CheckpointQuizServingTests(TestCase):
    """A checkpoint must never outlive the multiple-choice section it came from."""

    def setUp(self):
        self.user = User.objects.create_user("learner2", password="testpass123")
        self.client = APIClient()
        self.client.force_authenticate(self.user)
        path = Path.objects.create(title="Basic Finance", description="d")
        self.course = Course.objects.create(path=path, title="Budgeting", description="d")
        self.lesson = Lesson.objects.create(
            course=self.course,
            title="Simple budget",
            short_description="d",
            detailed_content="<p>d</p>",
        )

    def _checkpoint(self, order, exercise_type):
        from education.models import Quiz

        section = LessonSection.objects.create(
            lesson=self.lesson,
            order=order,
            title=f"Knowledge Check {order}",
            content_type="exercise",
            exercise_type=exercise_type,
            exercise_data={"question": "q?", "options": ["a", "b", "c", "d"], "correctAnswer": 1},
        )
        return Quiz.objects.create(
            course=self.course,
            lesson=self.lesson,
            source_lesson_section=section,
            title=section.title,
            question="q?",
            choices=[{"text": t} for t in ["a", "b", "c", "d"]],
            correct_answer="b",
        )

    def test_orphaned_checkpoint_is_not_served(self):
        live = self._checkpoint(3, "multiple-choice")
        orphan = self._checkpoint(6, "numeric")
        response = self.client.get(f"/api/quizzes/checkpoint/?lesson={self.lesson.id}")
        self.assertEqual(response.status_code, 200)
        served = {row["id"] for row in response.data}
        self.assertIn(live.id, served)
        self.assertNotIn(orphan.id, served)

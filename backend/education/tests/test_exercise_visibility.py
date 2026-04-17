from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework.test import APIClient

from education.models import Exercise


class ExerciseLearnerVisibilityTests(TestCase):
    def setUp(self):
        self.learner = User.objects.create_user("learner", password="testpass123")
        self.staff = User.objects.create_user("staffer", password="testpass123", is_staff=True)
        self.client = APIClient()

    def _make_exercise(self, **kwargs):
        defaults = {
            "type": "numeric",
            "question": "Sample?",
            "exercise_data": {"value": 1},
            "correct_answer": {"value": 1},
            "category": "Budgeting",
            "is_published": True,
        }
        defaults.update(kwargs)
        return Exercise.objects.create(**defaults)

    def test_learner_list_excludes_blank_question_even_if_published(self):
        self._make_exercise(question="", category="Budgeting")
        self.client.force_authenticate(self.learner)
        response = self.client.get("/api/exercises/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 0)

    def test_learner_list_excludes_general_category(self):
        self._make_exercise(category="General")
        self.client.force_authenticate(self.learner)
        response = self.client.get("/api/exercises/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 0)

    def test_learner_sees_valid_published_non_general(self):
        ex = self._make_exercise()
        self.client.force_authenticate(self.learner)
        response = self.client.get("/api/exercises/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]["id"], ex.id)

    def test_staff_list_includes_general_and_blank(self):
        self._make_exercise(question="", category="General")
        self.client.force_authenticate(self.staff)
        response = self.client.get("/api/exercises/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 1)

    def test_staff_list_as_learner_matches_learner_catalog(self):
        self._make_exercise(question="", category="General")
        self._make_exercise()
        self.client.force_authenticate(self.staff)
        response = self.client.get("/api/exercises/", {"as_learner": "1"})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 1)

    def test_categories_endpoint_hides_general_for_learners(self):
        self._make_exercise(category="Personal Finance")
        self._make_exercise(category="General", question="Visible general?")
        self.client.force_authenticate(self.learner)
        response = self.client.get("/api/exercises/categories/")
        self.assertEqual(response.status_code, 200)
        self.assertIn("Personal Finance", response.data)
        self.assertNotIn("General", response.data)

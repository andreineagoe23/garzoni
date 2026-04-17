from django.contrib.auth.models import User
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from education.models import Course, Lesson, LessonSection, Path, Quiz


class LessonCheckpointQuizTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="ckuser", password="test-pass-123!")
        self.client.force_authenticate(self.user)
        self.path = Path.objects.create(title="Path", description="")
        self.course = Course.objects.create(title="Course", description="", path=self.path)
        self.lesson = Lesson.objects.create(
            course=self.course, title="Lesson", detailed_content="x"
        )

    def test_checkpoint_materializes_from_multiple_choice_section(self):
        LessonSection.objects.create(
            lesson=self.lesson,
            order=1,
            title="Practice Q",
            content_type="exercise",
            exercise_type="multiple-choice",
            exercise_data={
                "question": "What is 2+2?",
                "options": ["3", "4", "5"],
                "correctAnswer": 1,
            },
            is_published=True,
        )
        url = reverse("quiz-checkpoint")
        r = self.client.get(url, {"lesson": self.lesson.id})
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.assertIsInstance(r.data, list)
        self.assertEqual(len(r.data), 1)
        row = r.data[0]
        self.assertEqual(row["question"], "What is 2+2?")
        self.assertEqual(row["correct_answer"], "4")
        self.assertTrue(Quiz.objects.filter(lesson=self.lesson).exists())

    def test_checkpoint_requires_lesson_param(self):
        url = reverse("quiz-checkpoint")
        r = self.client.get(url)
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(r.data.get("error"), "lesson is required")

    def test_checkpoint_unknown_lesson_returns_404(self):
        url = reverse("quiz-checkpoint")
        r = self.client.get(url, {"lesson": 9_999_999})
        self.assertEqual(r.status_code, status.HTTP_404_NOT_FOUND)

    def test_checkpoint_empty_list_when_no_suitable_sections(self):
        url = reverse("quiz-checkpoint")
        r = self.client.get(url, {"lesson": self.lesson.id})
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.assertEqual(r.data, [])

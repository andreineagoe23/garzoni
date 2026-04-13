"""Regression tests for unified reward grants and quiz idempotency.

Run locally (same env as other Django tests) with Celery eager and no broker,
otherwise Path creation can enqueue Celery tasks that require Redis:

    unset REDIS_URL CELERY_BROKER_URL
    export CELERY_TASK_ALWAYS_EAGER=true
    export DATABASE_URL=postgresql://...
    python manage.py test tests.test_rewards
"""

from django.contrib.auth.models import User
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from education.models import (
    Course,
    Lesson,
    LessonSection,
    Path,
    Quiz,
)
from gamification.models import RewardLedgerEntry
from gamification.services.rewards import grant_reward


class RewardLedgerTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="rewarduser", password="test-pass-123!")
        self.client.force_authenticate(self.user)

    def test_grant_reward_is_idempotent(self):
        self.user.profile.refresh_from_db()
        before = self.user.profile.points
        r1 = grant_reward(self.user, "unit:test:event:1", points=7, coins=0)
        self.assertTrue(r1.granted)
        self.user.profile.refresh_from_db()
        self.assertEqual(self.user.profile.points, before + 7)
        r2 = grant_reward(self.user, "unit:test:event:1", points=7, coins=0)
        self.assertFalse(r2.granted)
        self.assertTrue(r2.duplicate)
        self.user.profile.refresh_from_db()
        self.assertEqual(self.user.profile.points, before + 7)
        self.assertEqual(
            RewardLedgerEntry.objects.filter(
                user=self.user, event_key="unit:test:event:1"
            ).count(),
            1,
        )


class SectionRewardIdempotencyTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="secuser", password="test-pass-123!")
        self.client.force_authenticate(self.user)
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

    def test_complete_section_twice_no_extra_xp(self):
        url = reverse("userprogress-complete-section")
        self.assertEqual(self.client.post(url, {"section_id": self.section.id}, format="json").status_code, 200)
        self.user.profile.refresh_from_db()
        pts = self.user.profile.points
        self.assertEqual(self.client.post(url, {"section_id": self.section.id}, format="json").status_code, 200)
        self.user.profile.refresh_from_db()
        self.assertEqual(self.user.profile.points, pts)


class QuizRewardIdempotencyTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="quizuser", password="test-pass-123!")
        self.client.force_authenticate(self.user)
        self.path = Path.objects.create(title="Path", description="")
        self.course = Course.objects.create(title="Course", description="", path=self.path)
        self.quiz = Quiz.objects.create(
            course=self.course,
            title="Q",
            question="?",
            choices=[{"text": "A"}, {"text": "B"}],
            correct_answer="A",
        )

    def test_quiz_correct_twice_no_double_coins(self):
        url = reverse("quiz-complete")
        body = {"quiz_id": self.quiz.id, "selected_answer": "A"}
        r1 = self.client.post(url, body, format="json")
        self.assertEqual(r1.status_code, status.HTTP_200_OK)
        self.assertTrue(r1.data.get("correct"))
        self.user.profile.refresh_from_db()
        money1 = self.user.profile.earned_money
        pts1 = self.user.profile.points
        r2 = self.client.post(url, body, format="json")
        self.assertEqual(r2.status_code, status.HTTP_200_OK)
        self.assertTrue(r2.data.get("already_completed"))
        self.user.profile.refresh_from_db()
        self.assertEqual(self.user.profile.earned_money, money1)
        self.assertEqual(self.user.profile.points, pts1)

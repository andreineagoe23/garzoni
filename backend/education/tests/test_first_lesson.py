"""First-ever-lesson celebration payload (UX Phase 2, plan §2.6).

The completion endpoints must flag the user's first lesson exactly once,
stamp profile.first_lesson_at, and grant the one-time bonus XP idempotently.
"""

from django.contrib.auth.models import User
from rest_framework.test import APITestCase

from authentication.models import UserProfile
from education.models import Course, Lesson, Path
from gamification.models import RewardLedgerEntry
from gamification.services.rewards import XP_FIRST_LESSON_EVER_BONUS


class FirstLessonCompletionTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="first-lesson-user",
            email="first@example.com",
            password="pass12345",
        )
        self.profile, _ = UserProfile.objects.get_or_create(user=self.user)
        path = Path.objects.create(title="Budgeting", description="Test path")
        course = Course.objects.create(path=path, title="Budgeting", description="")
        self.lesson_one = Lesson.objects.create(
            course=course, title="Lesson 1", detailed_content="Body"
        )
        self.lesson_two = Lesson.objects.create(
            course=course, title="Lesson 2", detailed_content="Body"
        )
        self.client.force_authenticate(user=self.user)

    def _complete(self, lesson):
        from django.urls import reverse

        return self.client.post(
            reverse("userprogress-complete"), {"lesson_id": lesson.id}, format="json"
        )

    def test_first_lesson_flagged_and_bonus_granted(self):
        resp = self._complete(self.lesson_one)
        self.assertEqual(resp.status_code, 200)
        self.assertTrue(resp.data["is_first_lesson"])
        self.assertEqual(resp.data["first_lesson_bonus_xp"], XP_FIRST_LESSON_EVER_BONUS)
        self.profile.refresh_from_db()
        self.assertIsNotNone(self.profile.first_lesson_at)
        self.assertEqual(
            RewardLedgerEntry.objects.filter(
                user=self.user, event_key=f"first_lesson_ever_bonus:{self.user.id}"
            ).count(),
            1,
        )

    def test_second_lesson_not_flagged(self):
        self._complete(self.lesson_one)
        resp = self._complete(self.lesson_two)
        self.assertEqual(resp.status_code, 200)
        self.assertFalse(resp.data["is_first_lesson"])
        self.assertIsNone(resp.data["first_lesson_bonus_xp"])

    def test_recompleting_same_lesson_not_flagged_again(self):
        self._complete(self.lesson_one)
        resp = self._complete(self.lesson_one)
        self.assertEqual(resp.status_code, 200)
        self.assertFalse(resp.data["is_first_lesson"])
        self.assertEqual(
            RewardLedgerEntry.objects.filter(
                user=self.user, event_key=f"first_lesson_ever_bonus:{self.user.id}"
            ).count(),
            1,
        )

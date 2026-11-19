"""Finishing a lesson section by section runs the lesson-completion side effects.

The course flow only ever calls ``complete_section``, so before this the lesson reward,
``complete_lesson`` missions, ``first_lesson_at`` and the first-lesson bonus never fired
for anyone (0 of 28 lesson finishers had ``first_lesson_at`` in prod, 2026-11-19).
"""

from django.contrib.auth.models import User
from django.urls import reverse
from rest_framework.test import APITestCase

from authentication.models import UserProfile
from education.models import Course, Lesson, LessonSection, Path
from gamification.models import RewardLedgerEntry
from gamification.services.rewards import XP_FIRST_LESSON_EVER_BONUS


class SectionPathLessonCompletionTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="section-path", email="section@example.com", password="pass12345"
        )
        self.profile, _ = UserProfile.objects.get_or_create(user=self.user)
        path = Path.objects.create(title="Budgeting", description="Test path")
        course = Course.objects.create(path=path, title="Budgeting", description="")
        self.lessons = [
            Lesson.objects.create(course=course, title=f"Lesson {n}", detailed_content="Body")
            for n in (1, 2)
        ]
        self.sections = {
            lesson.id: [
                LessonSection.objects.create(lesson=lesson, order=i, title=f"S{i}") for i in (1, 2)
            ]
            for lesson in self.lessons
        }
        self.client.force_authenticate(user=self.user)

    def _complete(self, section):
        return self.client.post(
            reverse("userprogress-complete-section"), {"section_id": section.id}, format="json"
        )

    def _finish_lesson(self, lesson):
        responses = [self._complete(s) for s in self.sections[lesson.id]]
        return responses[-1], responses[:-1]

    def _ledger(self, key):
        return RewardLedgerEntry.objects.filter(user=self.user, event_key=key).count()

    def test_mid_lesson_section_reports_no_lesson_completion(self):
        resp = self._complete(self.sections[self.lessons[0].id][0])

        self.assertEqual(resp.status_code, 200)
        self.assertFalse(resp.data["lesson_completed"])
        self.assertNotIn("is_first_lesson", resp.data)

    def test_last_section_of_first_lesson_runs_first_lesson_bookkeeping(self):
        lesson = self.lessons[0]
        last, _ = self._finish_lesson(lesson)

        self.assertTrue(last.data["lesson_completed"])
        self.assertEqual(last.data["lesson_id"], lesson.id)
        self.assertTrue(last.data["is_first_lesson"])
        self.assertEqual(last.data["first_lesson_bonus_xp"], XP_FIRST_LESSON_EVER_BONUS)
        self.assertIn("missions", last.data)
        self.profile.refresh_from_db()
        self.assertIsNotNone(self.profile.first_lesson_at)
        self.assertEqual(self._ledger(f"first_lesson_ever_bonus:{self.user.id}"), 1)
        self.assertEqual(self._ledger(f"lesson_first_completion:{self.user.id}:{lesson.id}"), 1)

    def test_second_lesson_is_not_flagged_first(self):
        self._finish_lesson(self.lessons[0])
        last, _ = self._finish_lesson(self.lessons[1])

        self.assertTrue(last.data["lesson_completed"])
        self.assertFalse(last.data["is_first_lesson"])
        self.assertIsNone(last.data["first_lesson_bonus_xp"])

    def test_recompleting_a_section_does_not_rerun_lesson_effects(self):
        lesson = self.lessons[0]
        self._finish_lesson(lesson)

        again = self._complete(self.sections[lesson.id][-1])

        self.assertFalse(again.data["lesson_completed"])
        self.assertEqual(self._ledger(f"lesson_first_completion:{self.user.id}:{lesson.id}"), 1)
        self.assertEqual(self._ledger(f"first_lesson_ever_bonus:{self.user.id}"), 1)

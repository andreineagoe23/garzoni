"""
Tests for the practice-to-earn-hearts mechanic: while a user is at 0 hearts,
every HEARTS_PRACTICE_CORRECT_NEEDED correct review-queue answers earns back
1 heart, capped at HEARTS_PRACTICE_DAILY_CAP per day.

Run locally (same env as other Django tests, see backend/tests/test_rewards.py
header) with `python manage.py test tests.test_hearts_practice`.
"""

from django.contrib.auth.models import User
from django.core.cache import cache
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from authentication.services.hearts import (
    hearts_practice_progress,
    record_correct_review_answer_for_hearts,
)
from education.models import Course, Exercise, Path


def _make_due_exercise(skill_title):
    """
    Course + Exercise pair set up so ExerciseViewSet.submit() resolves a fresh,
    due Mastery for this skill: Mastery.due_at defaults to its own creation
    time, so a mastery created for the first time on submit is "due" (matches
    _review_queue_payload's due_at__lte=now filter).
    """
    path = Path.objects.create(title=f"{skill_title} Path", description="")
    course = Course.objects.create(title=skill_title, description="", path=path, is_active=True)
    exercise = Exercise.objects.create(
        type="numeric",
        question=f"What is 2+2? ({skill_title})",
        exercise_data={},
        correct_answer=4,
        category=skill_title,
        is_published=True,
    )
    return course, exercise


class HeartsPracticeServiceTests(APITestCase):
    """
    Exercises authentication.services.hearts.record_correct_review_answer_for_hearts
    directly — the function ExerciseViewSet.submit() calls on every correct
    review-queue answer.
    """

    def setUp(self):
        cache.clear()
        self.user = User.objects.create_user(username="practiceuser", password="test-pass-123!")
        self.profile = self.user.profile
        self.profile.hearts = 0
        self.profile.hearts_last_refill_at = timezone.now()
        self.profile.save(update_fields=["hearts", "hearts_last_refill_at"])

    def test_two_correct_answers_at_zero_hearts_grants_one_heart(self):
        r1 = record_correct_review_answer_for_hearts(self.user)
        self.assertIsNotNone(r1)
        self.assertEqual(r1["correct_so_far"], 1)
        self.assertEqual(r1["granted_today"], 0)
        self.profile.refresh_from_db()
        self.assertEqual(self.profile.hearts, 0)

        r2 = record_correct_review_answer_for_hearts(self.user)
        self.assertIsNotNone(r2)
        self.assertEqual(r2["correct_so_far"], 0)  # counter resets after granting
        self.assertEqual(r2["granted_today"], 1)
        self.profile.refresh_from_db()
        self.assertEqual(self.profile.hearts, 1)

    def test_one_correct_answer_grants_none(self):
        r1 = record_correct_review_answer_for_hearts(self.user)
        self.assertIsNotNone(r1)
        self.assertEqual(r1["correct_so_far"], 1)
        self.assertEqual(r1["granted_today"], 0)
        self.profile.refresh_from_db()
        self.assertEqual(self.profile.hearts, 0)

    def test_correct_answers_while_hearts_nonzero_do_not_count(self):
        self.profile.hearts = 3
        self.profile.save(update_fields=["hearts"])

        result = record_correct_review_answer_for_hearts(self.user)
        self.assertIsNone(result)

        progress = hearts_practice_progress(self.user.id)
        self.assertEqual(progress["correct_so_far"], 0)
        self.profile.refresh_from_db()
        self.assertEqual(self.profile.hearts, 3)

    def test_daily_cap_refuses_third_earned_heart(self):
        # Round 1: earn heart #1.
        record_correct_review_answer_for_hearts(self.user)
        record_correct_review_answer_for_hearts(self.user)
        self.profile.refresh_from_db()
        self.assertEqual(self.profile.hearts, 1)
        self.assertEqual(hearts_practice_progress(self.user.id)["granted_today"], 1)

        # Hearts decrements are client-driven/unverified (out of scope) — simulate
        # the user spending the heart back down to 0 so a second round is possible.
        self.profile.hearts = 0
        self.profile.save(update_fields=["hearts"])

        # Round 2: earn heart #2 (hits the daily cap of 2).
        record_correct_review_answer_for_hearts(self.user)
        record_correct_review_answer_for_hearts(self.user)
        self.profile.refresh_from_db()
        self.assertEqual(self.profile.hearts, 1)
        self.assertEqual(hearts_practice_progress(self.user.id)["granted_today"], 2)

        # Round 3: back to 0 hearts again, but the daily cap must refuse a 3rd grant.
        self.profile.hearts = 0
        self.profile.save(update_fields=["hearts"])
        record_correct_review_answer_for_hearts(self.user)
        record_correct_review_answer_for_hearts(self.user)
        self.profile.refresh_from_db()
        self.assertEqual(self.profile.hearts, 0)
        progress = hearts_practice_progress(self.user.id)
        self.assertEqual(progress["granted_today"], 2)
        self.assertEqual(progress["daily_cap"], 2)


class HeartsPracticeEndpointTests(APITestCase):
    """POST /api/user/hearts/practice/ reports progress without granting anything itself."""

    def setUp(self):
        cache.clear()
        self.user = User.objects.create_user(username="progressuser", password="test-pass-123!")
        self.client.force_authenticate(self.user)
        self.profile = self.user.profile
        self.profile.hearts = 0
        self.profile.hearts_last_refill_at = timezone.now()
        self.profile.save(update_fields=["hearts", "hearts_last_refill_at"])

    def test_reports_accurate_progress(self):
        url = reverse("user-hearts-practice")

        resp = self.client.post(url, {}, format="json")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(
            resp.data,
            {"correct_needed": 2, "correct_so_far": 0, "granted_today": 0, "daily_cap": 2},
        )

        record_correct_review_answer_for_hearts(self.user)
        resp = self.client.post(url, {}, format="json")
        self.assertEqual(resp.data["correct_so_far"], 1)
        self.assertEqual(resp.data["granted_today"], 0)

        record_correct_review_answer_for_hearts(self.user)
        resp = self.client.post(url, {}, format="json")
        self.assertEqual(resp.data["correct_so_far"], 0)
        self.assertEqual(resp.data["granted_today"], 1)

        # Endpoint itself never mutates hearts.
        self.profile.refresh_from_db()
        self.assertEqual(self.profile.hearts, 1)


class ExerciseSubmitHeartsPracticeIntegrationTests(APITestCase):
    """
    Confirms ExerciseViewSet.submit() actually wires into the practice-to-earn
    mechanic for exercises that resolve to a due review-queue Mastery, and that
    incorrect answers never grant or count.
    """

    def setUp(self):
        cache.clear()
        self.user = User.objects.create_user(username="submituser", password="test-pass-123!")
        self.client.force_authenticate(self.user)
        self.profile = self.user.profile
        self.profile.hearts = 0
        self.profile.hearts_last_refill_at = timezone.now()
        self.profile.save(update_fields=["hearts", "hearts_last_refill_at"])

    def _submit(self, exercise, answer):
        url = reverse("exercise-submit", kwargs={"pk": exercise.pk})
        return self.client.post(url, {"user_answer": answer}, format="json")

    def test_incorrect_answer_never_grants_or_counts(self):
        _, exercise = _make_due_exercise("Practice Skill Wrong")

        resp = self._submit(exercise, 999)
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertFalse(resp.data["correct"])

        self.profile.refresh_from_db()
        self.assertEqual(self.profile.hearts, 0)
        self.assertEqual(hearts_practice_progress(self.user.id)["correct_so_far"], 0)

    def test_two_correct_review_answers_via_submit_grants_heart(self):
        _, exercise_a = _make_due_exercise("Practice Skill A")
        _, exercise_b = _make_due_exercise("Practice Skill B")

        resp_a = self._submit(exercise_a, 4)
        self.assertEqual(resp_a.status_code, status.HTTP_200_OK)
        self.assertTrue(resp_a.data["correct"])
        self.profile.refresh_from_db()
        self.assertEqual(self.profile.hearts, 0)
        self.assertEqual(hearts_practice_progress(self.user.id)["correct_so_far"], 1)

        resp_b = self._submit(exercise_b, 4)
        self.assertEqual(resp_b.status_code, status.HTTP_200_OK)
        self.assertTrue(resp_b.data["correct"])
        self.profile.refresh_from_db()
        self.assertEqual(self.profile.hearts, 1)
        self.assertEqual(hearts_practice_progress(self.user.id)["granted_today"], 1)

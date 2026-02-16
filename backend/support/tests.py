"""
Tests for Support (ex-FAQ) API and data integrity.
Ensures the FAQ→Support rename did not break list/vote and that data is preserved.
"""

from django.test import TestCase
from django.contrib.auth.models import User
from rest_framework.test import APIClient
from rest_framework import status

from support.models import SupportEntry, SupportFeedback


class SupportListAndVoteTest(TestCase):
    """Support list returns entries; voting works and updates counts (same data as ex-FAQ)."""

    def setUp(self):
        self.client = APIClient()
        self.entry = SupportEntry.objects.create(
            category="General",
            question="Test question?",
            answer="Test answer.",
            is_active=True,
        )

    def test_support_list_returns_entries(self):
        """GET /api/support/ returns 200 and list of entries (ex-FAQ data)."""
        response = self.client.get("/api/support/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIsInstance(response.data, list)
        self.assertGreaterEqual(len(response.data), 1)
        by_id = {e["id"]: e for e in response.data}
        self.assertIn(self.entry.id, by_id)
        self.assertEqual(by_id[self.entry.id]["question"], self.entry.question)
        self.assertEqual(by_id[self.entry.id]["helpful_count"], 0)
        self.assertEqual(by_id[self.entry.id]["not_helpful_count"], 0)

    def test_support_vote_anonymous_helpful(self):
        """Anonymous POST vote helpful increments helpful_count (data in same table as before)."""
        response = self.client.post(
            f"/api/support/{self.entry.id}/vote/",
            {"vote": "helpful"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.entry.refresh_from_db()
        self.assertEqual(self.entry.helpful_count, 1)
        self.assertEqual(self.entry.not_helpful_count, 0)

    def test_support_vote_anonymous_not_helpful(self):
        """Anonymous POST vote not_helpful increments not_helpful_count."""
        response = self.client.post(
            f"/api/support/{self.entry.id}/vote/",
            {"vote": "not_helpful"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.entry.refresh_from_db()
        self.assertEqual(self.entry.helpful_count, 0)
        self.assertEqual(self.entry.not_helpful_count, 1)

    def test_support_vote_authenticated_creates_feedback(self):
        """Authenticated vote creates SupportFeedback (ex-FAQFeedback) and updates counts."""
        user = User.objects.create_user(username="voter", password="testpass123")
        self.client.force_authenticate(user=user)
        response = self.client.post(
            f"/api/support/{self.entry.id}/vote/",
            {"vote": "helpful"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.entry.refresh_from_db()
        self.assertEqual(self.entry.helpful_count, 1)
        feedback = SupportFeedback.objects.filter(support_entry=self.entry, user=user).first()
        self.assertIsNotNone(feedback)
        self.assertEqual(feedback.vote, "helpful")

"""Tests for the optional `badge` param on notifications.expo_push.send_expo_push."""

from unittest.mock import Mock, patch

from django.test import TestCase

from notifications.expo_push import send_expo_push


class ExpoPushBadgeTests(TestCase):
    @patch("notifications.expo_push.requests.post")
    def test_badge_absent_from_payload_when_not_passed(self, mock_post):
        response = Mock(status_code=200, text="")
        response.json.return_value = {"data": {"status": "ok", "id": "ticket-id"}}
        mock_post.return_value = response

        ok, err = send_expo_push("ExponentPushToken[abc]", "Title", "Body")

        self.assertTrue(ok)
        self.assertIsNone(err)
        payload = mock_post.call_args.kwargs["json"]
        self.assertNotIn("badge", payload)

    @patch("notifications.expo_push.requests.post")
    def test_badge_present_with_correct_value_when_passed(self, mock_post):
        response = Mock(status_code=200, text="")
        response.json.return_value = {"data": {"status": "ok", "id": "ticket-id"}}
        mock_post.return_value = response

        ok, err = send_expo_push("ExponentPushToken[abc]", "Title", "Body", badge=3)

        self.assertTrue(ok)
        self.assertIsNone(err)
        payload = mock_post.call_args.kwargs["json"]
        self.assertEqual(payload.get("badge"), 3)

    @patch("notifications.expo_push.requests.post")
    def test_badge_zero_is_sent_not_treated_as_falsy(self, mock_post):
        """badge=0 (clear the badge) must still be included — only None is omitted."""
        response = Mock(status_code=200, text="")
        response.json.return_value = {"data": {"status": "ok", "id": "ticket-id"}}
        mock_post.return_value = response

        ok, err = send_expo_push("ExponentPushToken[abc]", "Title", "Body", badge=0)

        self.assertTrue(ok)
        self.assertIsNone(err)
        payload = mock_post.call_args.kwargs["json"]
        self.assertIn("badge", payload)
        self.assertEqual(payload.get("badge"), 0)

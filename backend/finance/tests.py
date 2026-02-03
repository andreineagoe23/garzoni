"""Tests for finance views: news feed robustness, provider failure, malformed RSS."""

from unittest.mock import patch
from django.core.cache import cache
from django.test import override_settings
from django.urls import reverse
from rest_framework.test import APITestCase


class NewsFeedViewTest(APITestCase):
    """News feed: provider failure, empty feed, malformed RSS, last-good fallback."""

    def setUp(self):
        cache.clear()

    def tearDown(self):
        cache.clear()

    def test_news_feed_empty_when_all_providers_fail(self):
        """When every RSS provider fails, response has items=[] (or last-good if any)."""
        with patch("finance.views.requests.get") as mock_get:
            mock_get.side_effect = Exception("timeout")
            url = reverse("news-feed")
            response = self.client.get(url)
        self.assertEqual(response.status_code, 200)
        self.assertIn("items", response.data)
        self.assertIn("generated_at", response.data)
        self.assertIsInstance(response.data["items"], list)

    def test_news_feed_serves_last_good_when_all_fail(self):
        """If we had a good cache and then all providers fail, we serve stale."""
        last_good = {
            "items": [
                {
                    "id": "abc",
                    "title": "Test",
                    "url": "https://example.com/1",
                    "source": "Test",
                    "category": "Markets",
                    "what_this_means": "x",
                    "why_it_matters": "y",
                    "who_should_care": "z",
                }
            ],
            "generated_at": "2024-01-01T12:00:00Z",
        }
        cache.set("monevo:news-feed:last-good", last_good, timeout=3600)
        with patch("finance.views.requests.get") as mock_get:
            mock_get.side_effect = Exception("timeout")
            url = reverse("news-feed")
            response = self.client.get(url)
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data.get("stale"))
        self.assertEqual(len(response.data["items"]), 1)
        self.assertEqual(response.data["items"][0]["title"], "Test")

    def test_news_feed_malformed_rss_does_not_crash(self):
        """Malformed XML from a feed does not crash; that feed contributes no items."""
        with patch("finance.views.requests.get") as mock_get:
            mock_get.return_value.text = "not valid xml <<<"
            mock_get.return_value.raise_for_status = lambda: None
            url = reverse("news-feed")
            response = self.client.get(url)
        self.assertEqual(response.status_code, 200)
        self.assertIn("items", response.data)
        self.assertEqual(response.data["items"], [])

    def test_news_feed_empty_feed_ok(self):
        """Empty but valid RSS returns empty items for that source."""
        empty_rss = """<?xml version="1.0"?><rss><channel></channel></rss>"""
        with patch("finance.views.requests.get") as mock_get:
            mock_get.return_value.text = empty_rss
            mock_get.return_value.raise_for_status = lambda: None
            url = reverse("news-feed")
            response = self.client.get(url)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["items"], [])
        self.assertIn("generated_at", response.data)

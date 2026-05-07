"""Tests for finance views: news feed robustness, provider failure, malformed RSS."""

from unittest.mock import patch

from django.core.cache import cache
from django.test import SimpleTestCase
from django.urls import reverse
from finance.views import (
    _parse_crypto_map_param,
    _parse_truthy_query_param,
    _yahoo_extract_price_and_change_pct,
)
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
        cache.set("garzoni:news-feed:last-good", last_good, timeout=3600)
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


class MarketQuoteParsingHelpersTest(SimpleTestCase):
    """Stable parsing for crypto_map / force_refresh query strings."""

    def test_parse_crypto_map_basic(self):
        self.assertEqual(
            _parse_crypto_map_param("BTC:bitcoin,ADA:cardano"),
            {"BTC": "bitcoin", "ADA": "cardano"},
        )

    def test_parse_crypto_map_ignores_bad_segments(self):
        self.assertEqual(
            _parse_crypto_map_param("BTC:bitcoin,garbage,NOSYMBOL"),
            {"BTC": "bitcoin"},
        )

    def test_parse_truthy_param(self):
        self.assertTrue(_parse_truthy_query_param("1"))
        self.assertTrue(_parse_truthy_query_param("true"))
        self.assertTrue(_parse_truthy_query_param("fresh"))
        self.assertFalse(_parse_truthy_query_param("0"))
        self.assertFalse(_parse_truthy_query_param(None))


class YahooFxPriceExtractionTest(SimpleTestCase):
    """Yahoo rows for forex often lack regularMarketPrice."""

    def test_bid_ask_mid_when_spot_missing(self):
        px, _ch = _yahoo_extract_price_and_change_pct(
            {
                "symbol": "EURUSD=X",
                "bid": 1.08,
                "ask": 1.081,
                "regularMarketPreviousClose": 1.07,
            }
        )
        self.assertAlmostEqual(px, 1.0805, places=4)

    def test_derive_change_from_prev_close(self):
        px, ch = _yahoo_extract_price_and_change_pct(
            {
                "regularMarketPrice": 1.09,
                "regularMarketPreviousClose": 1.0,
            }
        )
        self.assertEqual(px, 1.09)
        self.assertAlmostEqual(ch, 9.0, places=5)

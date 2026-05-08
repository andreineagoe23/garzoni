"""Tests for finance views: news feed robustness, provider failure, malformed RSS."""

from datetime import timedelta
from unittest.mock import patch

from django.core.cache import cache
from django.test import SimpleTestCase
from django.urls import reverse
from django.utils import timezone
from finance.serializers import PortfolioEntrySerializer
from finance.views import (
    _parse_crypto_map_param,
    _parse_truthy_query_param,
    _stooq_symbol_for,
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


class StooqSymbolMapTest(SimpleTestCase):
    """Yahoo-style ticker -> Stooq symbol mapping for fallback path."""

    def test_us_equity(self):
        self.assertEqual(_stooq_symbol_for("AAPL"), "aapl.us")
        self.assertEqual(_stooq_symbol_for("tsla"), "tsla.us")

    def test_forex_pair(self):
        self.assertEqual(_stooq_symbol_for("EURUSD=X"), "eurusd")

    def test_skips_unmappable(self):
        # International suffixes / dotted tickers aren't safely mappable.
        self.assertIsNone(_stooq_symbol_for("APC.DE"))
        self.assertIsNone(_stooq_symbol_for("BRK-A"))
        self.assertIsNone(_stooq_symbol_for(""))


class PaperTradePriceResolveTest(SimpleTestCase):
    """Cache-first crypto resolution then force_refresh fallback."""

    def test_crypto_hits_on_first_read(self):
        from unittest.mock import patch

        from finance.views import _paper_trade_resolve_price

        with (
            patch("finance.views._coingecko_bulk_fetch_and_cache") as m_cg,
            patch("finance.views._coingecko_read_cached", return_value={"price": 42.0}),
        ):
            price, kind = _paper_trade_resolve_price("BTC", "bitcoin")
        self.assertEqual(price, 42.0)
        self.assertEqual(kind, "crypto")
        m_cg.assert_called_once_with(["bitcoin"], force_refresh=False)

    def test_crypto_retries_with_force_refresh_when_stale_zero(self):
        from unittest.mock import patch

        from finance.views import _paper_trade_resolve_price

        with (
            patch("finance.views._coingecko_bulk_fetch_and_cache") as m_cg,
            patch(
                "finance.views._coingecko_read_cached",
                side_effect=[
                    {"price": 0.0},
                    {"price": 99.0},
                ],
            ),
        ):
            price, kind = _paper_trade_resolve_price("BTC", "bitcoin")
        self.assertEqual(price, 99.0)
        self.assertEqual(kind, "crypto")
        self.assertEqual(m_cg.call_count, 2)
        from unittest.mock import call

        self.assertEqual(
            m_cg.call_args_list,
            [
                call(["bitcoin"], force_refresh=False),
                call(["bitcoin"], force_refresh=True),
            ],
        )


class PortfolioEntrySerializerValidationTest(SimpleTestCase):
    def test_rejects_future_purchase_date(self):
        future_date = (timezone.now().date() + timedelta(days=1)).isoformat()
        ser = PortfolioEntrySerializer(
            data={
                "asset_type": "stock",
                "symbol": "AAPL",
                "quantity": 2,
                "purchase_price": 150,
                "purchase_date": future_date,
            }
        )
        self.assertFalse(ser.is_valid())
        self.assertIn("purchase_date", ser.errors)

    def test_rejects_zero_purchase_price(self):
        ser = PortfolioEntrySerializer(
            data={
                "asset_type": "stock",
                "symbol": "AAPL",
                "quantity": 2,
                "purchase_price": 0,
                "purchase_date": "2025-01-01",
            }
        )
        self.assertFalse(ser.is_valid())
        self.assertIn("purchase_price", ser.errors)

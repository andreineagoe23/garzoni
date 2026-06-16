"""Tests for finance views: news feed robustness, provider failure, malformed RSS."""

from datetime import timedelta
from unittest.mock import patch

from django.apps import apps
from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.test import (
    SimpleTestCase,
    TransactionTestCase,
    override_settings,
    skipUnlessDBFeature,
)
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


@skipUnlessDBFeature("has_select_for_update")
class UpdatePortfolioPricesTaskTest(TransactionTestCase):
    def test_updates_prices_with_row_lock_inside_transaction(self):
        from finance.models import PortfolioEntry
        from finance.tasks import update_portfolio_prices_task

        user = get_user_model().objects.create_user(username="portfolio-user")
        entry = PortfolioEntry.objects.create(
            user=user,
            asset_type="stock",
            symbol="AAPL",
            quantity=1,
            purchase_price=100,
            purchase_date=timezone.now().date(),
            current_price=100,
            is_paper_trade=False,
        )

        with (
            patch("finance.tasks._yahoo_bulk_fetch_and_cache"),
            patch(
                "finance.tasks._yahoo_read_cached_quote_details",
                return_value={"price": 125.0},
            ),
        ):
            result = update_portfolio_prices_task.run()

        entry.refresh_from_db()
        self.assertEqual(result, "updated=1")
        self.assertEqual(entry.previous_price, 100)
        self.assertEqual(entry.current_price, 125)


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


@override_settings(
    CACHES={
        "default": {
            "BACKEND": "django.core.cache.backends.locmem.LocMemCache",
        }
    }
)
class FunnelAnalyticsTest(APITestCase):
    """Funnel ingest platform tagging + staff-gated metrics split by platform.

    Uses a local-memory cache so DRF throttling works without a live Redis (keeps
    the suite runnable in CI/dev without the broker).
    """

    def setUp(self):
        self.FunnelEvent = apps.get_model("finance", "FunnelEvent")
        self.FunnelEvent.objects.all().delete()
        User = get_user_model()
        self.staff = User.objects.create_user(
            username="staff_funnel",
            email="staff_funnel@example.com",
            password="pw12345!",
            is_staff=True,
        )
        self.member = User.objects.create_user(
            username="member_funnel",
            email="member_funnel@example.com",
            password="pw12345!",
        )

    # --- ingest: platform attribution -------------------------------------

    def test_ingest_tags_platform_from_header(self):
        url = reverse("funnel-events")
        resp = self.client.post(
            url,
            {"event_type": "pricing_view"},
            format="json",
            HTTP_X_GARZONI_PLATFORM="ios",
        )
        self.assertEqual(resp.status_code, 200)
        event = self.FunnelEvent.objects.get(event_type="pricing_view")
        self.assertEqual(event.platform, "ios")

    def test_ingest_falls_back_to_user_agent_when_header_absent(self):
        url = reverse("funnel-events")
        resp = self.client.post(
            url,
            {"event_type": "pricing_view"},
            format="json",
            HTTP_USER_AGENT="Mozilla/5.0 (Macintosh) Chrome/120 Safari/537",
        )
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(self.FunnelEvent.objects.latest("created_at").platform, "web")

    def test_ingest_unknown_platform_left_empty(self):
        url = reverse("funnel-events")
        resp = self.client.post(
            url,
            {"event_type": "pricing_view"},
            format="json",
            HTTP_X_GARZONI_PLATFORM="windows-phone",
            HTTP_USER_AGENT="curl/8.0",
        )
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(self.FunnelEvent.objects.latest("created_at").platform, "")

    # --- metrics: gate + split --------------------------------------------

    def test_metrics_forbidden_for_non_staff(self):
        self.client.force_authenticate(user=self.member)
        resp = self.client.get(reverse("funnel-metrics"))
        self.assertEqual(resp.status_code, 403)

    def test_metrics_requires_authentication(self):
        resp = self.client.get(reverse("funnel-metrics"))
        self.assertIn(resp.status_code, (401, 403))

    def test_metrics_splits_by_platform(self):
        # 2 web pricing views + 1 checkout; 1 ios pricing view.
        self.FunnelEvent.objects.create(event_type="pricing_view", platform="web")
        self.FunnelEvent.objects.create(event_type="pricing_view", platform="web")
        self.FunnelEvent.objects.create(event_type="checkout_created", platform="web")
        self.FunnelEvent.objects.create(event_type="pricing_view", platform="ios")

        self.client.force_authenticate(user=self.staff)
        resp = self.client.get(reverse("funnel-metrics"))
        self.assertEqual(resp.status_code, 200)

        self.assertEqual(resp.data["summary"]["pricing_views"], 3)
        by_platform = resp.data["by_platform"]
        self.assertEqual(by_platform["web"]["pricing_views"], 2)
        self.assertEqual(by_platform["web"]["checkouts_created"], 1)
        self.assertEqual(by_platform["ios"]["pricing_views"], 1)
        self.assertNotIn("android", by_platform)

    def test_metrics_buckets_empty_platform_as_unknown(self):
        self.FunnelEvent.objects.create(event_type="checkout_completed", platform="")
        self.client.force_authenticate(user=self.staff)
        resp = self.client.get(reverse("funnel-metrics"))
        self.assertEqual(resp.status_code, 200)
        self.assertIn("unknown", resp.data["by_platform"])

    def test_metrics_handles_bad_days_param(self):
        self.client.force_authenticate(user=self.staff)
        resp = self.client.get(reverse("funnel-metrics"), {"days": "not-a-number"})
        self.assertEqual(resp.status_code, 200)

    # --- platform filter + engagement + revenue (rich analytics) ----------

    def test_metrics_platform_filter_mobile_combines_ios_android(self):
        FE = self.FunnelEvent
        FE.objects.create(event_type="pricing_view", platform="ios")
        FE.objects.create(event_type="pricing_view", platform="android")
        FE.objects.create(event_type="pricing_view", platform="web")
        self.client.force_authenticate(user=self.staff)
        resp = self.client.get(reverse("funnel-metrics"), {"platform": "mobile"})
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data["platform"], "mobile")
        # ios + android counted, web excluded
        self.assertEqual(resp.data["summary"]["pricing_views"], 2)

    def test_metrics_platform_filter_web_only(self):
        FE = self.FunnelEvent
        FE.objects.create(event_type="pricing_view", platform="ios")
        FE.objects.create(event_type="pricing_view", platform="web")
        self.client.force_authenticate(user=self.staff)
        resp = self.client.get(reverse("funnel-metrics"), {"platform": "web"})
        self.assertEqual(resp.data["summary"]["pricing_views"], 1)

    def test_metrics_active_users_counts_distinct_signed_in(self):
        FE = self.FunnelEvent
        # member fires two events (still 1 active user), staff fires one, plus an
        # anonymous (user=None) event that must NOT count.
        FE.objects.create(event_type="dashboard_view", platform="web", user=self.member)
        FE.objects.create(event_type="cta_click", platform="web", user=self.member)
        FE.objects.create(event_type="dashboard_view", platform="web", user=self.staff)
        FE.objects.create(event_type="dashboard_view", platform="web", user=None)
        self.client.force_authenticate(user=self.staff)
        resp = self.client.get(reverse("funnel-metrics"))
        self.assertEqual(resp.data["active_users"]["last_7d"], 2)
        self.assertEqual(resp.data["totals"]["signed_in_users"], 2)

    def test_metrics_top_clicks_and_features(self):
        FE = self.FunnelEvent
        FE.objects.create(event_type="cta_click", platform="web", user=self.member)
        FE.objects.create(event_type="cta_click", platform="web", user=self.member)
        FE.objects.create(event_type="tool_open", platform="web", user=self.member)
        self.client.force_authenticate(user=self.staff)
        resp = self.client.get(reverse("funnel-metrics"))
        clicks = {r["event_type"]: r["count"] for r in resp.data["top_clicks"]}
        features = {r["event_type"]: r["count"] for r in resp.data["top_features"]}
        self.assertEqual(clicks.get("cta_click"), 2)
        self.assertEqual(features.get("tool_open"), 1)

    def test_metrics_revenue_from_stripe_payments(self):
        StripePayment = apps.get_model("finance", "StripePayment")
        StripePayment.objects.create(
            user=self.member,
            stripe_payment_id="pi_test_1",
            amount="9.99",
            currency="GBP",
        )
        StripePayment.objects.create(
            user=self.staff,
            stripe_payment_id="pi_test_2",
            amount="5.00",
            currency="GBP",
        )
        self.client.force_authenticate(user=self.staff)
        resp = self.client.get(reverse("funnel-metrics"))
        self.assertEqual(resp.data["revenue"]["payments"], 2)
        gbp = next(r for r in resp.data["revenue"]["by_currency"] if r["currency"] == "GBP")
        self.assertAlmostEqual(gbp["total"], 14.99, places=2)

    # --- real user-table metrics (signups ground truth) -------------------

    def test_metrics_includes_real_user_counts(self):
        # setUp already created 2 users (staff + member); both joined "now".
        self.client.force_authenticate(user=self.staff)
        resp = self.client.get(reverse("funnel-metrics"))
        self.assertEqual(resp.status_code, 200)
        users = resp.data["users"]
        self.assertGreaterEqual(users["total"], 2)
        self.assertGreaterEqual(users["new_last_7d"], 2)
        self.assertIn("new_by_platform", users)

    def test_metrics_new_signups_split_by_platform(self):
        self.member.profile.signup_platform = "web"
        self.member.profile.save(update_fields=["signup_platform"])
        self.staff.profile.signup_platform = "ios"
        self.staff.profile.save(update_fields=["signup_platform"])
        self.client.force_authenticate(user=self.staff)

        web = self.client.get(reverse("funnel-metrics"), {"platform": "web"})
        self.assertEqual(web.data["users"]["new_in_range"], 1)
        mobile = self.client.get(reverse("funnel-metrics"), {"platform": "mobile"})
        self.assertEqual(mobile.data["users"]["new_in_range"], 1)

    def test_resolve_request_platform_helper(self):
        from core.request_platform import resolve_request_platform

        class _Req:
            def __init__(self, meta):
                self.META = meta

        self.assertEqual(
            resolve_request_platform(_Req({"HTTP_X_GARZONI_PLATFORM": "android"})),
            "android",
        )
        self.assertEqual(
            resolve_request_platform(
                _Req({"HTTP_USER_AGENT": "Mozilla/5.0 Chrome/120 Safari/537"})
            ),
            "web",
        )
        self.assertEqual(
            resolve_request_platform(_Req({"HTTP_USER_AGENT": "Garzoni/1 CFNetwork"})),
            "ios",
        )
        self.assertEqual(resolve_request_platform(_Req({})), "")

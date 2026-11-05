"""
Tests for Support (ex-FAQ) API and data integrity.
Ensures the FAQ→Support rename did not break list/vote and that data is preserved.
"""

from unittest.mock import Mock, patch

import requests
from django.conf import settings
from django.contrib.auth.models import User
from django.core.cache import cache
from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient

from finance.views import NEWS_LAST_GOOD_CACHE_KEY
from support.models import SupportEntry, SupportFeedback
from support.services.openai import OpenAIService, _completion_params
from support.services.tools import dispatch_tool


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


class TutorMarketToolsTest(TestCase):
    """The tutor's live-data tools fail softly and never hit the network with a bad symbol."""

    def setUp(self):
        cache.clear()

    def _chart(self):
        # 2026-11-03/04/05 14:30 UTC, New York is UTC-5 in November.
        timestamps = [1793716200, 1793802600, 1793889000]
        return {
            "chart": {
                "result": [
                    {
                        "meta": {
                            "symbol": "^GSPC",
                            "longName": "S&P 500",
                            "currency": "USD",
                            "gmtoffset": -18000,
                            "regularMarketPrice": 7688.62,
                            "regularMarketTime": 1793889000,
                        },
                        "timestamp": timestamps,
                        "indicators": {"quote": [{"close": [100.0, None, 110.0]}]},
                    }
                ]
            }
        }

    @patch("finance.services.market_history.requests.get")
    def test_returns_recent_closes_and_skips_missing_bars(self, mock_get):
        mock_get.return_value = Mock(status_code=200, json=self._chart)
        result = dispatch_tool("get_market_data", {"symbol": "^gspc", "days": 3}, None)
        self.assertEqual(result["latest_price"], 7688.62)
        self.assertEqual(result["currency"], "USD")
        self.assertEqual([row["close"] for row in result["daily_closes"]], [100.0, 110.0])
        self.assertEqual(result["change_pct_over_period"], 10.0)
        self.assertIn("%5EGSPC", mock_get.call_args.args[0])

    @patch("finance.services.market_history.requests.get")
    def test_days_limit_keeps_the_newest_closes(self, mock_get):
        mock_get.return_value = Mock(status_code=200, json=self._chart)
        result = dispatch_tool("get_market_data", {"symbol": "^GSPC", "days": 1}, None)
        self.assertEqual([row["close"] for row in result["daily_closes"]], [110.0])

    @patch("finance.services.market_history.requests.get")
    def test_rejects_symbols_that_could_alter_the_url(self, mock_get):
        for symbol in ["", "../../etc/passwd", "AAPL?x=1", "A B", "a" * 30]:
            self.assertIn("error", dispatch_tool("get_market_data", {"symbol": symbol}, None))
        mock_get.assert_not_called()

    @patch("finance.services.market_history.requests.get")
    def test_provider_failure_returns_an_error_not_an_exception(self, mock_get):
        mock_get.side_effect = requests.ConnectionError("blocked")
        result = dispatch_tool("get_market_data", {"symbol": "AAPL"}, None)
        self.assertEqual(result, {"error": "Market data is temporarily unavailable."})

    @patch("finance.services.market_history.requests.get")
    def test_unknown_symbol_is_reported(self, mock_get):
        mock_get.return_value = Mock(status_code=404)
        result = dispatch_tool("get_market_data", {"symbol": "NOPE"}, None)
        self.assertIn("No market data", result["error"])

    def test_news_reads_the_cache_and_falls_back_to_last_good(self):
        self.assertIn("error", dispatch_tool("get_market_news", {}, None))
        cache.set(
            NEWS_LAST_GOOD_CACHE_KEY,
            {"generated_at": "t", "items": [{"title": "Stocks rise", "source": "Guardian"}]},
        )
        result = dispatch_tool("get_market_news", {}, None)
        self.assertEqual(result["headlines"][0]["title"], "Stocks rise")


class TutorCompletionRequestTest(TestCase):
    """The tutor's request matches what its model accepts, and knows today's date."""

    def test_gpt6_turns_reasoning_off_for_function_calling(self):
        params = _completion_params("gpt-6.1-terra", 0.5)
        self.assertEqual(params["reasoning_effort"], "none")
        self.assertNotIn("max_tokens", params)

    def test_older_models_do_not_get_reasoning_effort(self):
        self.assertNotIn("reasoning_effort", _completion_params("gpt-4.1-mini", 0.5))

    @patch("support.services.openai._get_openai_client")
    def test_tutor_prompt_has_the_date_and_market_tools(self, mock_client):
        user = User.objects.create_user("tutor-user", "tutor@example.com", "pw-for-test-1")
        reply = Mock(finish_reason="stop", message=Mock(content="Hi there", tool_calls=None))
        create = mock_client.return_value.chat.completions.create
        create.return_value = Mock(choices=[reply], usage=None)
        request = Mock(user=user, data={"inputs": "what did the sp500 do?"}, headers={})

        service = OpenAIService(request, check_and_consume_entitlement=lambda *_: (True, {}))
        payload, status_code = service.handle()

        self.assertEqual(status_code, 200)
        self.assertEqual(payload["response"], "Hi there")
        kwargs = create.call_args.kwargs
        self.assertEqual(kwargs["model"], settings.OPENAI_MODEL_TUTOR)
        self.assertIn("Current date and time:", kwargs["messages"][0]["content"])
        tool_names = {tool["function"]["name"] for tool in kwargs["tools"]}
        self.assertLessEqual({"get_market_data", "get_market_news"}, tool_names)

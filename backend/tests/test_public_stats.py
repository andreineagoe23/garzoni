from datetime import timedelta
from unittest.mock import MagicMock, patch

import requests
from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.test import TestCase
from django.utils import timezone

from authentication.models import UserProfile
from core.services.public_stats import COUNTS_CACHE_KEY, RATING_CACHE_KEY


def _lookup(average, count):
    resp = MagicMock()
    resp.json.return_value = {"results": [{"averageUserRating": average, "userRatingCount": count}]}
    return resp


@patch("core.services.public_stats.get_shared_session")
class PublicStatsTests(TestCase):
    def setUp(self):
        cache.delete_many([COUNTS_CACHE_KEY, RATING_CACHE_KEY])
        self.addCleanup(cache.delete_many, [COUNTS_CACHE_KEY, RATING_CACHE_KEY])

    def _learner(self, username, streak=0, last_completed=None, **extra):
        user = get_user_model().objects.create_user(username=username, **extra)
        UserProfile.objects.filter(user=user).update(
            streak=streak, last_completed_date=last_completed
        )
        return user

    def test_counts_active_learners_and_live_streaks(self, session):
        session.return_value.get.return_value = _lookup(5, 4)
        today = timezone.localdate()
        self._learner("on-streak", streak=3, last_completed=today)
        self._learner("no-streak")
        # A streak the nightly reset missed: stale date, so it is not live.
        self._learner("stale", streak=4, last_completed=today - timedelta(days=5))
        self._learner("staff", streak=2, last_completed=today, is_staff=True)
        self._learner("gone", streak=2, last_completed=today, is_active=False)

        body = self.client.get("/api/public/stats/").json()

        self.assertEqual(body["learners"], 3)
        self.assertEqual(body["on_streak"], 1)
        self.assertEqual(body["app_store_rating"], {"average": 5.0, "count": 4})

    def test_unreachable_app_store_hides_the_rating_and_is_not_retried(self, session):
        session.return_value.get.side_effect = requests.ConnectionError("down")

        first = self.client.get("/api/public/stats/").json()
        cache.delete(COUNTS_CACHE_KEY)
        self.client.get("/api/public/stats/")

        self.assertIsNone(first["app_store_rating"])
        self.assertEqual(session.return_value.get.call_count, 1)

    def test_response_is_cacheable_json_with_no_cookie(self, session):
        session.return_value.get.return_value = _lookup(5, 4)

        res = self.client.get(
            "/api/public/stats/",
            HTTP_ACCEPT="text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        )

        self.assertEqual(res.status_code, 200)
        self.assertEqual(res["Content-Type"], "application/json")
        self.assertIn("public", res["Cache-Control"])
        self.assertNotIn("Set-Cookie", res)

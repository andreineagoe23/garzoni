from unittest.mock import MagicMock, patch

import httpx
from django.contrib.auth.models import User
from django.core.cache import cache
from django.test import TestCase
from openai import RateLimitError
from rest_framework.test import APIClient

from support.views_smart_resume import _QUOTA_FAIL_KEY


def _quota_error():
    request = httpx.Request("POST", "https://api.openai.com/v1/chat/completions")
    response = httpx.Response(429, request=request)
    return RateLimitError("quota", response=response, body={"code": "insufficient_quota"})


class SmartResumeQuotaTest(TestCase):
    """An empty OpenAI balance is account-wide: one refusal parks smart resume for everyone."""

    def setUp(self):
        self.client = APIClient()
        cache.delete(_QUOTA_FAIL_KEY)
        self.addCleanup(cache.delete, _QUOTA_FAIL_KEY)

    def _get_as(self, username):
        user = User.objects.create_user(username=username)
        for suffix in ("", ":failed"):
            self.addCleanup(cache.delete, f"smart_resume:{user.id}:en{suffix}")
        self.client.force_authenticate(user=user)
        return self.client.get("/api/smart-resume/")

    def test_exhausted_balance_parks_every_user_after_one_call(self):
        client = MagicMock()
        create = client.with_options.return_value.chat.completions.create
        create.side_effect = _quota_error()
        with (
            patch("support.services.openai._get_openai_client", return_value=client),
            patch("support.services.tools._get_user_progress", return_value={}),
            patch("support.services.tools._get_weak_skills", return_value={}),
        ):
            first = self._get_as("first")
            second = self._get_as("second")

        self.assertIsNone(first.data["action"])
        self.assertIsNone(second.data["action"])
        self.assertEqual(create.call_count, 1)

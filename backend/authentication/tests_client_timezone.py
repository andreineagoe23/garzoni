"""Device time zone captured from ``X-Garzoni-Timezone`` on the profile fetch (audit 0.3)."""

from django.contrib.auth.models import User
from django.urls import reverse
from rest_framework.test import APITestCase

from authentication.models import UserProfile
from authentication.services.client_timezone import normalize_timezone


class ClientTimezoneTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="tz-user", email="tz@example.com", password="pass12345"
        )
        self.profile, _ = UserProfile.objects.get_or_create(user=self.user)
        self.client.force_authenticate(user=self.user)

    def _fetch(self, tz=None):
        headers = {"HTTP_X_GARZONI_TIMEZONE": tz} if tz is not None else {}
        return self.client.get(reverse("userprofile"), **headers)

    def test_profile_fetch_stores_device_timezone(self):
        resp = self._fetch("America/New_York")

        self.assertEqual(resp.status_code, 200)
        self.profile.refresh_from_db()
        self.assertEqual(self.profile.timezone_name, "America/New_York")

    def test_invalid_or_missing_header_keeps_existing_zone(self):
        self.profile.timezone_name = "Europe/Bucharest"
        self.profile.save(update_fields=["timezone_name"])

        for value in (None, "", "Mars/Olympus", "../../etc/passwd"):
            self.assertEqual(self._fetch(value).status_code, 200)

        self.profile.refresh_from_db()
        self.assertEqual(self.profile.timezone_name, "Europe/Bucharest")

    def test_normalize_timezone(self):
        self.assertEqual(normalize_timezone(" Europe/London "), "Europe/London")
        self.assertEqual(normalize_timezone("Not/AZone"), "")
        self.assertEqual(normalize_timezone(None), "")

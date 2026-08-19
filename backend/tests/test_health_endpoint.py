"""The deploy gate depends on /health/ answering 200 over plain HTTP.

Railway probes the container directly on the internal network without
X-Forwarded-Proto. With SECURE_SSL_REDIRECT on and no exemption, Django answered
301 and every deploy failed the healthcheck after the full timeout while the app
was healthy. These tests pin the behaviour the gate relies on.
"""

from django.test import TestCase, override_settings


@override_settings(SECURE_SSL_REDIRECT=True, SECURE_REDIRECT_EXEMPT=[r"^health/$"])
class HealthEndpointTests(TestCase):
    def test_plain_http_probe_is_not_redirected(self):
        """The exact shape of Railway's probe: plain HTTP, no proxy header."""
        res = self.client.get("/health/", secure=False)

        self.assertEqual(res.status_code, 200, "a 3xx here fails the Railway deploy gate")
        self.assertEqual(res.json()["status"], "ok")

    def test_reports_each_dependency(self):
        res = self.client.get("/health/", secure=False)

        checks = res.json()["checks"]
        self.assertEqual(checks["db"], "ok")
        self.assertEqual(checks["cache"], "ok")
        # Broker is warn-only by design: a broker outage must not gate readiness.
        self.assertIn(checks["celery_broker"], {"ok", "warn"})

    def test_https_probe_also_works(self):
        res = self.client.get("/health/", secure=True)
        self.assertEqual(res.status_code, 200)


@override_settings(SECURE_SSL_REDIRECT=True, SECURE_REDIRECT_EXEMPT=[])
class HealthEndpointWithoutExemptionTests(TestCase):
    def test_without_the_exemption_the_probe_is_redirected(self):
        """Documents the regression: this 301 is what broke every deploy."""
        res = self.client.get("/health/", secure=False)

        self.assertEqual(res.status_code, 301)
        self.assertTrue(res["Location"].startswith("https://"))

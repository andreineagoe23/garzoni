import base64
import json

from django.test import TestCase, override_settings

from authentication.views_google_oauth import (
    _parse_google_oauth_state,
    _resolve_post_google_frontend_url,
    _safe_return_origin,
)


class GoogleOAuthReturnOriginTests(TestCase):
    def test_parse_legacy_state(self):
        self.assertEqual(_parse_google_oauth_state("all-topics"), ("all-topics", None))

    def test_parse_v1_state(self):
        payload = {"next": "all-topics", "origin": "http://localhost:3000"}
        b64 = base64.urlsafe_b64encode(json.dumps(payload).encode()).decode().rstrip("=")
        raw = f"v1.{b64}"
        next_p, origin = _parse_google_oauth_state(raw)
        self.assertEqual(next_p, "all-topics")
        self.assertEqual(origin, "http://localhost:3000")

    @override_settings(DEBUG=True, FRONTEND_URL="https://www.garzoni.app")
    def test_loopback_allowed_when_debug(self):
        self.assertEqual(
            _safe_return_origin("http://localhost:3000"),
            "http://localhost:3000",
        )

    @override_settings(DEBUG=False, FRONTEND_URL="https://www.garzoni.app", CORS_ALLOWED_ORIGINS=[])
    def test_loopback_allowed_when_not_debug(self):
        """Hosted API + local Vite: return target must still be localhost."""
        self.assertEqual(
            _safe_return_origin("http://localhost:3000"),
            "http://localhost:3000",
        )

    @override_settings(
        DEBUG=False,
        FRONTEND_URL="https://www.garzoni.app",
        CORS_ALLOWED_ORIGINS=("https://staging.example.com",),
    )
    def test_cors_origin_allowed(self):
        self.assertEqual(
            _safe_return_origin("https://staging.example.com"),
            "https://staging.example.com",
        )

    @override_settings(DEBUG=True, FRONTEND_URL="https://www.garzoni.app")
    def test_resolve_prefers_embedded_localhost_over_configured_prod(self):
        payload = {"next": "all-topics", "origin": "http://localhost:3000"}
        b64 = base64.urlsafe_b64encode(json.dumps(payload).encode()).decode().rstrip("=")
        _, origin = _parse_google_oauth_state(f"v1.{b64}")
        resolved = _resolve_post_google_frontend_url(origin)
        self.assertEqual(resolved, "http://localhost:3000")

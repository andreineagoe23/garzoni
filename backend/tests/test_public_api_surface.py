"""Pins the anonymous-reachable API surface.

Two things are being held in place here, both found by the 2026-08-19 audit:

1. /api/public/* is cached at the Cloudflare edge (zone garzoni.app, rule
   fe811b06). The edge cache key does NOT include Accept, Cookie or
   Authorization, and Cloudflare does not honour `Vary: Accept`. So any way of
   making one of those four endpoints return a *different* body for the same URL
   is a way to serve one caller's response to every other caller. DRF's default
   renderer list included BrowsableAPIRenderer, which did exactly that on
   `Accept: text/html` — a 38 KB HTML page plus a `Set-Cookie: csrftoken`.
   Only the Set-Cookie kept Cloudflare from storing it (observed: BYPASS).
   That is an accident, not a control, so the renderer is gone entirely.

2. /api/schema/ and /api/docs/ served a complete 157 KB map of every endpoint to
   anonymous callers. Staff-only now.
"""

from django.contrib.auth import get_user_model
from django.test import TestCase

from education.models import Course, Lesson, Path


class PublicApiRendererTests(TestCase):
    """The cached prefix must return exactly one representation per URL."""

    @classmethod
    def setUpTestData(cls):
        path = Path.objects.create(title="Basic Finance", description="d")
        course = Course.objects.create(path=path, title="Budgeting", description="d")
        cls.lesson = Lesson.objects.create(
            course=course,
            title="Emergency funds",
            slug="emergency-funds",
            short_description="s",
            detailed_content="<p>body</p>",
            is_public=True,
        )

    def test_html_accept_never_yields_an_html_body(self):
        """The cache-poisoning vector: same URL, attacker-chosen Accept.

        406 is the expected answer now — with no HTML renderer left there is no
        representation to negotiate down to. Either way the property under test is
        the same: this URL must never answer with text/html.
        """
        res = self.client.get("/api/public/lessons/", HTTP_ACCEPT="text/html")

        self.assertEqual(res.status_code, 406)
        self.assertNotIn(
            "text/html",
            res["Content-Type"],
            "an HTML variant here can be stored under the JSON edge cache key",
        )

    def test_a_real_browser_accept_header_still_gets_json(self):
        """Googlebot and the prerenderer send text/html first but */* last.

        The 406 above must not extend to them, or the SEO reads that justify the
        edge cache start failing.
        """
        res = self.client.get(
            "/api/public/lessons/",
            HTTP_ACCEPT="text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        )

        self.assertEqual(res.status_code, 200)
        self.assertEqual(res["Content-Type"], "application/json")

    def test_html_accept_does_not_issue_a_cookie(self):
        """A Set-Cookie on a cached path is a shared-token bug waiting to happen."""
        res = self.client.get("/api/public/lessons/", HTTP_ACCEPT="text/html")

        self.assertNotIn("Set-Cookie", res)

    def test_format_query_param_does_not_change_the_representation(self):
        """?format=api is the other route to the browsable renderer."""
        res = self.client.get("/api/public/lessons/", {"format": "api"})

        self.assertIn(res.status_code, {200, 404})
        if res.status_code == 200:
            self.assertEqual(res["Content-Type"], "application/json")

    def test_response_does_not_vary_with_an_authenticated_caller(self):
        """Nothing under the cached prefix may read request.user.

        Uses a real bearer token, not force_login: JWT is the only authenticator
        in DEFAULT_AUTHENTICATION_CLASSES, so a session cookie would leave
        request.user anonymous and the test would pass without proving anything.
        """
        from rest_framework_simplejwt.tokens import RefreshToken

        User = get_user_model()
        user = User.objects.create_user(username="a", email="a@x.io", password="pw123456")
        access = str(RefreshToken.for_user(user).access_token)

        anon = self.client.get("/api/public/lessons/").json()
        authed = self.client.get(
            "/api/public/lessons/", HTTP_AUTHORIZATION=f"Bearer {access}"
        ).json()

        self.assertEqual(anon, authed, "a user-varying body under /api/public/* leaks at the edge")

    def test_private_lessons_are_not_listed(self):
        Lesson.objects.filter(pk=self.lesson.pk).update(is_public=False)

        body = self.client.get("/api/public/lessons/").json()

        self.assertEqual(body["count"], 0)


class SchemaExposureTests(TestCase):
    """The API map is staff-only unless deliberately reopened."""

    def test_schema_is_not_anonymous(self):
        res = self.client.get("/api/schema/")

        self.assertIn(res.status_code, {401, 403})

    def test_docs_are_not_anonymous(self):
        res = self.client.get("/api/docs/")

        self.assertIn(res.status_code, {401, 403})

    def test_staff_can_still_read_the_schema(self):
        User = get_user_model()
        staff = User.objects.create_user(
            username="staff", email="s@x.io", password="pw123456", is_staff=True
        )
        self.client.force_login(staff)

        res = self.client.get("/api/schema/")

        self.assertEqual(res.status_code, 200)


class CachedMediaUrlTests(TestCase):
    """Cached bodies must not be built from request headers.

    `USE_X_FORWARDED_HOST` is on, so `request.build_absolute_uri` follows the
    caller's `X-Forwarded-Host`. ALLOWED_HOSTS limits that to a known host, so it
    is not an open redirect — but on an edge-cached response it would still let
    one caller choose the host baked into every later caller's copy.
    """

    @classmethod
    def setUpTestData(cls):
        path = Path.objects.create(title="P", description="d")
        course = Course.objects.create(path=path, title="C", description="d")
        cls.lesson = Lesson.objects.create(
            course=course,
            title="With an image",
            slug="with-an-image",
            short_description="s",
            detailed_content="<p>b</p>",
            is_public=True,
        )
        cls.lesson.image.name = "lesson_images/cover.png"
        cls.lesson.save(update_fields=["image"])

    def test_image_url_ignores_x_forwarded_host(self):
        clean = self.client.get(f"/api/public/lessons/{self.lesson.slug}/").json()
        spoofed = self.client.get(
            f"/api/public/lessons/{self.lesson.slug}/",
            HTTP_X_FORWARDED_HOST="api.garzoni.app",
        ).json()

        self.assertEqual(clean["image_url"], spoofed["image_url"])
        self.assertNotIn("api.garzoni.app", spoofed["image_url"])

    def test_image_url_is_still_absolute(self):
        body = self.client.get(f"/api/public/lessons/{self.lesson.slug}/").json()

        self.assertTrue(
            body["image_url"].startswith("http://") or body["image_url"].startswith("https://"),
            f"clients need an absolute URL, got {body['image_url']!r}",
        )

    def test_list_and_detail_agree(self):
        detail = self.client.get(f"/api/public/lessons/{self.lesson.slug}/").json()
        listed = next(
            r
            for r in self.client.get("/api/public/lessons/").json()["results"]
            if r["slug"] == self.lesson.slug
        )

        self.assertEqual(detail["image_url"], listed["image_url"])

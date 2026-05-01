# core/views.py
"""Minimal views for root and robots.txt to reduce 404 log noise from crawlers and health checks."""

import json
import logging

from django.conf import settings
from django.http import HttpResponse, JsonResponse
from django.views.static import serve as static_serve

logger = logging.getLogger(__name__)


def root_view(request):
    """Return a short 200 response for / so health checks and bots don't log 404."""
    return HttpResponse("OK", content_type="text/plain")


def health_view(request):
    """Readiness probe — checks DB, cache (Redis), and Celery broker reachability.

    Returns 200 with a JSON status object when all dependencies are healthy,
    503 if any dependency is degraded so load-balancers can pull the instance.
    """
    checks = {}
    ok = True

    # Database
    try:
        from django.db import connection

        connection.ensure_connection()
        checks["db"] = "ok"
    except Exception as exc:
        logger.error("health_check.db_failed: %s", exc)
        checks["db"] = "error"
        ok = False

    # Cache (Redis)
    try:
        from django.core.cache import cache

        cache.set("_health_probe", "1", timeout=5)
        assert cache.get("_health_probe") == "1"
        cache.delete("_health_probe")
        checks["cache"] = "ok"
    except Exception as exc:
        logger.error("health_check.cache_failed: %s", exc)
        checks["cache"] = "error"
        ok = False

    # Celery broker (optional — warn but don't fail readiness)
    try:
        from celery import current_app

        conn = current_app.connection_for_read()
        conn.ensure_connection(max_retries=1, timeout=2)
        conn.close()
        checks["celery_broker"] = "ok"
    except Exception as exc:
        logger.warning("health_check.celery_broker_failed: %s", exc)
        checks["celery_broker"] = "warn"

    payload = {"status": "ok" if ok else "degraded", "checks": checks}
    return JsonResponse(payload, status=200 if ok else 503)


def robots_txt_view(request):
    """Serve robots.txt so crawlers get 200 instead of 404. API is not for indexing."""
    body = "User-agent: *\nDisallow: /\n"
    return HttpResponse(body, content_type="text/plain")


def apple_app_site_association(request):
    """
    Serve the Apple App Site Association (AASA) file for Universal Links.

    This allows iOS to open password-reset emails and other links directly in
    the Garzoni app instead of Safari.

    Required configuration:
    - Replace APPLE_TEAM_ID in APPLE_TEAM_ID setting (e.g. "AB12CD34EF").
      Find it at: https://developer.apple.com/account → Membership Details.
    - Add APPLE_TEAM_ID to backend/.env.
    - Add 'com.apple.developer.associated-domains' to the iOS entitlements
      with value 'applinks:garzoni.app' (done in Garzoni.entitlements).
    - Deploy this backend to garzoni.app so Apple can fetch this file.
    """
    team_id = getattr(settings, "APPLE_TEAM_ID", "TEAMID").strip()
    bundle_id = "app.garzoni.mobile"
    app_id = f"{team_id}.{bundle_id}"

    aasa = {
        "applinks": {
            "apps": [],
            "details": [
                {
                    "appIDs": [app_id],
                    "components": [
                        # Password reset deep links
                        {"/": "/password-reset/*", "comment": "Password reset"},
                    ],
                }
            ],
        }
    }
    return JsonResponse(aasa, content_type="application/json")


def serve_mascot_media(request, path):
    """Serve mascot assets with Cache-Control so browsers revalidate when files are replaced."""
    response = static_serve(request, path, document_root=settings.MEDIA_ROOT / "mascots")
    response["Cache-Control"] = "no-store"
    return response

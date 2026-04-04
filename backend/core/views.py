# core/views.py
"""Minimal views for root and robots.txt to reduce 404 log noise from crawlers and health checks."""

import json

from django.conf import settings
from django.http import HttpResponse, JsonResponse
from django.views.static import serve as static_serve


def root_view(request):
    """Return a short 200 response for / so health checks and bots don't log 404."""
    return HttpResponse("OK", content_type="text/plain")


def robots_txt_view(request):
    """Serve robots.txt so crawlers get 200 instead of 404. API is not for indexing."""
    body = "User-agent: *\nDisallow: /\n"
    return HttpResponse(body, content_type="text/plain")


def apple_app_site_association(request):
    """
    Serve the Apple App Site Association (AASA) file for Universal Links.

    This allows iOS to open password-reset emails and other links directly in
    the Monevo app instead of Safari.

    Required configuration:
    - Replace APPLE_TEAM_ID in APPLE_TEAM_ID setting (e.g. "AB12CD34EF").
      Find it at: https://developer.apple.com/account → Membership Details.
    - Add APPLE_TEAM_ID to backend/.env.
    - Add 'com.apple.developer.associated-domains' to the iOS entitlements
      with value 'applinks:monevo.tech' (done in Monevo.entitlements).
    - Deploy this backend to monevo.tech so Apple can fetch this file.
    """
    team_id = getattr(settings, "APPLE_TEAM_ID", "TEAMID").strip()
    bundle_id = "tech.monevo.app"
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

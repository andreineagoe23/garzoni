# core/views.py
"""Minimal views for root and robots.txt to reduce 404 log noise from crawlers and health checks."""

from django.conf import settings
from django.http import HttpResponse
from django.views.static import serve as static_serve


def root_view(request):
    """Return a short 200 response for / so health checks and bots don't log 404."""
    return HttpResponse("OK", content_type="text/plain")


def robots_txt_view(request):
    """Serve robots.txt so crawlers get 200 instead of 404. API is not for indexing."""
    body = "User-agent: *\nDisallow: /\n"
    return HttpResponse(body, content_type="text/plain")


def serve_mascot_media(request, path):
    """Serve mascot assets with Cache-Control so browsers revalidate when files are replaced."""
    response = static_serve(request, path, document_root=settings.MEDIA_ROOT / "mascots")
    response["Cache-Control"] = "no-store"
    return response

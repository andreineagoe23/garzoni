# core/views.py
"""Minimal views for root and robots.txt to reduce 404 log noise from crawlers and health checks."""

from django.http import HttpResponse


def root_view(request):
    """Return a short 200 response for / so health checks and bots don't log 404."""
    return HttpResponse("OK", content_type="text/plain")


def robots_txt_view(request):
    """Serve robots.txt so crawlers get 200 instead of 404. API is not for indexing."""
    body = "User-agent: *\nDisallow: /\n"
    return HttpResponse(body, content_type="text/plain")

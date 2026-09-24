"""Public, unauthenticated endpoints that don't belong to one app.

Exposed under /api/public/, which Cloudflare caches at the edge. Nothing here may
read request.user, set a cookie or vary by header — see tests/test_public_api_surface.py.
"""

from rest_framework.decorators import api_view, permission_classes, throttle_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from core.services.public_stats import public_stats


@api_view(["GET"])
@permission_classes([AllowAny])
@throttle_classes([])  # landing page + prerender; the body is cached server-side
def public_stats_view(request):
    response = Response(public_stats())
    response["Cache-Control"] = "public, max-age=600"
    return response

"""Resolution of the origin used to build absolute media URLs in cached responses.

Extracted from `settings.py` so it can be tested directly: settings are evaluated
once at import, so a bad value here is not something a normal test can reach.

The values this produces are served to every visitor of an edge-cached
`/api/public/*` response for up to 10 minutes, so they must not depend on the
request and must never be a localhost URL in production.
"""

import re

# Canonical API host. Used only as a last resort, when running with DEBUG off and
# no usable BACKEND_URL — a wrong-but-reachable host beats a certainly-dead one.
FALLBACK_ORIGIN = "https://api.garzoni.app"


def resolve_public_media_origin(*, explicit: str, backend_url: str, debug: bool) -> str:
    """Return the scheme+host to prefix relative media paths with.

    `explicit` is PUBLIC_MEDIA_ORIGIN from the environment and always wins.
    Otherwise the origin is BACKEND_URL with its trailing `/api` removed.
    """
    origin = (explicit or "").strip() or re.sub(r"/api/?$", "", backend_url or "")
    origin = origin.rstrip("/")

    # BACKEND_URL defaults to http://localhost:8000/api. Shipping that into a
    # publicly cached body would advertise an unreachable host to every visitor.
    if not debug and (not origin or "localhost" in origin or "127.0.0.1" in origin):
        return FALLBACK_ORIGIN
    return origin

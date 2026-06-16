"""Resolve the originating client platform from a request.

Single source of truth shared by funnel-event ingest and signup views so platform
attribution stays consistent. Trusts the explicit ``X-Garzoni-Platform`` header set
by the web/mobile httpClient; falls back to a coarse User-Agent sniff. Reporting-only
— never a trust boundary, so spoofing only skews analytics, never grants access.
"""

KNOWN_PLATFORMS = frozenset({"web", "ios", "android"})


def resolve_request_platform(request) -> str:
    """Return "web" | "ios" | "android" | "" (unknown) for a DRF/Django request."""
    meta = getattr(request, "META", {}) or {}
    header = (meta.get("HTTP_X_GARZONI_PLATFORM") or "").strip().lower()
    if header in KNOWN_PLATFORMS:
        return header
    ua = (meta.get("HTTP_USER_AGENT") or "").lower()
    if "android" in ua or "okhttp" in ua:
        return "android"
    if any(tok in ua for tok in ("iphone", "ipad", "ios", "cfnetwork", "darwin")):
        return "ios"
    if "expo" in ua:  # Expo Go / dev client — bucket as mobile rather than web
        return "ios"
    if "mozilla" in ua or "chrome" in ua or "safari" in ua:
        return "web"
    return ""

"""Normalize ImageField/FileField URLs (legacy DB paths, Cloudinary vs local)."""

from __future__ import annotations

import re
from urllib.parse import urlparse, urlunparse

from django.conf import settings


def normalize_media_relative_path(stored_name: str) -> str:
    """
    Return path relative to MEDIA_ROOT (e.g. path_images/foo.png).
    Strips prefixes accidentally stored from dumps or wrong uploads.
    """
    if not stored_name:
        return ""
    n = str(stored_name).replace("\\", "/").lstrip("/")
    n = re.sub(r"^[^/]+/backend/media/", "", n)
    for prefix in (
        "backend/media/",
        "media/",
    ):
        if n.startswith(prefix):
            n = n[len(prefix) :]
    return n.lstrip("/")


def sanitize_media_delivery_url(url: str) -> str:
    """
    Fix known-bad Cloudinary delivery URLs from production.

    Some rows produced ``.../image/upload/v1/media/garzoni/...`` (a bogus ``v*/media/``
    segment). Valid delivery uses transforms (e.g. ``f_auto,q_auto,w_800``) or a version
    token followed by the public_id, never ``.../media/`` after the version slot.

    Reward images are stored in Cloudinary as ``garzoni/rewards/<Name>.jpg``; if the DB
    name omits ``.jpg``, append it when the path is extension-less.
    """
    if not url:
        return url
    u = str(url).strip()
    if u.startswith("//"):
        u = f"https:{u}"
    if "res.cloudinary.com" not in u or "/image/upload/" not in u:
        return u
    u = re.sub(r"(/image/upload/)v\d+/media/", r"\1f_auto,q_auto,w_800/", u, count=1)
    try:
        parsed = urlparse(u)
        path = parsed.path or ""
        last = path.rstrip("/").rsplit("/", 1)[-1]
        if "/garzoni/rewards/" in path and last and "." not in last:
            new_path = f"{path.rstrip('/')}.jpg"
            u = urlunparse(parsed._replace(path=new_path))
    except (ValueError, TypeError):
        pass
    return u


def canonical_file_field_url(file_field) -> str | None:
    """Absolute URL for a FileField built WITHOUT reading the request.

    Same result as `absolute_file_field_url` for Cloudinary-backed storage (the
    stored URL is already absolute either way). The difference matters only for
    locally-served media, where the request-based version calls
    `request.build_absolute_uri` — and `request.get_host()` honours the
    attacker-supplied `X-Forwarded-Host` header because `USE_X_FORWARDED_HOST`
    is on. ALLOWED_HOSTS keeps that to a *known* host, so it is not an open
    redirect, but on the Cloudflare-cached /api/public/* responses it still means
    one caller's header could pick the host every later caller sees for 10
    minutes. Public, cacheable payloads use this instead.
    """
    if not file_field:
        return None
    try:
        raw = file_field.url
    except (ValueError, AttributeError):
        raw = ""
    raw = (raw or "").strip()
    if raw.startswith("//"):
        raw = f"https:{raw}"
    if raw.startswith("http://") or raw.startswith("https://"):
        return sanitize_media_delivery_url(raw)
    rel = normalize_media_relative_path(getattr(file_field, "name", "") or "")
    if not rel:
        return None
    origin = (getattr(settings, "PUBLIC_MEDIA_ORIGIN", "") or "").rstrip("/")
    media_url = settings.MEDIA_URL.rstrip("/")
    return sanitize_media_delivery_url(f"{origin}{media_url}/{rel}")


def absolute_file_field_url(request, file_field) -> str | None:
    """
    Absolute URL for a FileField/ImageField.
    Uses storage URL when it is already absolute (e.g. Cloudinary HTTPS).
    Otherwise rebuilds from normalized name so /media/path_images/x works locally.
    """
    if not file_field or not request:
        return None
    try:
        raw = file_field.url
    except (ValueError, AttributeError):
        raw = ""
    raw = (raw or "").strip()
    if raw.startswith("//"):
        raw = f"https:{raw}"
    if raw.startswith("http://") or raw.startswith("https://"):
        return sanitize_media_delivery_url(raw)
    rel = normalize_media_relative_path(getattr(file_field, "name", "") or "")
    if not rel:
        return None
    media_url = settings.MEDIA_URL.rstrip("/")
    path = f"{media_url}/{rel}"
    return sanitize_media_delivery_url(request.build_absolute_uri(path))

"""Normalize ImageField/FileField URLs (legacy DB paths, Cloudinary vs local)."""

from __future__ import annotations

import re

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
    if raw.startswith("http://") or raw.startswith("https://"):
        return raw
    rel = normalize_media_relative_path(getattr(file_field, "name", "") or "")
    if not rel:
        return None
    media_url = settings.MEDIA_URL.rstrip("/")
    path = f"{media_url}/{rel}"
    return request.build_absolute_uri(path)

"""
One-time migration: map local media paths to Cloudinary public IDs using
scripts/cloudinary-upload-results.json (shape: [{ "file", "secure_url" }, ...]).

Django ImageField values should store the storage-relative public ID, not full
https:// URLs, so django-cloudinary-storage can build .url correctly.

Run from backend/ (or inside the API container):

  python manage.py migrate_cloudinary_images --dry-run
  python manage.py migrate_cloudinary_images

Docker DB + API container (from repo root; JSON lives on the host under scripts/):

  docker compose cp scripts/cloudinary-upload-results.json backend:/app/cloudinary-upload-results.json
  docker compose exec backend python manage.py migrate_cloudinary_images --dry-run
  docker compose exec backend python manage.py migrate_cloudinary_images

After updating rows to Cloudinary public IDs, set default file storage to Cloudinary
(DJANGO_MEDIA_STORAGE_BACKEND + CLOUDINARY_URL) or images will 404 on local disk.

Env override: CLOUDINARY_UPLOAD_MAP_JSON=/path/to/cloudinary-upload-results.json
"""

from __future__ import annotations

import json
import os
from pathlib import Path
from urllib.parse import urlparse

from django.apps import apps
from django.conf import settings
from django.core.management.base import BaseCommand

# Models with ImageField columns that correspond to files under backend/media/.
FIELD_MAP: dict[str, list[str]] = {
    "education.Path": ["image"],
    "education.Course": ["image"],
    "education.Lesson": ["image"],
    "gamification.Badge": ["image"],
    "finance.Reward": ["image"],
}

# JSON "file" entries look like: backend/media/course_images/foo.png
# DB typically stores paths relative to MEDIA_ROOT: course_images/foo.png
MEDIA_ROOT_PREFIX = "backend/media/"


def public_id_from_secure_url(url: str) -> str | None:
    """Extract Cloudinary public_id from a standard secure_url."""
    if not url or not url.startswith("http"):
        return None
    parsed = urlparse(url)
    path = parsed.path or ""
    marker = "/upload/"
    if marker not in path:
        return None
    rest = path.split(marker, 1)[1]
    parts = [p for p in rest.split("/") if p]
    if not parts:
        return None
    # Optional transformation segments (e.g. w_100,c_fill) — skip until we hit version or folder
    while parts and ("," in parts[0] or parts[0] in {"f_auto", "q_auto"}):
        parts.pop(0)
    if not parts:
        return None
    # Version folder v1234567890
    if len(parts) >= 2 and parts[0].startswith("v") and parts[0][1:].isdigit():
        parts = parts[1:]
    if not parts:
        return None
    return "/".join(parts)


def json_file_to_db_key(file_field: str) -> str | None:
    """
    Map upload script 'file' path to the value Django usually stores in ImageField.name.
    """
    if not file_field:
        return None
    normalized = file_field.replace("\\", "/")
    if normalized.startswith(MEDIA_ROOT_PREFIX):
        return normalized[len(MEDIA_ROOT_PREFIX) :]
    if normalized.startswith("media/"):
        return normalized[len("media/") :]
    # Frontend-only assets in JSON — no DB ImageField
    if normalized.startswith("frontend/") or normalized.startswith("mobile/"):
        return None
    return None


def candidate_lookup_keys(stored_name: str) -> list[str]:
    """Build possible keys for matching against old_path -> public_id map."""
    if not stored_name or stored_name.startswith("http"):
        return []
    name = stored_name.replace("\\", "/").lstrip("/")
    out: list[str] = []
    stripped_monevo = name.removeprefix("monevo/backend/media/")
    variants = {
        name,
        stripped_monevo,
        name.removeprefix("media/"),
        f"media/{name}",
        f"{MEDIA_ROOT_PREFIX}{name}",
        f"{MEDIA_ROOT_PREFIX}{stripped_monevo}" if stripped_monevo != name else "",
    }
    for key in variants:
        if key and key not in out:
            out.append(key)
    return out


def resolve_upload_map_json_path(explicit: str | None) -> Path | None:
    """Locate cloudinary-upload-results.json (Docker /app, monorepo scripts/, env)."""
    base = Path(settings.BASE_DIR)

    def try_path(p: Path) -> Path | None:
        if p.is_file():
            return p
        alt = Path(os.getcwd()) / p
        if alt.is_file():
            return alt
        return None

    if explicit:
        found = try_path(Path(explicit))
        if found:
            return found
        return None

    env_p = (os.getenv("CLOUDINARY_UPLOAD_MAP_JSON") or "").strip()
    if env_p:
        found = try_path(Path(env_p))
        if found:
            return found

    for rel in (
        "cloudinary-upload-results.json",
        Path("scripts") / "cloudinary-upload-results.json",
    ):
        found = try_path(base / rel)
        if found:
            return found

    mono = base.parent / "scripts" / "cloudinary-upload-results.json"
    found = try_path(mono)
    if found:
        return found

    return None


class Command(BaseCommand):
    help = "Set ImageField values to Cloudinary public IDs using cloudinary-upload-results.json"

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Print changes only; do not write to the database",
        )
        parser.add_argument(
            "--json-path",
            default="",
            help="Path to cloudinary-upload-results.json (default: search /app, env, monorepo scripts/)",
        )

    def handle(self, *args, **options):
        dry_run: bool = options["dry_run"]
        explicit = (options.get("json_path") or "").strip() or None
        json_path = resolve_upload_map_json_path(explicit)

        if json_path is None:
            self.stderr.write(
                self.style.ERROR(
                    "cloudinary-upload-results.json not found. "
                    "Copy it into the container: "
                    "`docker compose cp scripts/cloudinary-upload-results.json backend:/app/cloudinary-upload-results.json` "
                    "or pass --json-path / set CLOUDINARY_UPLOAD_MAP_JSON."
                )
            )
            return

        with json_path.open(encoding="utf-8") as f:
            raw = json.load(f)

        old_path_to_public_id: dict[str, str] = {}
        if isinstance(raw, dict):
            for old_path, result in raw.items():
                if isinstance(result, dict) and result.get("public_id"):
                    db_key = json_file_to_db_key(old_path) or json_file_to_db_key(
                        old_path.removeprefix("media/")
                    )
                    if db_key:
                        old_path_to_public_id[db_key] = str(result["public_id"])
        elif isinstance(raw, list):
            for entry in raw:
                if not isinstance(entry, dict):
                    continue
                file_key = entry.get("file") or entry.get("original_path")
                secure_url = entry.get("secure_url") or entry.get("url")
                public_id = entry.get("public_id")
                if not public_id and secure_url:
                    public_id = public_id_from_secure_url(str(secure_url))
                if not file_key or not public_id:
                    continue
                db_key = json_file_to_db_key(str(file_key))
                if db_key:
                    old_path_to_public_id[db_key] = str(public_id)
        else:
            self.stderr.write(self.style.ERROR("Unsupported JSON shape (expected list or dict)."))
            return

        public_id_values = set(old_path_to_public_id.values())

        total_updated = 0
        total_would_update = 0
        total_ok = 0
        total_skipped = 0

        for model_label, field_names in FIELD_MAP.items():
            app_label, model_name = model_label.split(".")
            try:
                Model = apps.get_model(app_label, model_name)
            except LookupError:
                self.stderr.write(self.style.WARNING(f"Unknown model {model_label}, skipping."))
                continue

            for field_name in field_names:
                qs = Model.objects.exclude(**{f"{field_name}__isnull": True}).exclude(
                    **{f"{field_name}__exact": ""}
                )
                for instance in qs.iterator():
                    file_obj = getattr(instance, field_name)
                    current = (file_obj.name or "").strip()
                    if not current:
                        continue

                    if current.startswith("http"):
                        extracted = public_id_from_secure_url(current)
                        if not extracted:
                            total_skipped += 1
                            self.stdout.write(
                                self.style.WARNING(
                                    f"  [SKIP] {model_label} pk={instance.pk} {field_name}: "
                                    f"full URL, could not parse public_id — fix manually"
                                )
                            )
                            continue
                        self.stdout.write(
                            f"  [UPDATE] {model_label} pk={instance.pk} {field_name}: "
                            f"URL -> public_id '{extracted[:80]}'"
                        )
                        if dry_run:
                            total_would_update += 1
                        else:
                            Model.objects.filter(pk=instance.pk).update(**{field_name: extracted})
                            total_updated += 1
                        continue

                    # Only skip if this exact string is already a known Cloudinary public_id from the map.
                    # Do not use startswith("monevo/"): legacy DB paths like monevo/backend/media/... are wrong.
                    if current in public_id_values:
                        total_ok += 1
                        self.stdout.write(
                            self.style.SUCCESS(
                                f"  [OK] {model_label} pk={instance.pk} {field_name}: '{current[:70]}'"
                            )
                        )
                        continue

                    new_public_id = None
                    matched_key = None
                    for key in candidate_lookup_keys(current):
                        if key in old_path_to_public_id:
                            new_public_id = old_path_to_public_id[key]
                            matched_key = key
                            break

                    if not new_public_id:
                        total_skipped += 1
                        self.stdout.write(
                            self.style.WARNING(
                                f"  [MISS] {model_label} pk={instance.pk} {field_name}: "
                                f"no JSON entry for '{current}'"
                            )
                        )
                        continue

                    self.stdout.write(
                        f"  [UPDATE] {model_label} pk={instance.pk} {field_name}: "
                        f"'{matched_key}' -> '{new_public_id[:80]}'"
                    )
                    if dry_run:
                        total_would_update += 1
                    else:
                        Model.objects.filter(pk=instance.pk).update(**{field_name: new_public_id})
                        total_updated += 1

        if dry_run:
            self.stdout.write(
                self.style.SUCCESS(
                    f"\nDry run complete. Would update: {total_would_update} | "
                    f"OK (unchanged): {total_ok} | Skipped/warnings: {total_skipped}"
                )
            )
        else:
            self.stdout.write(
                self.style.SUCCESS(
                    f"\nDone. Updated: {total_updated} | OK (unchanged): {total_ok} | "
                    f"Skipped/warnings: {total_skipped}"
                )
            )

"""
Point ImageFields at files that exist under MEDIA_ROOT (seed layout).

Use when the DB has random upload names (e.g. ew8lwersp2vlwc3x8yee.png) or bogus
legacy backend/media prefixes so /media/path_images/... 404s locally.

Does not upload to Cloudinary. For Cloudinary IDs + storage, use migrate_cloudinary_images.

  docker compose exec backend python manage.py fix_local_media_image_paths --dry-run
  docker compose exec backend python manage.py fix_local_media_image_paths
"""

from __future__ import annotations

import difflib
import re
from pathlib import Path as FsPath

from django.apps import apps
from django.conf import settings
from django.core.management.base import BaseCommand

from core.media_url import normalize_media_relative_path


def _media_subpath_exists(relative: str) -> bool:
    rel = normalize_media_relative_path(relative)
    if not rel:
        return False
    return (FsPath(settings.MEDIA_ROOT) / rel).is_file()


# Path.title (substring) -> file under path_images/ (matches repo seed assets)
PATH_RULES: list[tuple[str, str]] = [
    ("basic finance", "path_images/basicfinance.png"),
    ("cryptocurrency", "path_images/crypto.png"),
    ("crypto", "path_images/crypto.png"),
    ("forex", "path_images/forex.png"),
    ("foreign exchange", "path_images/forex.png"),
    ("mindset", "path_images/mindset.png"),
    ("personal finance", "path_images/personalfinance.png"),
    ("real estate", "path_images/realestate.png"),
    ("property", "path_images/realestate.png"),
]


def _path_image_for_title(title: str) -> str | None:
    low = (title or "").lower()
    for needle, rel in PATH_RULES:
        if needle in low and _media_subpath_exists(rel):
            return rel
    return None


def _norm_alnum(s: str) -> str:
    return re.sub(r"[^a-z0-9]+", "", (s or "").lower())


# Course title substring -> seed filename (before fuzzy match)
COURSE_PHRASE_RULES: list[tuple[str, str]] = [
    ("building mindset", "course_images/BuildingMindset.png"),
    ("introduction to crypto", "course_images/CryptoIntro.png"),
    ("forex fundamentals", "course_images/FundamentalsForex.png"),
    ("managing risk", "course_images/RiskForex.png"),
    ("risk in forex", "course_images/RiskForex.png"),
    ("best strateg", "course_images/BSSCrypto.png"),
    ("advanced crypto", "course_images/AdvancedCrypto.png"),
    ("market research", "course_images/MarketResearch.png"),
    ("intro to budgeting", "course_images/IntroBudgeting.png"),
    ("buying, selling", "course_images/BSSCrypto.png"),
    ("storing crypto", "course_images/BSSCrypto.png"),
    ("risk management in forex", "course_images/RiskForex.png"),
    ("risk management", "course_images/RiskForex.png"),
]


def _course_image_for_title(title: str) -> str | None:
    low = (title or "").lower()
    for needle, rel in COURSE_PHRASE_RULES:
        if needle in low and _media_subpath_exists(rel):
            return rel

    root = FsPath(settings.MEDIA_ROOT) / "course_images"
    if not root.is_dir():
        return None
    stems = [p.stem for p in root.glob("*.png")]
    if not stems:
        return None
    t = _norm_alnum(title)
    if not t:
        return None
    best: tuple[float, str] = (0.0, "")
    for stem in stems:
        s = _norm_alnum(stem)
        if not s:
            continue
        if s == t:
            return f"course_images/{stem}.png"
        ratio = difflib.SequenceMatcher(None, t, s).ratio()
        if ratio > best[0]:
            best = (ratio, stem)
    if best[0] >= 0.62:
        rel = f"course_images/{best[1]}.png"
        if _media_subpath_exists(rel):
            return rel
    return None


def _badge_image_for_name(name: str) -> str | None:
    n = (name or "").strip().lower().replace(" ", "_").replace("-", "_")
    if not n:
        return None
    # Seed file uses typo "initiatior" (e.g. savings_initiatior.png)
    for candidate in (n, n.replace("initiator", "initiatior")):
        rel = f"badges/{candidate}.png"
        if _media_subpath_exists(rel):
            return rel
    # try original seed filenames (underscore style)
    root = FsPath(settings.MEDIA_ROOT) / "badges"
    if not root.is_dir():
        return None
    for p in root.glob("*.png"):
        if _norm_alnum(p.stem) == _norm_alnum(name):
            return f"badges/{p.name}"
    return None


def _reward_image_for_name(name: str) -> str | None:
    if not (name or "").strip():
        return None
    parts = re.split(r"[\s_\-]+", name.strip())
    pascal = "".join(w[:1].upper() + w[1:].lower() if w else "" for w in parts if w)
    for ext in (".png", ".jpg", ".jpeg"):
        rel = f"rewards/{pascal}{ext}"
        if _media_subpath_exists(rel):
            return rel
    root = FsPath(settings.MEDIA_ROOT) / "rewards"
    if not root.is_dir():
        return None
    for p in root.glob("*"):
        if p.suffix.lower() not in (".png", ".jpg", ".jpeg"):
            continue
        if _norm_alnum(p.stem) == _norm_alnum(name):
            return f"rewards/{p.name}"
    return None


def _lesson_fallback_image() -> str | None:
    rel = "path_images/basicfinance.png"
    return rel if _media_subpath_exists(rel) else None


def _lesson_needs_repoint(stored_name: str) -> bool:
    rel = normalize_media_relative_path(stored_name)
    return bool(rel) and not _media_subpath_exists(rel)


class Command(BaseCommand):
    help = "Remap Path/Course/Lesson/Badge/Reward images to existing MEDIA_ROOT seed files"

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Print changes only",
        )

    def handle(self, *args, **options):
        dry_run: bool = options["dry_run"]
        updated = 0

        EduPath = apps.get_model("education", "Path")
        for obj in EduPath.objects.exclude(image__isnull=True).exclude(image="").iterator():
            cur = (obj.image.name or "").strip()
            target = _path_image_for_title(obj.title)
            if not target or cur == target:
                continue
            self.stdout.write(f"  Path pk={obj.pk} {obj.title!r}: {cur[:60]!r} -> {target!r}")
            if not dry_run:
                EduPath.objects.filter(pk=obj.pk).update(image=target)
            updated += 1

        Course = apps.get_model("education", "Course")
        for obj in Course.objects.exclude(image__isnull=True).exclude(image="").iterator():
            cur = (obj.image.name or "").strip()
            target = _course_image_for_title(obj.title)
            if not target or cur == target:
                continue
            self.stdout.write(f"  Course pk={obj.pk} {obj.title!r}: {cur[:60]!r} -> {target!r}")
            if not dry_run:
                Course.objects.filter(pk=obj.pk).update(image=target)
            updated += 1

        Lesson = apps.get_model("education", "Lesson")
        for obj in Lesson.objects.exclude(image__isnull=True).exclude(image="").iterator():
            cur = (obj.image.name or "").strip()
            if cur.startswith("http"):
                continue
            if not _lesson_needs_repoint(cur):
                continue
            target = _lesson_fallback_image()
            if not target or cur == target:
                continue
            self.stdout.write(f"  Lesson pk={obj.pk} {obj.title!r}: {cur[:60]!r} -> {target!r}")
            if not dry_run:
                Lesson.objects.filter(pk=obj.pk).update(image=target)
            updated += 1

        Badge = apps.get_model("gamification", "Badge")
        for obj in Badge.objects.exclude(image__isnull=True).exclude(image="").iterator():
            cur = (obj.image.name or "").strip()
            target = _badge_image_for_name(obj.name)
            if not target or cur == target:
                continue
            self.stdout.write(f"  Badge pk={obj.pk} {obj.name!r}: {cur[:60]!r} -> {target!r}")
            if not dry_run:
                Badge.objects.filter(pk=obj.pk).update(image=target)
            updated += 1

        Reward = apps.get_model("finance", "Reward")
        for obj in Reward.objects.exclude(image__isnull=True).exclude(image="").iterator():
            cur = (obj.image.name or "").strip()
            target = _reward_image_for_name(obj.name)
            if not target or cur == target:
                continue
            self.stdout.write(f"  Reward pk={obj.pk} {obj.name!r}: {cur[:60]!r} -> {target!r}")
            if not dry_run:
                Reward.objects.filter(pk=obj.pk).update(image=target)
            updated += 1

        if dry_run:
            self.stdout.write(self.style.SUCCESS(f"\nDry run: would update {updated} row(s)."))
        else:
            self.stdout.write(self.style.SUCCESS(f"\nUpdated {updated} row(s)."))

"""
Strip (Starter), (Plus), (Pro) from Path and PathTranslation titles in the database.

So path titles in admin and API show as "Financial Mindset", "Personal Finance", etc.,
without the subscription tier in the name. Idempotent.
"""

import re
from django.core.management.base import BaseCommand
from django.db import transaction

from education.models import Path, PathTranslation

SUFFIX_RE = re.compile(r"\s*\((?:Starter|Plus|Pro)\)\s*$", re.IGNORECASE)


def strip_suffix(title: str) -> str:
    if not title:
        return title
    return SUFFIX_RE.sub("", title).strip()


class Command(BaseCommand):
    help = "Remove (Starter), (Plus), (Pro) from path titles in the database."

    def add_arguments(self, parser):
        parser.add_argument("--dry-run", action="store_true")

    def handle(self, *args, **options):
        dry_run = options["dry_run"]
        updated = 0
        with transaction.atomic():
            for path in Path.objects.all():
                new_title = strip_suffix(path.title)
                if new_title != path.title:
                    if not dry_run:
                        path.title = new_title
                        path.save(update_fields=["title"])
                        PathTranslation.objects.filter(path=path).update(title=new_title)
                    self.stdout.write(f"Path {path.id}: {path.title!r} -> {new_title!r}")
                    updated += 1
            if dry_run:
                transaction.set_rollback(True)
        self.stdout.write(
            self.style.SUCCESS(f"{'Would update' if dry_run else 'Updated'} {updated} path(s).")
        )

"""
Fix mojibake in User first_name, last_name, and username (e.g. RoÈ™u -> Roșu).
Run after importing data that was stored with wrong encoding.
  python manage.py fix_user_mojibake
  python manage.py fix_user_mojibake --dry-run
"""

from django.contrib.auth.models import User
from django.core.management.base import BaseCommand

from core.utils import normalize_text_encoding


class Command(BaseCommand):
    help = "Fix mojibake in User first_name, last_name, username (and optionally email)."

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Only report what would be changed, do not save.",
        )
        parser.add_argument(
            "--email",
            action="store_true",
            help="Also normalize email field (use with care).",
        )

    def handle(self, *args, **options):
        dry_run = options["dry_run"]
        fix_email = options["email"]
        updated = 0
        for user in User.objects.iterator():
            first_name = user.first_name or ""
            last_name = user.last_name or ""
            username = user.username or ""
            email = user.email or ""

            n_first = (normalize_text_encoding(first_name) or first_name) if first_name else ""
            n_last = (normalize_text_encoding(last_name) or last_name) if last_name else ""
            n_username = (normalize_text_encoding(username) or username) if username else ""
            n_email = (normalize_text_encoding(email) or email) if (email and fix_email) else email

            changed = False
            if n_first != first_name:
                user.first_name = n_first
                changed = True
            if n_last != last_name:
                user.last_name = n_last
                changed = True
            if n_username != username:
                user.username = n_username
                changed = True
            if fix_email and n_email != email:
                user.email = n_email
                changed = True

            if changed:
                updated += 1
                if dry_run:
                    self.stdout.write(
                        f"Would fix: id={user.id} username={username!r} -> {n_username!r} "
                        f"first_name={first_name!r} -> {n_first!r} last_name={last_name!r} -> {n_last!r}"
                    )
                else:
                    user.save(
                        update_fields=["first_name", "last_name", "username"]
                        + (["email"] if fix_email else [])
                    )

        if dry_run:
            self.stdout.write(self.style.WARNING(f"Dry run: would update {updated} user(s)."))
        else:
            self.stdout.write(self.style.SUCCESS(f"Updated {updated} user(s)."))

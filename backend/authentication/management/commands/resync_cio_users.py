"""
Resync all users to Customer.io (identify with email/traits).
Useful to backfill users who registered before the fix or who have missing email in CIO.

Usage:
    python manage.py resync_cio_users
    python manage.py resync_cio_users --user-ids 228 243 246  # specific users
"""

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from notifications.tasks import safe_enqueue_sync_user_to_customer_io


class Command(BaseCommand):
    help = "Re-enqueue Customer.io identify for all users (or specific IDs)"

    def add_arguments(self, parser):
        parser.add_argument(
            "--user-ids",
            nargs="*",
            type=int,
            help="Only resync these user IDs. Omit to resync all.",
        )

    def handle(self, *args, **options):
        User = get_user_model()
        ids = options.get("user_ids")
        if ids:
            qs = User.objects.filter(pk__in=ids)
        else:
            qs = User.objects.all()

        total = qs.count()
        self.stdout.write(f"Enqueueing CIO resync for {total} user(s)...")
        for user in qs.iterator():
            safe_enqueue_sync_user_to_customer_io(user.pk)
        self.stdout.write(self.style.SUCCESS(f"Done. {total} user(s) queued."))

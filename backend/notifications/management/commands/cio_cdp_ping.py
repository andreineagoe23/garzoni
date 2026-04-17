"""
Send a one-off CDP identify so Customer.io Pipelines "Test connection" receives data.

Usage:
  CIO_CDP_API_KEY=... CIO_REGION=eu python manage.py cio_cdp_ping

Optional:
  python manage.py cio_cdp_ping --user-id garzoni-smoke-test
"""

from django.core.management.base import BaseCommand

from notifications.customer_io import cdp_identify


class Command(BaseCommand):
    help = "POST /v1/identify to Customer.io CDP (EU/US) for pipeline connection tests."

    def add_arguments(self, parser):
        parser.add_argument(
            "--user-id",
            default="garzoni-cdp-ping",
            help="userId sent in the identify payload (default: garzoni-cdp-ping)",
        )

    def handle(self, *args, **options):
        uid = (options["user_id"] or "garzoni-cdp-ping").strip()
        traits = {
            "name": "Garzoni CDP ping",
            "email": "cdp-ping@garzoni.app",
        }
        ok, err = cdp_identify(uid, traits)
        if ok:
            self.stdout.write(self.style.SUCCESS(f"CDP identify ok userId={uid!r}"))
            return
        self.stderr.write(self.style.ERROR(f"CDP identify failed: {err}"))
        raise SystemExit(1)

"""
Ensure a superuser exists. Use after a DB restore if the superuser is missing or can't log in.
  python manage.py ensure_superuser andreineagoe23 --email neagoe.andrei23@yahoo.com
"""

from django.contrib.auth.models import User
from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = "Ensure a user exists as superuser; create or fix is_staff/is_superuser and optionally set password."

    def add_arguments(self, parser):
        parser.add_argument(
            "username",
            nargs="?",
            default="andreineagoe23",
            help="Username (default: andreineagoe23)",
        )
        parser.add_argument(
            "--email", default="neagoe.andrei23@yahoo.com", help="Email for new user"
        )
        parser.add_argument(
            "--password", help="Set this password (if not given, you will be prompted for new user)"
        )

    def handle(self, *args, **options):
        username = options["username"]
        email = options["email"]
        password = options.get("password")

        try:
            user = User.objects.get(username=username)
            created = False
        except User.DoesNotExist:
            user = User.objects.create_user(
                username=username,
                email=email,
                password=password or User.objects.make_random_password(length=24),
            )
            created = True
            if not password:
                self.stdout.write(
                    self.style.WARNING(
                        f"Created {username} with a random password. Set a password with: python manage.py changepassword {username}"
                    )
                )

        user.is_staff = True
        user.is_superuser = True
        user.is_active = True
        if password:
            user.set_password(password)
            self.stdout.write(self.style.SUCCESS(f"Password updated for {username}"))
        user.save()

        if created:
            self.stdout.write(self.style.SUCCESS(f"Superuser {username} created."))
        else:
            self.stdout.write(
                self.style.SUCCESS(
                    f"Superuser {username} already exists; is_staff and is_superuser set."
                )
            )

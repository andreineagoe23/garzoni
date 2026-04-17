from __future__ import annotations

from django.contrib.auth.models import AbstractBaseUser


def customer_io_person_id(user: AbstractBaseUser) -> str:
    """
    Stable Customer.io `id` — Django user primary key as string (immutable for the account).
    Align mobile `identify` with the same value (JWT `user_id` claim).
    """
    return str(user.pk)

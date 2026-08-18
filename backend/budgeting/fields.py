"""Application-level encryption for open-banking credentials.

A provider access token is a bearer credential for someone's bank account. The
columns were named ``encrypted_*`` from the start but held plaintext, with a
note deferring the work to disk-level encryption. Disk encryption protects a
stolen drive; it does nothing about a leaked backup, an over-broad read replica,
or ``SELECT * FROM budgeting_linkedaccount`` in a support console.

This is done now because the table is empty in every environment
(``BUDGETING_PROVIDER`` defaults to ``disabled``), so there is no backfill and
no rollout risk. Once real tokens land it becomes a data migration.
"""

import logging

from cryptography.fernet import Fernet, InvalidToken
from django.conf import settings
from django.core.exceptions import ImproperlyConfigured
from django.db import models

logger = logging.getLogger(__name__)

_PREFIX = "fernet:"


def _cipher() -> Fernet:
    key = getattr(settings, "BUDGETING_TOKEN_ENCRYPTION_KEY", "")
    if not key:
        raise ImproperlyConfigured(
            "BUDGETING_TOKEN_ENCRYPTION_KEY is not set, so provider tokens cannot be "
            "encrypted. Generate one with: "
            "python -c 'from cryptography.fernet import Fernet; "
            "print(Fernet.generate_key().decode())'"
        )
    try:
        return Fernet(key.encode() if isinstance(key, str) else key)
    except (ValueError, TypeError) as exc:
        raise ImproperlyConfigured(
            f"BUDGETING_TOKEN_ENCRYPTION_KEY is not a valid Fernet key: {exc}"
        ) from exc


class EncryptedTextField(models.TextField):
    """TextField that encrypts with Fernet on write and decrypts on read.

    Stored as ``fernet:<token>``. The prefix keeps the column self-describing,
    so a value that predates this field (or was written by a fixture) is
    recognisable rather than being fed to the cipher and blowing up. It also
    makes the write path idempotent. The trade-off: a plaintext token that
    genuinely began with ``fernet:`` would be stored as-is -- no provider issues
    credentials in that shape, but it is the assumption this rests on.

    Empty stays empty: a blank token is absence, not a secret, and encrypting
    it would break ``.filter(field="")`` for no benefit.
    """

    def get_prep_value(self, value):
        value = super().get_prep_value(value)
        if value in (None, ""):
            return value
        if value.startswith(_PREFIX):
            return value
        return _PREFIX + _cipher().encrypt(value.encode()).decode()

    def from_db_value(self, value, expression, connection):
        if value in (None, ""):
            return value
        if not value.startswith(_PREFIX):
            # Written before this field existed. Surfacing it beats silently
            # treating a plaintext credential as if it were protected.
            logger.warning("budgeting: unencrypted token found in %s", self.name)
            return value
        try:
            return _cipher().decrypt(value[len(_PREFIX) :].encode()).decode()
        except (InvalidToken, ImproperlyConfigured):
            # Wrong or rotated key. Returning "" makes the account look
            # unlinked, which is the recoverable outcome -- the user re-links.
            # Raising here would take down every list view that touches the row.
            logger.exception("budgeting: could not decrypt %s; account needs re-linking", self.name)
            return ""

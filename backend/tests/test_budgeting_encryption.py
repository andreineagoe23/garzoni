"""LinkedAccount provider tokens must never reach the database in plaintext."""

from cryptography.fernet import Fernet
from django.contrib.auth import get_user_model
from django.core.exceptions import ImproperlyConfigured
from django.db import connection
from django.test import TestCase, override_settings

from budgeting.models import LinkedAccount

# Generated per run, never committed as a literal.
TEST_KEY = Fernet.generate_key().decode()
OTHER_KEY = Fernet.generate_key().decode()

User = get_user_model()


def raw_token_columns(pk):
    """Read the columns straight from Postgres, bypassing from_db_value."""
    with connection.cursor() as cur:
        cur.execute(
            "SELECT encrypted_access_token, encrypted_refresh_token "
            "FROM budgeting_linkedaccount WHERE id = %s",
            [pk],
        )
        return cur.fetchone()


@override_settings(BUDGETING_TOKEN_ENCRYPTION_KEY=TEST_KEY)
class LinkedAccountTokenEncryptionTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="cfo", password="pw-not-a-secret")

    def _account(self, **kwargs):
        return LinkedAccount.objects.create(
            user=self.user,
            provider="plaid",
            provider_account_id=kwargs.pop("provider_account_id", "acct-1"),
            display_name="Current account",
            **kwargs,
        )

    def test_token_is_ciphertext_in_the_database(self):
        secret = "access-sandbox-abc123"
        acct = self._account(encrypted_access_token=secret)

        stored_access, _ = raw_token_columns(acct.pk)

        self.assertNotEqual(stored_access, secret)
        self.assertNotIn(secret, stored_access)
        self.assertTrue(stored_access.startswith("fernet:"))

    def test_round_trip_returns_plaintext(self):
        acct = self._account(
            encrypted_access_token="access-token",
            encrypted_refresh_token="refresh-token",
        )

        fetched = LinkedAccount.objects.get(pk=acct.pk)

        self.assertEqual(fetched.encrypted_access_token, "access-token")
        self.assertEqual(fetched.encrypted_refresh_token, "refresh-token")

    def test_blank_stays_blank(self):
        """A missing token is absence, not a secret -- encrypting it would break
        filtering on empty and store noise for every unlinked account."""
        acct = self._account()

        stored_access, stored_refresh = raw_token_columns(acct.pk)

        self.assertEqual(stored_access, "")
        self.assertEqual(stored_refresh, "")
        self.assertEqual(LinkedAccount.objects.get(pk=acct.pk).encrypted_access_token, "")

    def test_resave_rotates_ciphertext_but_preserves_value(self):
        """Fernet takes a fresh nonce every time, so the stored bytes change on
        each write. What must not change is what comes back out."""
        acct = self._account(encrypted_access_token="access-token")
        first, _ = raw_token_columns(acct.pk)

        acct.save()
        second, _ = raw_token_columns(acct.pk)

        self.assertNotEqual(first, second)
        self.assertEqual(
            LinkedAccount.objects.get(pk=acct.pk).encrypted_access_token, "access-token"
        )

    def test_already_encrypted_value_is_not_encrypted_twice(self):
        """Saving a row whose field still holds ciphertext -- e.g. copied from a
        query that bypassed from_db_value -- must not wrap it a second time,
        which would make it undecryptable in one pass."""
        acct = self._account(encrypted_access_token="access-token")
        ciphertext, _ = raw_token_columns(acct.pk)

        acct.encrypted_access_token = ciphertext
        acct.save(update_fields=["encrypted_access_token"])

        self.assertEqual(raw_token_columns(acct.pk)[0], ciphertext)
        self.assertEqual(
            LinkedAccount.objects.get(pk=acct.pk).encrypted_access_token, "access-token"
        )

    def test_each_write_uses_a_fresh_nonce(self):
        """Two accounts with the same token must not produce the same ciphertext,
        or the column leaks which users share a credential."""
        a = self._account(provider_account_id="acct-a", encrypted_access_token="same-token")
        b = self._account(provider_account_id="acct-b", encrypted_access_token="same-token")

        self.assertNotEqual(raw_token_columns(a.pk)[0], raw_token_columns(b.pk)[0])

    def test_wrong_key_reads_as_unlinked_rather_than_raising(self):
        """After a key rotation the row is unrecoverable. It must degrade to
        'needs re-linking' -- raising would take down every view touching it."""
        acct = self._account(encrypted_access_token="access-token")

        with override_settings(BUDGETING_TOKEN_ENCRYPTION_KEY=OTHER_KEY):
            with self.assertLogs("budgeting.fields", level="ERROR"):
                fetched = LinkedAccount.objects.get(pk=acct.pk)
            self.assertEqual(fetched.encrypted_access_token, "")

    def test_missing_key_refuses_to_write(self):
        """Better to fail the write than to persist a bank credential in clear."""
        with override_settings(BUDGETING_TOKEN_ENCRYPTION_KEY=""):
            with self.assertRaises(ImproperlyConfigured):
                self._account(encrypted_access_token="access-token")

    def test_legacy_plaintext_row_is_readable_and_flagged(self):
        """Rows written before this field existed must not break reads."""
        acct = self._account()
        with connection.cursor() as cur:
            cur.execute(
                "UPDATE budgeting_linkedaccount SET encrypted_access_token = %s WHERE id = %s",
                ["legacy-plaintext", acct.pk],
            )

        with self.assertLogs("budgeting.fields", level="WARNING"):
            fetched = LinkedAccount.objects.get(pk=acct.pk)

        self.assertEqual(fetched.encrypted_access_token, "legacy-plaintext")

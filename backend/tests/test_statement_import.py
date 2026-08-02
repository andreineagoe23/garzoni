"""Tests for CSV statement parsing, categorisation and the import flow.

The parser is the risky part: real exports disagree on delimiters, decimal
separators, date order, sign convention and whether debit/credit live in one
column or two. Each dialect below is a real-world header shape.
"""

from datetime import date
from decimal import Decimal

from django.contrib.auth.models import User
from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APIClient

from budgeting.models import StatementImport, Transaction
from budgeting.services import statement_analysis
from budgeting.services.categorization import categorize, normalise_merchant
from budgeting.services.statements import (
    StatementParseError,
    parse_amount,
    parse_date,
    parse_statement,
    redact,
)

REVOLUT_CSV = (
    "Type,Product,Started Date,Completed Date,Description,Amount,Fee,Currency,State,Balance\n"
    "CARD_PAYMENT,Current,2026-07-02 08:11:00,2026-07-02 08:12:00,Tesco,-42.10,0,GBP,COMPLETED,900\n"
    "CARD_PAYMENT,Current,2026-07-03 12:00:00,2026-07-03 12:01:00,Netflix,-10.99,0,GBP,COMPLETED,889\n"
    "TOPUP,Current,2026-07-04 09:00:00,2026-07-04 09:01:00,Salary,2000.00,0,GBP,COMPLETED,2889\n"
    "CARD_PAYMENT,Current,2026-07-05 09:00:00,2026-07-05 09:01:00,Ghost,-500.00,0,GBP,REVERTED,2889\n"
)

BARCLAYS_CSV = (
    "Number,Date,Account,Amount,Subcategory,Memo\n"
    "1,02/07/2026,20-00-00 12345678,-42.10,Groceries,CARD PAYMENT TO SAINSBURYS 4821 ON 02 JUL\n"
    "2,03/07/2026,20-00-00 12345678,-8.50,Transport,TFL TRAVEL CHARGE\n"
    "3,25/07/2026,20-00-00 12345678,1850.00,Salary,BGC ACME LTD SALARY\n"
)

BT_CSV = (
    "Data tranzactiei;Descriere;Suma debit;Suma credit;Valuta\n"
    "02.07.2026;PLATA LA POS MEGA IMAGE BUCURESTI;123,45;;RON\n"
    "05.07.2026;TRANSFER SALARIU ACME SRL;;5.500,00;RON\n"
    "07.07.2026;PLATA LA POS OMV PETROM;250,00;;RON\n"
)

# Header preceded by account metadata, unsigned amounts, no debit/credit split.
MESSY_CSV = (
    "Account statement for 12345678\n"
    "Generated 2026-08-01\n"
    "\n"
    "Date,Details,Amount\n"
    "01/07/2026,LIDL GB LONDON,25.40\n"
    "02/07/2026,COSTA COFFEE,3.20\n"
)


class ParseHelperTests(TestCase):
    def test_parse_amount_handles_both_decimal_conventions(self):
        self.assertEqual(parse_amount("1,234.56"), Decimal("1234.56"))
        self.assertEqual(parse_amount("1.234,56"), Decimal("1234.56"))
        self.assertEqual(parse_amount("123,45"), Decimal("123.45"))
        self.assertEqual(parse_amount("1.234"), Decimal("1234"))
        self.assertEqual(parse_amount("£42.10"), Decimal("42.10"))
        self.assertEqual(parse_amount("(42.10)"), Decimal("-42.10"))
        self.assertEqual(parse_amount("42.10 DB"), Decimal("-42.10"))
        self.assertIsNone(parse_amount(""))

    def test_parse_date_is_day_first(self):
        self.assertEqual(parse_date("02/07/2026"), date(2026, 7, 2))
        self.assertEqual(parse_date("02.07.2026"), date(2026, 7, 2))
        self.assertEqual(parse_date("2026-07-02 08:11:00"), date(2026, 7, 2))
        self.assertIsNone(parse_date("not a date"))

    def test_redact_strips_pan_and_iban(self):
        self.assertNotIn("4111111111111111", redact("PAYMENT 4111 1111 1111 1111"))
        self.assertNotIn("GB29NWBK60161331926819", redact("TO GB29NWBK60161331926819"))

    def test_normalise_merchant_strips_rail_noise(self):
        self.assertEqual(
            normalise_merchant("CARD PAYMENT TO TESCO STORES 3428 ON 02 AUG"),
            "tesco stores",
        )
        self.assertEqual(normalise_merchant("SumUp *CAFENEAUA VECHE"), "cafeneaua veche")
        self.assertEqual(
            normalise_merchant("PLATA LA POS MEGA IMAGE BUCURESTI"),
            "mega image bucuresti",
        )


class DialectParsingTests(TestCase):
    def test_revolut_signed_amounts_and_dropped_states(self):
        parsed = parse_statement(REVOLUT_CSV.encode())
        self.assertEqual(parsed.dialect_slug, "revolut")
        self.assertEqual(parsed.currency, "GBP")
        # The REVERTED row must not be imported.
        self.assertEqual(len(parsed.rows), 3)
        self.assertEqual(parsed.rows[0].amount, Decimal("-42.10"))
        self.assertEqual(parsed.rows[2].amount, Decimal("2000.00"))

    def test_barclays_day_first_dates_and_memo_description(self):
        parsed = parse_statement(BARCLAYS_CSV.encode())
        self.assertEqual(parsed.dialect_slug, "barclays")
        self.assertEqual(parsed.rows[0].posted_at, date(2026, 7, 2))
        self.assertIn("SAINSBURYS", parsed.rows[0].description)
        self.assertEqual(parsed.rows[2].amount, Decimal("1850.00"))

    def test_banca_transilvania_semicolons_debit_credit_and_comma_decimals(self):
        parsed = parse_statement(BT_CSV.encode())
        self.assertEqual(parsed.currency, "RON")
        self.assertEqual(len(parsed.rows), 3)
        self.assertEqual(parsed.rows[0].amount, Decimal("-123.45"))
        self.assertEqual(parsed.rows[1].amount, Decimal("5500.00"))
        self.assertEqual(parsed.rows[2].amount, Decimal("-250.00"))

    def test_messy_export_finds_header_and_flips_unsigned_amounts(self):
        parsed = parse_statement(MESSY_CSV.encode())
        self.assertEqual(len(parsed.rows), 2)
        # All-positive single-amount column means spending.
        self.assertTrue(all(r.amount < 0 for r in parsed.rows))
        self.assertTrue(any("positive" in w for w in parsed.warnings))

    def test_rejects_non_csv(self):
        with self.assertRaises(StatementParseError) as ctx:
            parse_statement(b"%PDF-1.4 fake pdf")
        self.assertEqual(ctx.exception.code, "unsupported_format")

    def test_rejects_file_without_usable_columns(self):
        with self.assertRaises(StatementParseError):
            parse_statement(b"alpha,beta\n1,2\n")


class CategorizationTests(TestCase):
    def test_uk_and_ro_merchants_map_to_categories(self):
        cases = [
            ("CARD PAYMENT TO TESCO STORES 3428", Decimal("-40"), "groceries"),
            ("PLATA LA POS MEGA IMAGE", Decimal("-40"), "groceries"),
            ("NETFLIX.COM", Decimal("-10.99"), "subscriptions"),
            ("TFL TRAVEL CHARGE", Decimal("-8.50"), "transport"),
            ("OMV PETROM", Decimal("-250"), "fuel"),
            ("BET365", Decimal("-20"), "gambling"),
            ("FARMACIA CATENA", Decimal("-30"), "health"),
            ("BGC ACME LTD SALARY", Decimal("1850"), "income"),
        ]
        for description, amount, expected in cases:
            with self.subTest(description=description):
                self.assertEqual(categorize(description, amount), expected)

    def test_unmatched_inflow_defaults_to_income(self):
        self.assertEqual(categorize("SOMETHING UNKNOWN", Decimal("500")), "income")
        self.assertEqual(categorize("SOMETHING UNKNOWN", Decimal("-500")), "other")


class AnalysisTests(TestCase):
    def test_analysis_totals_categories_and_recurring(self):
        csv = (
            "Date,Description,Amount\n"
            "2026-06-03,NETFLIX.COM,-10.99\n"
            "2026-07-03,NETFLIX.COM,-10.99\n"
            "2026-07-04,TESCO STORES,-40.00\n"
            "2026-07-25,ACME LTD SALARY,1850.00\n"
        )
        parsed = parse_statement(csv.encode())
        analysis = statement_analysis.analyze(parsed.rows, currency=parsed.currency)

        self.assertEqual(analysis["totals"]["income"], 1850.0)
        self.assertEqual(analysis["totals"]["spent"], 61.98)
        self.assertEqual(analysis["transaction_count"], 4)

        categories = {row["category"]: row["spent"] for row in analysis["categories"]}
        self.assertEqual(categories["subscriptions"], 21.98)
        self.assertEqual(categories["groceries"], 40.0)

        recurring = {row["merchant"] for row in analysis["recurring"]}
        self.assertIn("Netflix Com", recurring)

        # Two calendar months present -> two points in the trend series.
        self.assertEqual(len(analysis["monthly"]), 2)

    def test_ai_context_excludes_merchant_names(self):
        parsed = parse_statement(BARCLAYS_CSV.encode())
        analysis = statement_analysis.analyze(parsed.rows, currency=parsed.currency)
        context = statement_analysis.redacted_context_for_ai(analysis)
        blob = str(context).lower()
        self.assertNotIn("sainsburys", blob)
        self.assertNotIn("tfl", blob)
        self.assertIn("categories", context)


def _upload(client, url, content: bytes, name="statement.csv"):
    from django.core.files.uploadedfile import SimpleUploadedFile

    return client.post(
        url,
        {"file": SimpleUploadedFile(name, content, content_type="text/csv")},
        format="multipart",
    )


class StatementApiTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user("csvuser", "csv@example.com", "pw12345!")
        self.client = APIClient()
        self.client.force_authenticate(self.user)
        self.preview_url = reverse("budgeting-statement-preview")
        self.commit_url = reverse("budgeting-statement-commit")

    def test_preview_is_free_and_persists_nothing(self):
        res = _upload(self.client, self.preview_url, REVOLUT_CSV.encode())
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data["bank"]["slug"], "revolut")
        self.assertEqual(res.data["row_count"], 3)
        self.assertIn("analysis", res.data)
        self.assertFalse(res.data["allowance"]["is_paid"])
        self.assertEqual(Transaction.objects.filter(user=self.user).count(), 0)

    def test_commit_persists_transactions_and_is_idempotent(self):
        first = _upload(self.client, self.commit_url, REVOLUT_CSV.encode())
        self.assertEqual(first.status_code, 201)
        self.assertEqual(first.data["import"]["created_count"], 3)
        self.assertEqual(Transaction.objects.filter(user=self.user).count(), 3)

        # Re-uploading the same statement must not duplicate rows.
        second = _upload(self.client, self.commit_url, REVOLUT_CSV.encode())
        self.assertEqual(second.status_code, 201)
        self.assertEqual(second.data["import"]["created_count"], 0)
        self.assertEqual(second.data["import"]["duplicate_count"], 3)
        self.assertEqual(Transaction.objects.filter(user=self.user).count(), 3)

    def test_free_saves_run_out_then_return_upgrade(self):
        with self.settings(BUDGETING_FREE_STATEMENT_IMPORTS=1):
            first = _upload(self.client, self.commit_url, REVOLUT_CSV.encode())
            self.assertEqual(first.status_code, 201)
            self.assertEqual(first.data["allowance"]["free_saves_remaining"], 0)

            blocked = _upload(self.client, self.commit_url, BARCLAYS_CSV.encode())
            self.assertEqual(blocked.status_code, 402)
            self.assertEqual(blocked.data["reason"], "upgrade")

            # Analysis stays available after the saves are gone — that's the pitch.
            preview = _upload(self.client, self.preview_url, BARCLAYS_CSV.encode())
            self.assertEqual(preview.status_code, 200)

    def test_revert_deletes_the_transactions_it_created(self):
        created = _upload(self.client, self.commit_url, BT_CSV.encode())
        import_id = created.data["import"]["id"]
        self.assertEqual(Transaction.objects.filter(user=self.user).count(), 3)

        res = self.client.delete(f"/api/budgeting/statements/{import_id}/")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data["deleted"], 3)
        self.assertEqual(Transaction.objects.filter(user=self.user).count(), 0)
        self.assertEqual(
            StatementImport.objects.get(id=import_id).status,
            StatementImport.Status.REVERTED,
        )

    def test_row_limit_is_enforced_for_free_plan(self):
        header = "Date,Description,Amount\n"
        rows = "".join(f"2026-07-01,SHOP {i},-1.00\n" for i in range(50))
        with self.settings(BUDGETING_FREE_STATEMENT_ROWS=10):
            res = _upload(self.client, self.preview_url, (header + rows).encode())
            self.assertEqual(res.status_code, 200)
            self.assertEqual(res.data["row_count"], 10)
            self.assertTrue(any("first 10" in w for w in res.data["warnings"]))

    def test_oversized_file_is_rejected(self):
        payload = b"Date,Description,Amount\n" + b"2026-07-01,SHOP,-1.00\n" * 5000
        with self.settings(BUDGETING_FREE_STATEMENT_BYTES=1024):
            res = _upload(self.client, self.preview_url, payload)
            self.assertEqual(res.status_code, 413)

    def test_other_users_import_is_not_visible(self):
        created = _upload(self.client, self.commit_url, BT_CSV.encode())
        import_id = created.data["import"]["id"]

        intruder = User.objects.create_user("nosy", "nosy@example.com", "pw12345!")
        client = APIClient()
        client.force_authenticate(intruder)
        self.assertEqual(client.get(f"/api/budgeting/statements/{import_id}/").status_code, 404)
        self.assertEqual(client.delete(f"/api/budgeting/statements/{import_id}/").status_code, 404)
        self.assertEqual(Transaction.objects.filter(user=self.user).count(), 3)

    def test_pasted_text_is_accepted_like_a_file(self):
        """Mobile builds without a native file picker post the CSV as text."""
        res = self.client.post(
            self.preview_url,
            {"text": REVOLUT_CSV, "filename": "pasted.csv"},
            format="multipart",
        )
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data["bank"]["slug"], "revolut")
        self.assertEqual(res.data["row_count"], 3)
        self.assertEqual(Transaction.objects.filter(user=self.user).count(), 0)

        committed = self.client.post(self.commit_url, {"text": REVOLUT_CSV}, format="multipart")
        self.assertEqual(committed.status_code, 201)
        self.assertEqual(committed.data["import"]["created_count"], 3)

    def test_pasted_text_respects_the_size_limit(self):
        payload = "Date,Description,Amount\n" + ("2026-07-01,SHOP,-1.00\n" * 5000)
        with self.settings(BUDGETING_FREE_STATEMENT_BYTES=1024):
            res = self.client.post(self.preview_url, {"text": payload}, format="multipart")
            self.assertEqual(res.status_code, 413)

    def test_empty_request_explains_both_options(self):
        res = self.client.post(self.preview_url, {}, format="multipart")
        self.assertEqual(res.status_code, 400)
        self.assertEqual(res.data["error"], "no_file")

    def test_requires_authentication(self):
        client = APIClient()
        res = _upload(client, self.preview_url, REVOLUT_CSV.encode())
        self.assertIn(res.status_code, (401, 403))

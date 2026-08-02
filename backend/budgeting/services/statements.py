"""
Bank statement (CSV) parsing.

Turns an uploaded statement from any of the banks our users actually have
(Revolut, Barclays, Monzo, Starling, Banca Transilvania, ING RO, BCR, …) into
the internal :class:`budgeting.models.Transaction` shape without needing an
open-banking licence.

Design notes
------------
* **Nothing touches disk.** The uploaded bytes are decoded, parsed and thrown
  away. Only normalised rows are ever persisted.
* **Header mapping is score-based**, not a per-bank hardcode. Known dialects
  only supply hints and a display name — an unknown bank still parses as long
  as it has a date, a description and an amount (or debit/credit pair).
* **Sign convention** matches ``Transaction``: negative = outflow, positive =
  inflow. Statements disagree wildly on this; :func:`_resolve_amounts` is the
  single place that decides.
* **Redaction happens at parse time** so a PAN or IBAN pasted into a memo field
  never reaches the database, the AI layer, or a log line.
"""

from __future__ import annotations

import csv
import io
import re
from dataclasses import dataclass, field
from datetime import date, datetime
from decimal import Decimal, InvalidOperation
from typing import Dict, List, Optional, Sequence, Tuple

# ---------------------------------------------------------------------------
# Limits (also enforced at the view layer before we get here)
# ---------------------------------------------------------------------------

MAX_PREVIEW_ROWS = 5000
SNIFF_BYTES = 8192
HEADER_SCAN_LINES = 15

ENCODINGS = ("utf-8-sig", "utf-8", "cp1252", "iso-8859-2", "latin-1")
DELIMITERS = (",", ";", "\t", "|")


class StatementParseError(Exception):
    """Raised when a file cannot be understood at all."""

    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.code = code
        self.message = message


# ---------------------------------------------------------------------------
# Redaction
# ---------------------------------------------------------------------------

# 13-19 digits, optionally space/dash grouped: card PANs.
_PAN_RE = re.compile(r"\b(?:\d[ -]?){12,18}\d\b")
# IBAN: 2 letters + 2 digits + up to 30 alphanumerics.
_IBAN_RE = re.compile(r"\b[A-Z]{2}\d{2}[A-Z0-9]{10,30}\b")
# Long digit runs that are not obviously amounts (account numbers, sort codes).
_LONG_DIGITS_RE = re.compile(r"\b\d{9,}\b")


def redact(text: str) -> str:
    """Strip anything that looks like a card number, IBAN or account number.

    Applied to every free-text field before persistence. Deliberately
    aggressive: a mangled merchant string is cheaper than storing a PAN.
    """
    if not text:
        return ""
    out = _IBAN_RE.sub("[account]", text)
    out = _PAN_RE.sub("[card]", out)
    out = _LONG_DIGITS_RE.sub("[number]", out)
    return " ".join(out.split())[:256]


# ---------------------------------------------------------------------------
# Column aliases
# ---------------------------------------------------------------------------

# Each canonical field maps to substrings we look for in a normalised header.
# Earlier entries within a field score higher, and fields are resolved in
# declaration order against a shared pool of headers — so ``debit``/``credit``
# are declared before ``amount``, otherwise the generic "suma"/"paid out"
# aliases would swallow a "Suma debit" column and lose the pairing.
COLUMN_ALIASES: Dict[str, Sequence[str]] = {
    "date": (
        "completed date",
        "transaction date",
        "date of transaction",
        "booking date",
        "value date",
        "data tranzactiei",
        "data inregistrarii",
        "data procesarii",
        "data valuta",
        "posted",
        "date",
        "data",
    ),
    "description": (
        "description",
        "counter party",
        "counterparty",
        "merchant",
        "payee",
        "name",
        "narrative",
        "details",
        "detalii tranzactie",
        "detalii",
        "descriere",
        "explicatii",
        "beneficiar",
        "reference",
        "memo",
    ),
    "debit": ("suma debit", "debit amount", "paid out", "money out", "debit"),
    "credit": ("suma credit", "credit amount", "paid in", "money in", "credit"),
    "amount": (
        "amount (gbp)",
        "amount (eur)",
        "amount (ron)",
        "amount",
        "suma",
        "valoare",
        "value",
    ),
    "currency": ("currency", "valuta", "moneda", "ccy"),
    "balance": ("balance", "sold", "running balance"),
    "category": ("category", "spending category", "categorie", "type of transaction"),
    "kind": ("type", "tip", "dc", "debit/credit", "transaction type"),
    "state": ("state", "status", "stare"),
}

# Fields where a *shorter* alias should not beat a longer, more specific one.
_AMBIGUOUS = {"amount", "date", "data", "name", "type", "reference"}


@dataclass(frozen=True)
class Dialect:
    """A recognised bank export. Only affects labelling and a few quirks."""

    slug: str
    label: str
    # Header fragments that, if all present, identify this bank.
    signature: Sequence[str]
    # Rows to drop, e.g. Revolut's reverted/pending states.
    drop_states: Sequence[str] = ()
    default_currency: str = ""


DIALECTS: Sequence[Dialect] = (
    Dialect(
        slug="revolut",
        label="Revolut",
        signature=("type", "product", "started date", "completed date", "amount"),
        drop_states=("reverted", "declined", "failed"),
    ),
    Dialect(
        slug="monzo",
        label="Monzo",
        signature=("transaction id", "date", "type", "name", "amount"),
    ),
    Dialect(
        slug="starling",
        label="Starling",
        signature=("counter party", "reference", "spending category"),
        default_currency="GBP",
    ),
    Dialect(
        slug="barclays",
        label="Barclays",
        signature=("number", "date", "account", "amount", "memo"),
        default_currency="GBP",
    ),
    Dialect(
        slug="banca-transilvania",
        label="Banca Transilvania",
        signature=("data", "descriere"),
        default_currency="RON",
    ),
    Dialect(
        slug="ing-ro",
        label="ING Romania",
        signature=("data", "detalii tranzactie"),
        default_currency="RON",
    ),
)


# ---------------------------------------------------------------------------
# Parsed output
# ---------------------------------------------------------------------------


@dataclass
class ParsedRow:
    posted_at: date
    amount: Decimal
    currency: str
    description: str
    merchant_name: str = ""
    raw_category: str = ""
    fingerprint: str = ""


@dataclass
class ParsedStatement:
    rows: List[ParsedRow]
    dialect_slug: str
    dialect_label: str
    currency: str
    column_map: Dict[str, str]
    total_rows_seen: int = 0
    skipped_rows: int = 0
    warnings: List[str] = field(default_factory=list)

    @property
    def period_start(self) -> Optional[date]:
        return min((r.posted_at for r in self.rows), default=None)

    @property
    def period_end(self) -> Optional[date]:
        return max((r.posted_at for r in self.rows), default=None)


# ---------------------------------------------------------------------------
# Decoding & dialect sniffing
# ---------------------------------------------------------------------------


def decode(raw: bytes) -> str:
    """Decode statement bytes, trying the encodings European banks actually use."""
    if raw[:4] in (b"PK\x03\x04",):
        raise StatementParseError(
            "unsupported_format",
            "That looks like an Excel or ZIP file. Export as CSV and try again.",
        )
    if raw[:5] == b"%PDF-":
        raise StatementParseError(
            "unsupported_format",
            "PDF statements can't be read yet. Export as CSV and try again.",
        )
    for enc in ENCODINGS:
        try:
            return raw.decode(enc)
        except UnicodeDecodeError:
            continue
    raise StatementParseError("undecodable", "Could not read that file as text.")


def _sniff_delimiter(sample: str) -> str:
    try:
        return csv.Sniffer().sniff(sample[:SNIFF_BYTES], delimiters="".join(DELIMITERS)).delimiter
    except csv.Error:
        # Sniffer gives up on short or ragged files — fall back to whichever
        # candidate appears most often in the first few lines.
        head = "\n".join(sample.splitlines()[:HEADER_SCAN_LINES])
        counts = {d: head.count(d) for d in DELIMITERS}
        best = max(counts, key=lambda d: counts[d])
        return best if counts[best] else ","


def _normalise_header(value: str) -> str:
    return " ".join(str(value or "").strip().lower().replace("_", " ").split())


def _find_header_row(rows: Sequence[Sequence[str]]) -> int:
    """Return the index of the most header-like row in the first N lines.

    Barclays and several Romanian exports prepend account metadata before the
    real header, so we cannot assume row 0.
    """
    best_idx, best_score = 0, -1
    for idx, row in enumerate(rows[:HEADER_SCAN_LINES]):
        cells = [_normalise_header(c) for c in row if str(c).strip()]
        if len(cells) < 2:
            continue
        score = 0
        for field_name, aliases in COLUMN_ALIASES.items():
            if any(any(a in cell for a in aliases) for cell in cells):
                score += 2 if field_name in ("date", "description", "amount") else 1
        # Headers are text, not numbers.
        numeric = sum(1 for c in cells if re.fullmatch(r"[-+\d.,\s]+", c))
        score -= numeric
        if score > best_score:
            best_idx, best_score = idx, score
    if best_score <= 0:
        raise StatementParseError(
            "no_header",
            "Couldn't find a header row. Make sure the CSV includes column names.",
        )
    return best_idx


def _map_columns(header: Sequence[str]) -> Dict[str, str]:
    """Map canonical field -> actual header name, best match wins."""
    normalised = [(_normalise_header(h), h) for h in header]
    mapping: Dict[str, str] = {}
    taken: set = set()
    for field_name, aliases in COLUMN_ALIASES.items():
        best: Optional[Tuple[int, str]] = None
        for norm, original in normalised:
            if not norm or original in taken:
                continue
            for rank, alias in enumerate(aliases):
                if alias == norm:
                    score = 1000 - rank
                elif alias in norm:
                    # A generic alias inside a longer header is a weak signal.
                    score = (500 - rank) - (100 if alias in _AMBIGUOUS else 0)
                else:
                    continue
                if best is None or score > best[0]:
                    best = (score, original)
                break
        if best is not None:
            mapping[field_name] = best[1]
            taken.add(best[1])
    return mapping


def _detect_dialect(header: Sequence[str]) -> Optional[Dialect]:
    cells = {_normalise_header(h) for h in header}
    for dialect in DIALECTS:
        if all(any(sig in cell for cell in cells) for sig in dialect.signature):
            return dialect
    return None


# ---------------------------------------------------------------------------
# Value coercion
# ---------------------------------------------------------------------------

_DATE_FORMATS = (
    "%Y-%m-%d",
    "%d/%m/%Y",
    "%d.%m.%Y",
    "%d-%m-%Y",
    "%m/%d/%Y",
    "%Y/%m/%d",
    "%d %b %Y",
    "%d %B %Y",
    "%b %d, %Y",
)


def parse_date(value: str) -> Optional[date]:
    """Parse a statement date, tolerating an appended time component.

    Ambiguous ``dd/mm`` vs ``mm/dd`` is resolved day-first (UK + RO exports);
    the US ordering is only tried when day-first is impossible.
    """
    text = str(value or "").strip()
    if not text:
        return None
    text = text.replace("T", " ").split(" ")[0].strip()
    if not text:
        return None
    for fmt in _DATE_FORMATS:
        try:
            return datetime.strptime(text, fmt).date()
        except ValueError:
            continue
    try:  # ISO with offset, e.g. 2026-07-03T10:15:00+01:00
        return datetime.fromisoformat(str(value).strip()).date()
    except (ValueError, TypeError):
        return None


_AMOUNT_CLEAN_RE = re.compile(r"[^\d,.\-+()]")


def parse_amount(value: str) -> Optional[Decimal]:
    """Parse UK (``1,234.56``) and continental (``1.234,56``) amounts.

    Handles currency symbols, thin spaces, trailing ``CR``/``DB`` markers and
    accountant parentheses for negatives.
    """
    text = str(value or "").strip()
    if not text:
        return None
    lowered = text.lower()
    trailing_credit = lowered.endswith(("cr", "credit"))
    trailing_debit = lowered.endswith(("db", "dr", "debit"))
    cleaned = _AMOUNT_CLEAN_RE.sub("", text)
    if not cleaned:
        return None
    negative = cleaned.startswith("-") or ("(" in cleaned and ")" in cleaned)
    cleaned = cleaned.replace("(", "").replace(")", "").lstrip("+-")
    if not cleaned:
        return None

    has_comma = "," in cleaned
    has_dot = "." in cleaned
    if has_comma and has_dot:
        # Whichever separator comes last is the decimal one.
        if cleaned.rfind(",") > cleaned.rfind("."):
            cleaned = cleaned.replace(".", "").replace(",", ".")
        else:
            cleaned = cleaned.replace(",", "")
    elif has_comma or has_dot:
        sep = "," if has_comma else "."
        head, _, tail = cleaned.rpartition(sep)
        # Statement amounts carry 0 or 2 decimals, so exactly 3 trailing digits
        # means thousands grouping ("1.234" and "1,234" are both 1234).
        if len(tail) == 3 and tail.isdigit():
            cleaned = head.replace(sep, "") + tail
        else:
            cleaned = head.replace(sep, "") + "." + tail
    try:
        amount = Decimal(cleaned)
    except (InvalidOperation, ValueError):
        return None
    if negative or trailing_debit:
        amount = -abs(amount)
    elif trailing_credit:
        amount = abs(amount)
    return amount


_CURRENCY_SYMBOLS = {"£": "GBP", "€": "EUR", "$": "USD", "lei": "RON", "ron": "RON"}


def _currency_from(value: str, header: str = "") -> str:
    text = str(value or "").strip().upper()
    if len(text) == 3 and text.isalpha():
        return text
    for symbol, code in _CURRENCY_SYMBOLS.items():
        if symbol.upper() in text or symbol.upper() in header.upper():
            return code
    match = re.search(r"\(([A-Z]{3})\)", header or "")
    return match.group(1) if match else ""


_DEBIT_MARKERS = {"debit", "db", "dr", "d", "out", "withdrawal", "plata", "iesire"}
_CREDIT_MARKERS = {"credit", "cr", "c", "in", "deposit", "incasare", "intrare"}


def _resolve_amounts(
    raw: Dict[str, str],
    column_map: Dict[str, str],
) -> Optional[Decimal]:
    """Produce a signed amount for one row (negative = money out)."""
    debit_col = column_map.get("debit")
    credit_col = column_map.get("credit")
    amount_col = column_map.get("amount")

    # Separate debit/credit columns (Banca Transilvania, Barclays business).
    # Only trust this shape when the two columns are genuinely different —
    # "paid out"/"paid in" can both alias onto a single "amount" header.
    if debit_col and credit_col and debit_col != credit_col:
        debit = parse_amount(raw.get(debit_col, ""))
        credit = parse_amount(raw.get(credit_col, ""))
        if debit:
            return -abs(debit)
        if credit:
            return abs(credit)
        return None

    if not amount_col:
        return None
    amount = parse_amount(raw.get(amount_col, ""))
    if amount is None:
        return None

    # Unsigned amount plus a separate debit/credit marker column.
    kind_col = column_map.get("kind")
    if kind_col and amount > 0:
        marker = _normalise_header(raw.get(kind_col, ""))
        if marker in _DEBIT_MARKERS:
            return -amount
        if marker in _CREDIT_MARKERS:
            return amount
    return amount


def _fingerprint(row: ParsedRow) -> str:
    """Stable per-row identity used for deduplication across re-uploads.

    Deliberately excludes the source file, so re-importing an overlapping
    statement updates rather than duplicates.
    """
    import hashlib

    seed = f"{row.posted_at.isoformat()}|{row.amount}|{row.currency}|{row.description.lower()}"
    return "csv_" + hashlib.sha256(seed.encode("utf-8")).hexdigest()[:40]


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------


def parse_statement(raw: bytes, max_rows: int = MAX_PREVIEW_ROWS) -> ParsedStatement:
    """Parse statement bytes into normalised rows.

    Raises :class:`StatementParseError` when the file has no usable header or
    yields no rows at all; individual bad rows are skipped and counted instead.
    """
    text = decode(raw)
    if not text.strip():
        raise StatementParseError("empty_file", "That file is empty.")

    delimiter = _sniff_delimiter(text)
    all_rows = list(csv.reader(io.StringIO(text), delimiter=delimiter))
    all_rows = [r for r in all_rows if any(str(c).strip() for c in r)]
    if not all_rows:
        raise StatementParseError("empty_file", "That file has no rows.")

    header_idx = _find_header_row(all_rows)
    header = [str(h).strip() for h in all_rows[header_idx]]
    column_map = _map_columns(header)
    dialect = _detect_dialect(header)

    if "date" not in column_map:
        raise StatementParseError("no_date_column", "Couldn't find a date column.")
    if "amount" not in column_map and not ("debit" in column_map and "credit" in column_map):
        raise StatementParseError("no_amount_column", "Couldn't find an amount column.")

    warnings: List[str] = []
    rows: List[ParsedRow] = []
    skipped = 0
    seen = 0
    truncated = False

    default_currency = dialect.default_currency if dialect else ""
    amount_header = column_map.get("amount", "")
    header_currency = _currency_from("", amount_header) or default_currency

    for data_row in all_rows[header_idx + 1 :]:
        seen += 1
        if len(rows) >= max_rows:
            truncated = True
            break
        raw_map = {
            header[i]: (data_row[i] if i < len(data_row) else "")
            for i in range(min(len(header), len(data_row)))
        }
        if not raw_map:
            skipped += 1
            continue

        if dialect and dialect.drop_states and column_map.get("state"):
            state = _normalise_header(raw_map.get(column_map["state"], ""))
            if state in dialect.drop_states:
                skipped += 1
                continue

        posted_at = parse_date(raw_map.get(column_map["date"], ""))
        amount = _resolve_amounts(raw_map, column_map)
        if posted_at is None or amount is None or amount == 0:
            skipped += 1
            continue

        description = redact(raw_map.get(column_map.get("description", ""), ""))
        if not description:
            description = redact(raw_map.get(column_map.get("category", ""), "")) or "Transaction"

        currency = (
            _currency_from(raw_map.get(column_map.get("currency", ""), "")) or header_currency or ""
        )

        rows.append(
            ParsedRow(
                posted_at=posted_at,
                amount=amount,
                currency=currency,
                description=description,
                raw_category=redact(raw_map.get(column_map.get("category", ""), ""))[:128],
            )
        )

    if not rows:
        raise StatementParseError(
            "no_transactions",
            "No transactions could be read from that file. Check it's a statement export.",
        )

    if truncated:
        warnings.append(f"Only the first {max_rows} transactions were read.")
    if skipped:
        warnings.append(f"{skipped} row(s) were skipped because they had no usable date or amount.")

    # A statement where every amount is positive almost always means an
    # unsigned "spending" export. Flip it, and say so.
    if all(r.amount > 0 for r in rows) and "credit" not in column_map:
        for row in rows:
            row.amount = -row.amount
        warnings.append(
            "All amounts were positive, so they were read as money out. "
            "Check the totals below before saving."
        )

    currencies = {r.currency for r in rows if r.currency}
    dominant = ""
    if currencies:
        dominant = max(currencies, key=lambda c: sum(1 for r in rows if r.currency == c))
        if len(currencies) > 1:
            warnings.append(
                f"This statement mixes {len(currencies)} currencies; totals are shown in {dominant}."
            )
    for row in rows:
        if not row.currency:
            row.currency = dominant
        row.fingerprint = _fingerprint(row)

    return ParsedStatement(
        rows=rows,
        dialect_slug=dialect.slug if dialect else "generic",
        dialect_label=dialect.label if dialect else "Generic CSV",
        currency=dominant,
        column_map=column_map,
        total_rows_seen=seen,
        skipped_rows=skipped,
        warnings=warnings,
    )

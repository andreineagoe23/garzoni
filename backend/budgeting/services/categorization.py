"""
Merchant normalisation and rule-based categorisation for UK and Romanian
statement lines.

This runs entirely locally. No transaction text is sent to an LLM — the AI
layer only ever sees the category totals this module produces. That is both a
privacy requirement (see ``docs/banking/open-banking-plan.md``) and cheaper.

Statement descriptions are hostile: ``CARD PAYMENT TO TESCO STORES 3428 ON
02 AUG``, ``SumUp *CAFENEAUA``, ``REVOLUT**1234*``, ``PLATA LA POS MEGA IMAGE
BUCURESTI``. :func:`normalise_merchant` strips the noise; :func:`categorize`
matches the result against keyword rules.
"""

from __future__ import annotations

import re
from typing import Dict, Iterable, List, Optional, Sequence, Tuple

from budgeting.models import TransactionCategory

# ---------------------------------------------------------------------------
# Taxonomy — slugs align with the presets offered in the Budget Planner UI.
# ---------------------------------------------------------------------------

CATEGORY_LABELS: Dict[str, str] = {
    "groceries": "Groceries",
    "eating_out": "Eating out",
    "transport": "Transport",
    "fuel": "Fuel",
    "housing": "Housing",
    "utilities": "Utilities",
    "phone_internet": "Phone & internet",
    "shopping": "Shopping",
    "entertainment": "Entertainment",
    "subscriptions": "Subscriptions",
    "health": "Health",
    "education": "Education",
    "travel": "Travel",
    "insurance": "Insurance",
    "fees_interest": "Fees & interest",
    "savings": "Savings & investments",
    "cash": "Cash withdrawals",
    "transfers": "Transfers",
    "gambling": "Gambling",
    "income": "Income",
    "other": "Other",
}

INCOME_CATEGORIES = {"income"}
TRANSFER_CATEGORIES = {"transfers", "savings"}

# ---------------------------------------------------------------------------
# Description cleanup
# ---------------------------------------------------------------------------

# Payment-rail prefixes that carry no merchant information.
_NOISE_PREFIXES = (
    "card payment to",
    "card payment",
    "payment to",
    "direct debit",
    "standing order",
    "faster payment",
    "bank giro credit",
    "bill payment to",
    "pos ",
    "plata la pos",
    "plata pos",
    "cumparare pos",
    "tranzactie pos",
    "transfer catre",
    "transfer de la",
    "debit card purchase",
    "visa purchase",
    "mastercard purchase",
    "contactless",
)

# Payment facilitators that prefix the real merchant name.
_FACILITATORS = ("sumup", "paypal", "izettle", "zettle", "square", "stripe", "sq")

# Trailing junk: dates, terminal ids, city codes, currency conversions.
_TRAILING_NOISE = re.compile(
    r"\b("
    r"on \d{1,2}\s*\w{3}(\s*\d{2,4})?"
    r"|\d{1,2}[/.]\d{1,2}([/.]\d{2,4})?"
    r"|ref[: ].*"
    r"|\d{2}:\d{2}(:\d{2})?"
    r"|[a-z]{2}\d{4,}"
    r")\b",
    re.IGNORECASE,
)

_SEPARATORS = re.compile(r"[*_/\\|]+")
_MULTISPACE = re.compile(r"\s+")
_DIACRITICS = str.maketrans("ăâîșşțţĂÂÎȘŞȚŢ", "aaissttAAISSTT")


def normalise_merchant(description: str) -> str:
    """Reduce a raw statement line to a comparable merchant name.

    ``"CARD PAYMENT TO TESCO STORES 3428 ON 02 AUG"`` -> ``"tesco stores"``
    ``"SumUp *CAFENEAUA VECHE"``                      -> ``"cafeneaua veche"``
    """
    text = (description or "").strip().lower().translate(_DIACRITICS)
    if not text:
        return ""
    text = _SEPARATORS.sub(" ", text)
    text = text.replace("[card]", " ").replace("[account]", " ").replace("[number]", " ")

    for prefix in _NOISE_PREFIXES:
        if text.startswith(prefix):
            text = text[len(prefix) :]
            break

    parts = _MULTISPACE.sub(" ", text).strip().split(" ")
    if parts and parts[0] in _FACILITATORS and len(parts) > 1:
        parts = parts[1:]
    text = " ".join(parts)

    text = _TRAILING_NOISE.sub(" ", text)
    text = re.sub(r"[^a-z0-9&' ]+", " ", text)
    # Drop bare number groups left behind by terminal ids, while keeping short
    # numbers that are part of a brand ("Trading 212", "5 to go").
    text = " ".join(p for p in text.split() if not p.isdigit() or len(p) <= 3)
    return _MULTISPACE.sub(" ", text).strip()[:64]


def display_merchant(description: str) -> str:
    """Title-cased merchant name for the UI. Falls back to the raw line."""
    merchant = normalise_merchant(description)
    if not merchant:
        return (description or "").strip()[:64]
    return " ".join(word.capitalize() for word in merchant.split())[:64]


# ---------------------------------------------------------------------------
# Rules
# ---------------------------------------------------------------------------

# (category slug, keywords). First match wins, so order from specific to broad.
RULES: Sequence[Tuple[str, Sequence[str]]] = (
    (
        "groceries",
        (
            "tesco",
            "sainsbury",
            "asda",
            "aldi",
            "lidl",
            "morrison",
            "waitrose",
            "co op",
            "coop",
            "iceland",
            "ocado",
            "marks and spencer",
            "m&s food",
            "budgens",
            "spar",
            "costcutter",
            "mega image",
            "kaufland",
            "carrefour",
            "profi",
            "penny",
            "auchan",
            "selgros",
            "metro cash",
            "la doi pasi",
            "supeco",
            "cora",
            "grocer",
            "supermarket",
            "alimentara",
        ),
    ),
    (
        "eating_out",
        (
            "restaurant",
            "cafe",
            "coffee",
            "costa",
            "pret a manger",
            "greggs",
            "starbucks",
            "nando",
            "wagamama",
            "mcdonald",
            "burger king",
            "kfc",
            "subway",
            "domino",
            "pizza",
            "deliveroo",
            "uber eats",
            "just eat",
            "glovo",
            "tazz",
            "bolt food",
            "bistro",
            "pub",
            "bar ",
            "cofetarie",
            "patiserie",
            "shaormerie",
            "5 to go",
            "ted's coffee",
        ),
    ),
    (
        "transport",
        (
            "tfl",
            "transport for london",
            "trainline",
            "national rail",
            "lner",
            "gwr",
            "northern rail",
            "stagecoach",
            "arriva",
            "megabus",
            "uber",
            "bolt",
            "free now",
            "taxi",
            "cab ",
            "stb",
            "metrorex",
            "cfr",
            "ratb",
            "24pay",
            "parking",
            "parcare",
            "dart charge",
            "congestion charge",
        ),
    ),
    (
        "fuel",
        (
            "shell",
            "bp ",
            "esso",
            "texaco",
            "petrol",
            "fuel",
            "gulf",
            "omv",
            "petrom",
            "mol ",
            "rompetrol",
            "lukoil",
            "socar",
            "benzin",
            "ev charge",
            "pod point",
            "instavolt",
        ),
    ),
    (
        "housing",
        (
            "rent",
            "chirie",
            "mortgage",
            "ipoteca",
            "council tax",
            "letting",
            "estate agent",
            "asociatia de proprietari",
            "landlord",
            "housing",
        ),
    ),
    (
        "utilities",
        (
            "british gas",
            "octopus energy",
            "eon",
            "e on",
            "edf",
            "ovo energy",
            "scottish power",
            "sse",
            "bulb",
            "thames water",
            "severn trent",
            "united utilities",
            "anglian water",
            "enel",
            "electrica",
            "engie",
            "hidroelectrica",
            "apa nova",
            "distrigaz",
            "salubritate",
            "gas ",
            "electricity",
            "water bill",
            "energie",
            "gaze",
        ),
    ),
    (
        "phone_internet",
        (
            "vodafone",
            "ee ",
            "o2 ",
            "three ",
            "giffgaff",
            "sky",
            "virgin media",
            "bt group",
            "bt broadband",
            "plusnet",
            "talktalk",
            "orange",
            "telekom",
            "digi",
            "rcs rds",
            "upc",
            "mobile",
            "broadband",
        ),
    ),
    (
        "subscriptions",
        (
            "netflix",
            "spotify",
            "disney",
            "amazon prime",
            "apple com bill",
            "apple services",
            "itunes",
            "google one",
            "youtube premium",
            "hbo",
            "audible",
            "patreon",
            "substack",
            "adobe",
            "microsoft 365",
            "dropbox",
            "icloud",
            "openai",
            "chatgpt",
            "notion",
            "canva",
            "subscription",
            "abonament",
            "garzoni",
        ),
    ),
    (
        "entertainment",
        (
            "cinema",
            "odeon",
            "vue",
            "cineworld",
            "cinema city",
            "theatre",
            "ticketmaster",
            "eventim",
            "playstation",
            "xbox",
            "steam games",
            "nintendo",
            "gym",
            "puregym",
            "the gym",
            "world class",
            "fitness",
            "sala fitness",
            "concert",
            "festival",
        ),
    ),
    (
        "shopping",
        (
            "amazon",
            "ebay",
            "argos",
            "john lewis",
            "next retail",
            "primark",
            "h&m",
            "zara",
            "asos",
            "shein",
            "temu",
            "aliexpress",
            "ikea",
            "b&q",
            "screwfix",
            "currys",
            "boots",
            "superdrug",
            "emag",
            "altex",
            "dedeman",
            "leroy merlin",
            "jysk",
            "fashion days",
            "decathlon",
            "pepco",
            "action",
        ),
    ),
    (
        "health",
        (
            "pharmacy",
            "farmacia",
            "catena",
            "dona",
            "help net",
            "sensiblu",
            "nhs",
            "dentist",
            "dental",
            "optician",
            "specsavers",
            "vision express",
            "clinic",
            "clinica",
            "spital",
            "hospital",
            "regina maria",
            "medlife",
            "sanador",
            "medicover",
            "therapy",
            "bupa",
        ),
    ),
    (
        "education",
        (
            "university",
            "universitate",
            "student loan",
            "tuition",
            "course",
            "udemy",
            "coursera",
            "duolingo",
            "school",
            "scoala",
            "gradinita",
            "nursery",
            "childcare",
        ),
    ),
    (
        "travel",
        (
            "airbnb",
            "booking.com",
            "hotel",
            "hostel",
            "ryanair",
            "easyjet",
            "wizz air",
            "british airways",
            "tarom",
            "blue air",
            "lufthansa",
            "expedia",
            "skyscanner",
            "trainline eu",
            "flixbus",
            "ferry",
            "airport",
            "aeroport",
        ),
    ),
    (
        "insurance",
        (
            "insurance",
            "asigurar",
            "aviva",
            "axa",
            "direct line",
            "admiral",
            "hastings",
            "allianz",
            "groupama",
            "rca ",
            "casco",
        ),
    ),
    (
        "gambling",
        (
            "bet365",
            "betfair",
            "william hill",
            "ladbrokes",
            "paddy power",
            "sky bet",
            "superbet",
            "betano",
            "unibet",
            "casino",
            "lottery",
            "loteria",
            "poker",
        ),
    ),
    (
        "fees_interest",
        (
            "interest",
            "dobanda",
            "overdraft",
            "comision",
            "fee",
            "charge",
            "atm fee",
            "foreign transaction",
            "late payment",
        ),
    ),
    (
        "savings",
        (
            "savings",
            "economii",
            "vault",
            "isa ",
            "pension",
            "pensie",
            "investment",
            "investitii",
            "vanguard",
            "trading 212",
            "freetrade",
            "interactive investor",
            "hargreaves",
            "etoro",
            "coinbase",
            "binance",
            "revolut savings",
        ),
    ),
    (
        "cash",
        ("cash withdrawal", "atm", "bancomat", "retragere numerar", "link atm"),
    ),
    (
        "transfers",
        (
            "transfer",
            "wise",
            "transferwise",
            "remitly",
            "western union",
            "revolut",
            "monzo",
            "starling",
            "top-up",
            "topup",
            "alimentare cont",
            "to pot",
            "from pot",
            "internal transfer",
        ),
    ),
)

INCOME_KEYWORDS = (
    "salary",
    "salariu",
    "payroll",
    "wages",
    "hmrc",
    "anaf",
    "pension credit",
    "dividend",
    "refund",
    "rambursare",
    "cashback",
    "bonus",
    "stipend",
    "universal credit",
    "child benefit",
    "alocatie",
    "interest paid",
    "invoice",
    "factura incasata",
    "freelance",
)


def _compile_keywords(keywords: Sequence[str]) -> "re.Pattern[str]":
    """Word-boundary matcher for a keyword set.

    Plain substring matching is not safe here: ``"tfl"`` is inside
    ``"netflix"`` and ``"bar"`` is inside ``"barclays"``, which silently
    miscategorises common merchants.
    """
    parts = sorted({k.strip() for k in keywords if k.strip()}, key=len, reverse=True)
    return re.compile(r"\b(?:" + "|".join(re.escape(p) for p in parts) + r")\b")


_RULE_PATTERNS: Sequence[Tuple[str, "re.Pattern[str]"]] = tuple(
    (slug, _compile_keywords(keywords)) for slug, keywords in RULES
)
_INCOME_PATTERN = _compile_keywords(INCOME_KEYWORDS)


def categorize(description: str, amount, raw_category: str = "") -> str:
    """Return the internal category slug for one transaction line.

    ``amount`` follows the internal convention (negative = money out) and is
    the strongest signal available: an inflow matching an income keyword is
    income, an inflow matching nothing is still probably income.
    """
    merchant = normalise_merchant(description)
    haystack = f"{merchant} {(raw_category or '').lower()}".strip()
    is_inflow = amount is not None and amount > 0

    if is_inflow and _INCOME_PATTERN.search(haystack):
        return "income"

    for slug, pattern in _RULE_PATTERNS:
        if pattern.search(haystack):
            # A refund from a shop is still shopping, not income — but an
            # inflow matching a transfer/savings rule keeps that meaning.
            if is_inflow and slug not in TRANSFER_CATEGORIES:
                return slug
            return slug

    if is_inflow:
        return "income"
    return "other"


# ---------------------------------------------------------------------------
# Persistence helpers
# ---------------------------------------------------------------------------


def ensure_categories(slugs: Optional[Iterable[str]] = None) -> Dict[str, TransactionCategory]:
    """Get-or-create the ``TransactionCategory`` rows for ``slugs``.

    Called once per import rather than per row.
    """
    wanted: List[str] = sorted(set(slugs) if slugs else CATEGORY_LABELS.keys())
    existing = {c.slug: c for c in TransactionCategory.objects.filter(slug__in=wanted)}
    missing = [s for s in wanted if s not in existing]
    if missing:
        TransactionCategory.objects.bulk_create(
            [
                TransactionCategory(
                    slug=slug,
                    label=CATEGORY_LABELS.get(slug, slug.replace("_", " ").title()),
                    is_income=slug in INCOME_CATEGORIES,
                    is_transfer=slug in TRANSFER_CATEGORIES,
                )
                for slug in missing
            ],
            ignore_conflicts=True,
        )
        existing = {c.slug: c for c in TransactionCategory.objects.filter(slug__in=wanted)}
    return existing


def label_for(slug: str) -> str:
    return CATEGORY_LABELS.get(slug, (slug or "other").replace("_", " ").title())

"""
Reassign category for exercises (default: category="General") using regex rules on question text.

  docker compose exec backend python manage.py retag_general_exercises
  docker compose exec backend python manage.py retag_general_exercises --apply
  docker compose exec backend python manage.py retag_general_exercises --source-category General \\
      --export-csv /tmp/retag-plan.csv --show-rule-counts

If the backend image was built without this file, copy it in once:

  docker compose cp backend/education/management/commands/retag_general_exercises.py \\
    backend:/app/education/management/commands/retag_general_exercises.py
"""

from __future__ import annotations

import csv
import json
import re
from collections import Counter

from django.core.management.base import BaseCommand
from django.db import transaction

from education.models import Exercise

# (rule_name, pattern, category) — first match wins.
NAMED_RULES: list[tuple[str, re.Pattern[str], str]] = [
    (
        "lesson_crypto",
        re.compile(
            r"lesson.*cryptocurr|lesson.*bitcoin|lesson.*blockchain|"
            r"decentralized finance|\bde-fi\b",
            re.I,
        ),
        "Cryptocurrency",
    ),
    (
        "lesson_forex",
        re.compile(
            r"lesson.*forex|lesson.*currency pair|commom forex|lesson 3:.*forex",
            re.I,
        ),
        "Forex",
    ),
    ("lesson_budget", re.compile(r"lesson.*budget|budgeting for irregular", re.I), "Budgeting"),
    (
        "lesson_real_estate",
        re.compile(
            r"lesson.*real estate|analyzing property|commercial real estate",
            re.I,
        ),
        "Real Estate",
    ),
    (
        "lesson_investing",
        re.compile(
            r"lesson.*introduction to invest|lesson.*creating your investment|"
            r"lesson 5:.*invest",
            re.I,
        ),
        "Investing",
    ),
    ("lesson_credit", re.compile(r"lesson.*types of credit|lesson.*credit", re.I), "Basic Finance"),
    (
        "lesson_financial_goals",
        re.compile(
            r"lesson.*setting financial goal|lesson 3: setting financial",
            re.I,
        ),
        "Financial Planning",
    ),
    (
        "kw_forex",
        re.compile(
            r"forex|\beurusd\b|\bgbpjpy\b|currency pair|\bpips?\b|"
            r"currency exchange|exchange rate|leverage in forex|"
            r"candlestick|\bwick\b|revenge trading|trading journal",
            re.I,
        ),
        "Forex",
    ),
    (
        "kw_crypto",
        re.compile(
            r"\bbitcoin\b|\bethereum\b|\bbtc\b|\bcrypto\b|\bcryptocurr|stablecoin|"
            r"\bdefi\b|\bblockchain\b|\baltcoin\b|decentralized finance|"
            r"private key|seed phrase|smart contract|\bdex\b|use a dex",
            re.I,
        ),
        "Cryptocurrency",
    ),
    (
        "kw_real_estate",
        re.compile(
            r"\breit\b|real estate|mortgage|down payment|rental income|property value|"
            r"verifying income|sinking fund|from the rent",
            re.I,
        ),
        "Real Estate",
    ),
    (
        "kw_budgeting",
        re.compile(
            r"50/30/20|\bbudget\b|budgeting|allocate.*needs.*wants|needs/wants/savings|"
            r"discretionary|fixed expense|no-spend|lifestyle creep",
            re.I,
        ),
        "Budgeting",
    ),
    (
        "kw_investing",
        re.compile(
            r"\b401k\b|\b403b\b|\bira\b|\broth\b|mutual fund|\betf\b|\bstock\b|\bbond\b|"
            r"dividend|portfolio|diversif|bear market|bull market|dollar-cost|index fund|"
            r"asset allocation|risk and return|market cap|backtesting",
            re.I,
        ),
        "Investing",
    ),
    (
        "kw_personal_finance_savings",
        re.compile(
            r"emergency fund|rainy day|savings goal|savings account|"
            r"save £|save \$|per month for \d+ months|monthly income",
            re.I,
        ),
        "Personal Finance",
    ),
    (
        "kw_basic_finance",
        re.compile(
            r"credit score|credit report|\bfico\b|\bloan\b|\bdebt\b|"
            r"\bapr\b|compound interest|inflation|\bgdp\b|federal reserve",
            re.I,
        ),
        "Basic Finance",
    ),
    (
        "kw_insurance_estate",
        re.compile(
            r"insurance|life insurance|health insurance|\bpremium\b|deductible|"
            r"estate plan|last will|living will|trust fund",
            re.I,
        ),
        "Personal Finance",
    ),
    (
        "kw_tax",
        re.compile(
            r"\btax\b|\birs\b|withholding|deduction|capital gains tax",
            re.I,
        ),
        "Basic Finance",
    ),
    (
        "glossary_match",
        re.compile(
            r"match each finance term|drag.*term.*definition|finance term to its definition|"
            r"match each item to the correct definition",
            re.I,
        ),
        "Basic Finance",
    ),
    (
        "numeric_property_deposit",
        re.compile(
            r"house with a \d+% deposit|buy a .+house.+deposit|deposit\) do you need",
            re.I,
        ),
        "Real Estate",
    ),
    (
        "numeric_percent_recovery",
        re.compile(r"lose 50%|gain do you need on", re.I),
        "Basic Finance",
    ),
    (
        "numeric_invest_opportunity_cost",
        re.compile(r"invest that .+instead at|doubles in \d+", re.I),
        "Investing",
    ),
    (
        "financial_planning_catchall",
        re.compile(
            r"windfall|financial plan|financial goal|net worth|cash flow statement|"
            r"main goal of 'lesson|scarcity mindset|growth mindset|income drops|"
            r"automation better than willpower",
            re.I,
        ),
        "Financial Planning",
    ),
]

GENERIC_DRAG_DROP_QUESTION = "Match each item to the correct target."


def _infer_from_structured_data(data) -> tuple[str, str] | None:
    """When question text is empty or generic, infer topic from exercise_data JSON."""
    if not isinstance(data, dict):
        return None
    blob = json.dumps(data).lower()
    if "rug pull" in blob or "phishing" in blob:
        return "Cryptocurrency", "data_crypto_security"
    if "yield farming" in blob or "staking" in blob:
        return "Cryptocurrency", "data_crypto_defi"
    if "pre-market" in blob or "post-market" in blob:
        return "Investing", "data_market_hours"
    if "value spending" in blob or "wasteful spending" in blob:
        return "Budgeting", "data_spending_values"
    if "positive script" in blob or "negative script" in blob:
        return "Financial Planning", "data_money_scripts"
    if "short-term thinking" in blob or "long-term vision" in blob:
        return "Financial Planning", "data_time_horizon"
    if "rehab" in blob and "rent" in blob and "buy" in blob:
        return "Real Estate", "data_re_strategy"
    if "asset" in blob and "liability" in blob:
        return "Basic Finance", "data_balance_sheet_terms"
    return None


def infer_category_detail(question: str, exercise_data=None) -> tuple[str, str] | None:
    text = (question or "").strip()
    if text:
        for rule_name, pattern, category in NAMED_RULES:
            if pattern.search(text):
                return category, rule_name
    if not text or text == GENERIC_DRAG_DROP_QUESTION:
        inferred = _infer_from_structured_data(exercise_data)
        if inferred:
            return inferred
    return None


def infer_category(question: str, exercise_data=None) -> str | None:
    detail = infer_category_detail(question, exercise_data)
    return detail[0] if detail else None


class Command(BaseCommand):
    help = "Suggest or apply category retags using regex rules (default source category: General)"

    def add_arguments(self, parser):
        parser.add_argument(
            "--apply",
            action="store_true",
            help="Write changes to the database (default is dry-run)",
        )
        parser.add_argument(
            "--limit",
            type=int,
            default=0,
            help="Max exercises to process (0 = all in source category)",
        )
        parser.add_argument(
            "--source-category",
            type=str,
            default="General",
            help="Only process exercises with this category value (default: General)",
        )
        parser.add_argument(
            "--export-csv",
            type=str,
            default="",
            metavar="PATH",
            help="Write id,old_category,new_category,rule_name,question_preview to this path",
        )
        parser.add_argument(
            "--show-rule-counts",
            action="store_true",
            help="Print how many rows matched each rule (dry-run / before apply)",
        )

    def handle(self, *args, **options):
        apply_changes: bool = options["apply"]
        limit: int = options["limit"]
        source_cat: str = options["source_category"]
        export_path: str = options["export_csv"]
        show_rules: bool = options["show_rule_counts"]

        qs = Exercise.objects.filter(category=source_cat).order_by("id")
        if limit > 0:
            qs = qs[:limit]

        rows = list(qs)
        planned: list[tuple[int, str, str, str, str]] = []
        unmatched: list[tuple[int, str]] = []

        for ex in rows:
            detail = infer_category_detail(ex.question, ex.exercise_data)
            if detail:
                new_cat, rule_name = detail
                planned.append(
                    (
                        ex.id,
                        ex.category,
                        new_cat,
                        rule_name,
                        (ex.question or "")[:500],
                    )
                )
            else:
                unmatched.append((ex.id, (ex.question or "")[:80]))

        self.stdout.write(
            self.style.NOTICE(
                f"Source category {source_cat!r}: scanned {len(rows)} | "
                f"would retag: {len(planned)} | still unmatched: {len(unmatched)}"
            )
        )

        if show_rules and planned:
            ctr = Counter(p[3] for p in planned)
            self.stdout.write(self.style.NOTICE("\nMatches by rule:"))
            for name, count in ctr.most_common():
                self.stdout.write(f"  {name}: {count}")

        for row in planned[:35]:
            eid, old_c, new_c, rule_name, preview = row
            self.stdout.write(
                f"  id={eid} [{rule_name}] {old_c!r} -> {new_c!r}  ({preview[:80]!r}...)"
            )
        if len(planned) > 35:
            self.stdout.write(f"  ... {len(planned) - 35} more retags")

        if unmatched:
            self.stdout.write(self.style.WARNING("\nNo rule matched (sample):"))
            for eid, preview in unmatched[:12]:
                self.stdout.write(f"  id={eid} {preview!r}")
            if len(unmatched) > 12:
                self.stdout.write(f"  ... {len(unmatched) - 12} more unmatched")

        if export_path:
            with open(export_path, "w", newline="", encoding="utf-8") as fh:
                w = csv.writer(fh)
                w.writerow(["id", "old_category", "new_category", "rule_name", "question"])
                for row in planned:
                    w.writerow(row)
            self.stdout.write(self.style.SUCCESS(f"Wrote CSV plan: {export_path}"))

        if not apply_changes:
            self.stdout.write(
                self.style.NOTICE("\nDry-run only. Re-run with --apply to update rows.")
            )
            return

        if not planned:
            self.stdout.write(self.style.WARNING("Nothing to apply."))
            return

        id_to_cat = {p[0]: p[2] for p in planned}
        updated = 0
        with transaction.atomic():
            for ex in Exercise.objects.filter(id__in=id_to_cat.keys(), category=source_cat):
                ex.category = id_to_cat[ex.id]
                ex.save(update_fields=["category"])
                updated += 1

        self.stdout.write(self.style.SUCCESS(f"Updated {updated} exercises."))

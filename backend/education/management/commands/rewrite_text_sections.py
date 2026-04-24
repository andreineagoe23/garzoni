"""
Rewrite text LessonSections using OpenAI so they align with their
path / course / lesson context and the Garzoni authoring standards.

Default run — generate via OpenAI, apply to DB immediately, save JSON log:
    python manage.py rewrite_text_sections --batch-size 50

Dry-run — generate and save JSON for review, no DB writes:
    python manage.py rewrite_text_sections --dry-run --batch-size 10

Apply from a manually edited JSON file (skip OpenAI):
    python manage.py rewrite_text_sections --apply-from-file path/to/file.json

Full automated run (auto-skips sections already processed):
    python manage.py rewrite_text_sections --skip-processed --batch-size 100
"""

import hashlib
import json
import os
import re
import time
from datetime import datetime
from pathlib import Path

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError

from education.models import EducationAuditLog, LessonSection, LessonSectionTranslation

STANDARDS_PATH = Path(__file__).resolve().parents[2] / "content" / "lesson_authoring_standards.md"
DEFAULT_OUTPUT_DIR = Path(__file__).resolve().parents[2] / "content" / "rewrite_output"

# gpt-4o follows complex instructions precisely; gpt-4o-mini is faster/cheaper but drifts more.
# Override with OPENAI_REWRITE_MODEL env var.
OPENAI_MODEL = os.environ.get("OPENAI_REWRITE_MODEL", "gpt-4o")

# gpt-4o tier-1 limit is 500 RPM — 0.15s gap is more than enough.
# Increase if you hit rate limits.
REQUEST_DELAY = float(os.environ.get("OPENAI_REWRITE_DELAY", "0.2"))
MAX_RETRIES = 3

# -----------------------------------------------------------------------
# Few-shot examples embedded directly in the conversation.
# These show the model exactly what good output looks like.
# One example per problematic section type: plain content + key-takeaway style.
# -----------------------------------------------------------------------

FEW_SHOT_EXAMPLES = [
    # Example A — Overview section: clean definition, no hype, tight 2 paragraphs.
    {
        "user": (
            "PATH: Basic Finance\n"
            "COURSE: Understanding Income & Expenses\n"
            "LESSON: What Are Income and Expenses?\n"
            "SECTION TITLE: Overview\n"
            "SECTION SLOT: 1 of 9\n\n"
            "CURRENT CONTENT:\n"
            "<p>Income and expenses are the two fundamental building blocks of every single "
            "personal financial plan. Income is the total amount of money you receive from work, "
            "investments, or other sources. Expenses are the costs you pay for the things you need "
            "and want in your life. Understanding the balance between these two is the secret to "
            "managing your money effectively.</p>\n"
            "<p>To build wealth, your income must be consistently higher than your total monthly "
            "expenses over time. If your expenses are higher than your income, you are likely relying "
            "on debt to survive. Learning to define and categorize these two forces allows you to take "
            "charge of your future. This basic knowledge is the starting point for anyone looking to "
            "improve their financial health.</p>"
        ),
        "assistant": (
            "<p>Income and expenses are the foundation of personal finance. "
            "Income is the money you receive from work, investments, or other sources. "
            "Expenses are the costs of the things you need or choose to buy.</p>\n"
            "<p>When your income is consistently higher than your expenses, you can build wealth. "
            "When expenses exceed income, you rely on debt. "
            "Knowing how to define and separate these two is the starting point for managing your money.</p>"
        ),
    },
    # Example B — Key Takeaways: prose paragraphs, never bullets, sharp and direct.
    {
        "user": (
            "PATH: Basic Finance\n"
            "COURSE: Understanding Income & Expenses\n"
            "LESSON: Fixed vs. Variable Expenses\n"
            "SECTION TITLE: Key Takeaways\n"
            "SECTION SLOT: 7 of 9\n\n"
            "CURRENT CONTENT:\n"
            "<p>Fixed expenses drive your baseline cost of living, while variable expenses drive "
            "your short-term flexibility. Both must be managed to build a resilient budget. Large "
            "recurring savings often come from optimizing fixed costs, not only cutting small daily "
            "purchases.</p>\n"
            "<p>Tracking these categories separately makes your budget measurable and easier to "
            "improve. Once you know which costs are rigid and which are flexible, you can make "
            "decisions with less stress and better results.</p>"
        ),
        "assistant": (
            "<p>Fixed expenses set your baseline cost of living each month. "
            "Variable expenses are where your short-term flexibility lives. "
            "Managing both is what makes a budget resilient — and the biggest savings "
            "often come from reducing fixed costs, not just cutting small daily purchases.</p>\n"
            "<p>Tracking fixed and variable expenses separately makes your budget measurable. "
            "Once you can see which costs are rigid and which are flexible, "
            "spending decisions become clearer and easier to improve.</p>"
        ),
    },
]


def _md5(text: str) -> str:
    return hashlib.md5((text or "").encode()).hexdigest()


def _fix_html(html: str) -> str:
    """Strip markdown fences, close unclosed <p> tags, and swap banned vocabulary."""
    html = html.strip()
    html = re.sub(r"^```html?\s*", "", html)
    html = re.sub(r"\s*```$", "", html)
    html = html.strip()
    # Close any unclosed <p> tags
    open_count = html.count("<p>")
    close_count = html.count("</p>")
    if open_count > close_count:
        html += "</p>" * (open_count - close_count)
    # Strip trailing whitespace inside every <p>...</p>
    html = re.sub(r"<p>(.*?)</p>", lambda m: f"<p>{m.group(1).strip()}</p>", html, flags=re.DOTALL)
    # Swap words the model uses despite the prompt ban
    # Use word boundaries so "crucial" doesn't hit "not crucial" or similar
    SWAPS = {
        r"\bcrucial\b": "important",
        r"\bindividuals\b": "people",
        r"\butilise\b": "use",
        r"\butilize\b": "use",
        r"\bendeavour\b": "effort",
        r"\bmeticulously\b": "carefully",
        r"\bsubsequent\b": "next",
        r"\bthus\b": "so",
        r"\bthereby\b": "so",
        r"\bwhereby\b": "where",
        r"\bfurthermore\b": "also",
        r"\bconsequently\b": "as a result",
        r"\bprioritisation\b": "prioritising",
        r"\bprioritization\b": "prioritising",
        r"\bfragility\b": "vulnerability",
    }
    for pattern, replacement in SWAPS.items():
        html = re.sub(pattern, replacement, html, flags=re.IGNORECASE)
    return html


def _load_standards() -> str:
    if not STANDARDS_PATH.exists():
        raise CommandError(f"Authoring standards not found at {STANDARDS_PATH}")
    return STANDARDS_PATH.read_text(encoding="utf-8")


def _build_system_prompt(standards: str) -> str:
    return f"""You are a professional content editor for Garzoni, a personal finance learning app for everyday people in the UK and EU.

Your job is to rewrite lesson text sections so they are clear, accurate, and aligned with their lesson context. The rewrites must be ready for production — real users learn from these sections daily on mobile.

--- AUTHORING STANDARDS ---
{standards}
--- END AUTHORING STANDARDS ---

OUTPUT FORMAT — non-negotiable:
• Output exactly 2 <p> tags, nothing else.
• Each <p> must be a complete, well-developed paragraph. Cover the same depth as the original — do not condense or drop factual points. If the original section is long, your paragraphs should be proportionally longer too.
• Do NOT use <ul>, <li>, bullet characters (•, -, *), numbered lists, or newline-separated items inside a <p>.
• Do NOT add lead-in phrases like "Here are the key points:" or "To summarise:".

CONTENT RULES:
• Stay within the factual scope of the original — do not add or invent concepts not present.
• Align every sentence to the exact Path → Course → Lesson → Section title context given.
• Section roles: Overview = plain definition | Core Concept = mechanics + why it matters | Applied Insight = concrete real-world scenario + the common mistake | Practical Walkthrough = step-by-step action the reader takes | Key Takeaways = sharp prose reinforcement of the lesson's main points | Next Steps = one single concrete action to take today.
• Do NOT end with vague motivational closers. Banned endings: "achieve your goals", "make the most of your resources", "take control of your future", "work towards your financial objectives", "make progress over time", "financial foundation", "make better financial decisions".
• Language register: simple, direct, everyday English. Banned words: crucial, subsequent, expenditure, illustrates, indicates, endeavour, utilise, meticulously, individuals, prioritisation, fragility, thereby, whereby, nonetheless, furthermore, consequently, allocate (unless the original uses it).

Output ONLY the 2-paragraph HTML. No commentary, no explanation."""


def _build_messages(system_prompt: str, user_prompt: str) -> list:
    """Build the messages array with few-shot examples followed by the real request."""
    messages = [{"role": "system", "content": system_prompt}]
    for ex in FEW_SHOT_EXAMPLES:
        messages.append({"role": "user", "content": ex["user"]})
        messages.append({"role": "assistant", "content": ex["assistant"]})
    messages.append({"role": "user", "content": user_prompt})
    return messages


def _build_user_prompt(path_title, course_title, lesson_title, section_title, section_order, html):
    return (
        f"PATH: {path_title}\n"
        f"COURSE: {course_title}\n"
        f"LESSON: {lesson_title}\n"
        f"SECTION TITLE: {section_title}\n"
        f"SECTION SLOT: {section_order} of 9\n\n"
        f"CURRENT CONTENT:\n{html}"
    )


def _call_openai(client, system_prompt: str, user_prompt: str) -> str:
    messages = _build_messages(system_prompt, user_prompt)
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            response = client.chat.completions.create(
                model=OPENAI_MODEL,
                messages=messages,
                temperature=0.2,
                max_tokens=1200,
            )
            return _fix_html(response.choices[0].message.content.strip())
        except Exception as exc:
            error_str = str(exc)
            is_rate_limit = "429" in error_str or "rate_limit" in error_str.lower()
            if is_rate_limit and attempt < MAX_RETRIES:
                wait = 60 * attempt
                # Try to parse retry-after from error message
                match = re.search(r"try again in (\d+)s", error_str)
                if match:
                    wait = int(match.group(1)) + 2
                raise _RateLimitRetry(wait)
            raise


class _RateLimitRetry(Exception):
    def __init__(self, wait_seconds: int):
        self.wait_seconds = wait_seconds


def _apply_record(section_id: int, rewritten_html: str, metadata: dict) -> None:
    section = LessonSection.objects.get(id=section_id)
    original_html = section.text_content or ""

    section.text_content = rewritten_html
    section.save(update_fields=["text_content"])

    LessonSectionTranslation.objects.filter(section=section).update(
        text_content=rewritten_html,
        source_hash="",
    )

    EducationAuditLog.objects.create(
        user=None,
        action="ai_rewrite",
        target_type="LessonSection",
        target_id=section_id,
        metadata={
            "model": OPENAI_MODEL,
            "original_hash": _md5(original_html),
            "rewritten_hash": _md5(rewritten_html),
            **metadata,
        },
    )


class Command(BaseCommand):
    help = (
        "Rewrite text LessonSections with OpenAI. "
        "Default: generate + apply immediately. "
        "--dry-run: generate + save JSON, no DB writes."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Generate rewrites and save JSON but do NOT write to DB.",
        )
        parser.add_argument(
            "--batch-size",
            type=int,
            default=10,
            metavar="N",
            help="Number of sections to process per run (default: 10).",
        )
        parser.add_argument(
            "--output-file",
            type=str,
            default=None,
            metavar="PATH",
            help="Where to write the JSON log (default: rewrite_output/batch_TIMESTAMP.json).",
        )
        parser.add_argument(
            "--apply-from-file",
            type=str,
            default=None,
            metavar="PATH",
            help="Apply a manually reviewed JSON file to DB. Skips OpenAI entirely.",
        )
        parser.add_argument(
            "--skip-processed",
            action="store_true",
            help="Skip sections already logged in EducationAuditLog with action=ai_rewrite.",
        )
        parser.add_argument(
            "--path-id",
            type=int,
            default=None,
            metavar="ID",
            help="Limit to sections belonging to this Path ID.",
        )
        parser.add_argument(
            "--course-id",
            type=int,
            default=None,
            metavar="ID",
            help="Limit to sections belonging to this Course ID.",
        )
        parser.add_argument(
            "--only-ids",
            type=str,
            default="",
            metavar="1,2,3",
            help="Comma-separated LessonSection IDs to process exclusively (re-run specific sections).",
        )
        parser.add_argument(
            "--skip-ids",
            type=str,
            default="",
            metavar="1,2,3",
            help="Comma-separated LessonSection IDs to skip.",
        )

    def handle(self, *args, **options):
        if options["apply_from_file"]:
            self._apply_from_file(options["apply_from_file"])
        else:
            self._run(options)

    # ------------------------------------------------------------------
    # Main run
    # ------------------------------------------------------------------

    def _run(self, options):
        dry_run = options["dry_run"]
        batch_size = options["batch_size"]
        skip_processed = options["skip_processed"]
        skip_ids = {int(x) for x in options["skip_ids"].split(",") if x.strip()}
        only_ids = {int(x) for x in options["only_ids"].split(",") if x.strip()}

        api_key = os.environ.get("OPENAI_API_KEY") or getattr(settings, "OPENAI_API_KEY", None)
        if not api_key:
            raise CommandError("OPENAI_API_KEY not set.")

        try:
            from openai import OpenAI
        except ImportError:
            raise CommandError("openai package not installed.")

        client = OpenAI(api_key=api_key)
        standards = _load_standards()
        system_prompt = _build_system_prompt(standards)

        qs = (
            LessonSection.objects.filter(content_type="text", is_published=True)
            .exclude(text_content__isnull=True)
            .exclude(text_content="")
            .select_related("lesson__course__path")
            .order_by(
                "lesson__course__path__sort_order",
                "lesson__course__order",
                "lesson_id",
                "order",
            )
        )

        if options["path_id"]:
            qs = qs.filter(lesson__course__path_id=options["path_id"])
        if options["course_id"]:
            qs = qs.filter(lesson__course_id=options["course_id"])
        if only_ids:
            qs = qs.filter(id__in=only_ids)
        if skip_ids:
            qs = qs.exclude(id__in=skip_ids)
        if skip_processed:
            already_done = set(
                EducationAuditLog.objects.filter(
                    action="ai_rewrite", target_type="LessonSection"
                ).values_list("target_id", flat=True)
            )
            if already_done:
                qs = qs.exclude(id__in=already_done)

        qs = qs[:batch_size]
        sections = list(qs)

        if not sections:
            self.stdout.write(
                self.style.SUCCESS("No sections to process — all done or none matched.")
            )
            return

        mode = "DRY RUN — no DB writes" if dry_run else f"LIVE — applying to DB ({OPENAI_MODEL})"
        self.stdout.write(self.style.WARNING(f"{mode}. Processing {len(sections)} sections."))

        output_path = options.get("output_file")
        if not output_path:
            DEFAULT_OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            output_path = str(DEFAULT_OUTPUT_DIR / f"batch_{timestamp}.json")
        else:
            Path(output_path).parent.mkdir(parents=True, exist_ok=True)

        results = []
        applied = 0
        failed = 0

        for i, section in enumerate(sections, 1):
            lesson = section.lesson
            course = lesson.course
            path = course.path

            path_title = path.title if path else "Unknown Path"
            course_title = course.title
            lesson_title = lesson.title
            section_title = section.title
            section_order = section.order
            original_html = section.text_content or ""

            self.stdout.write(
                f"  [{i}/{len(sections)}] #{section.id} — "
                f"{path_title} / {lesson_title} / {section_title}"
            )

            user_prompt = _build_user_prompt(
                path_title,
                course_title,
                lesson_title,
                section_title,
                section_order,
                original_html,
            )

            rewritten_html = None
            error_msg = None

            for attempt in range(1, MAX_RETRIES + 1):
                try:
                    rewritten_html = _call_openai(client, system_prompt, user_prompt)
                    break
                except _RateLimitRetry as e:
                    self.stdout.write(
                        self.style.WARNING(
                            f"    Rate limit — waiting {e.wait_seconds}s (attempt {attempt}/{MAX_RETRIES})…"
                        )
                    )
                    time.sleep(e.wait_seconds)
                except Exception as exc:
                    error_msg = str(exc)
                    self.stderr.write(self.style.ERROR(f"    OpenAI error: {exc}"))
                    break

            record = {
                "id": section.id,
                "path_title": path_title,
                "course_title": course_title,
                "lesson_title": lesson_title,
                "section_title": section_title,
                "section_order": section_order,
                "original_html": original_html,
                "rewritten_html": rewritten_html,
            }
            if error_msg:
                record["error"] = error_msg

            results.append(record)

            if rewritten_html and not dry_run:
                try:
                    _apply_record(
                        section.id,
                        rewritten_html,
                        {
                            "source_file": Path(output_path).name,
                            "path_title": path_title,
                            "course_title": course_title,
                            "lesson_title": lesson_title,
                            "section_title": section_title,
                        },
                    )
                    applied += 1
                    self.stdout.write(self.style.SUCCESS("    ✓ applied"))
                except Exception as exc:
                    self.stderr.write(self.style.ERROR(f"    DB write failed: {exc}"))
                    record["apply_error"] = str(exc)
                    failed += 1
            elif rewritten_html:
                applied += 1
            else:
                failed += 1

            if i < len(sections):
                time.sleep(REQUEST_DELAY)

        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(results, f, indent=2, ensure_ascii=False)

        self.stdout.write(self.style.SUCCESS(f"\nLog saved: {output_path}"))
        if dry_run:
            self.stdout.write(f"  Would apply: {applied}  Failed: {failed}")
            self.stdout.write("  Review the JSON then run with --apply-from-file to apply.")
        else:
            self.stdout.write(self.style.SUCCESS(f"  Applied: {applied}  Failed: {failed}"))

    # ------------------------------------------------------------------
    # Apply from manually reviewed JSON
    # ------------------------------------------------------------------

    def _apply_from_file(self, file_path: str):
        path = Path(file_path)
        if not path.exists():
            raise CommandError(f"File not found: {file_path}")

        with open(path, "r", encoding="utf-8") as f:
            records = json.load(f)

        if not isinstance(records, list):
            raise CommandError("JSON file must contain a list of section records.")

        applied = 0
        skipped = 0

        for record in records:
            section_id = record.get("id")
            rewritten_html = record.get("rewritten_html")

            if not section_id:
                self.stderr.write(self.style.WARNING("Record missing 'id' — skipping."))
                skipped += 1
                continue

            if not rewritten_html:
                self.stdout.write(f"  Section {section_id}: skipped (no rewritten_html).")
                skipped += 1
                continue

            try:
                _apply_record(
                    section_id,
                    rewritten_html,
                    {
                        "source_file": path.name,
                        "path_title": record.get("path_title"),
                        "course_title": record.get("course_title"),
                        "lesson_title": record.get("lesson_title"),
                        "section_title": record.get("section_title"),
                    },
                )
                applied += 1
                self.stdout.write(
                    f"  Section {section_id} "
                    f"({record.get('lesson_title')} / {record.get('section_title')}): applied."
                )
            except LessonSection.DoesNotExist:
                self.stderr.write(
                    self.style.WARNING(f"  Section {section_id}: not found — skipping.")
                )
                skipped += 1
            except Exception as exc:
                self.stderr.write(self.style.ERROR(f"  Section {section_id}: error — {exc}"))
                skipped += 1

        self.stdout.write(self.style.SUCCESS(f"\nDone. Applied: {applied}  Skipped: {skipped}"))

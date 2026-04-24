"""
Rewrite exercise LessonSections (all multiple-choice) using OpenAI.
Rewrites question, options, hints, explanation — preserves correctAnswer index and difficulty.

Default run:
    python manage.py rewrite_exercise_sections --batch-size 50

Dry-run:
    python manage.py rewrite_exercise_sections --dry-run --batch-size 10

Apply from reviewed JSON:
    python manage.py rewrite_exercise_sections --apply-from-file path/to/file.json

Full automated run:
    python manage.py rewrite_exercise_sections --skip-processed --batch-size 100
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

OPENAI_MODEL = os.environ.get("OPENAI_REWRITE_MODEL", "gpt-4o")
REQUEST_DELAY = float(os.environ.get("OPENAI_REWRITE_DELAY", "0.2"))
MAX_RETRIES = 3

FEW_SHOT_EXAMPLES = [
    {
        "user": (
            "PATH: Basic Finance\n"
            "COURSE: Introduction to Budgeting\n"
            "LESSON: What Is a Budget?\n"
            "EXERCISE TITLE: Knowledge Check 1\n\n"
            "CURRENT EXERCISE:\n"
            "QUESTION: What is money?\n"
            'OPTIONS: ["A concept", "A medium of exchange", "Numbers on a screen", "Government paper"]\n'
            "CORRECT ANSWER INDEX: 1\n"
            'HINTS: ["Think about what you use every day"]\n'
            "EXPLANATION: Money is a tool used for exchange."
        ),
        "assistant": json.dumps(
            {
                "question": "Which of the following best describes the core purpose of a budget?",
                "options": [
                    "To record where your money went at the end of each month",
                    "To plan where every pound or euro goes before the month starts",
                    "To show your bank how responsibly you manage money",
                    "To calculate your total income for the year",
                ],
                "hints": [
                    "A budget is a forward-looking plan, not a backward-looking record",
                    "Think about what happens to your money before you spend it",
                ],
                "explanation": "A budget is a proactive plan. It decides where your money goes in advance, rather than tracking where it went after the fact.",
            },
            indent=2,
        ),
    },
    {
        "user": (
            "PATH: Basic Finance\n"
            "COURSE: Understanding Income & Expenses\n"
            "LESSON: Fixed vs. Variable Expenses\n"
            "EXERCISE TITLE: Knowledge Check 2\n\n"
            "CURRENT EXERCISE:\n"
            "QUESTION: What is a fixed expense?\n"
            'OPTIONS: ["An expense that changes", "An expense that stays the same each month", "A luxury item", "A one-time payment"]\n'
            "CORRECT ANSWER INDEX: 1\n"
            'HINTS: ["Think about rent or subscriptions"]\n'
            "EXPLANATION: Fixed expenses are the same each month."
        ),
        "assistant": json.dumps(
            {
                "question": "Your rent, insurance, and loan repayment are all examples of which type of expense?",
                "options": [
                    "Variable expenses, because they depend on your usage",
                    "Fixed expenses, because they stay the same amount each month",
                    "Discretionary expenses, because you can choose whether to pay them",
                    "Emergency expenses, because they arise unexpectedly",
                ],
                "hints": [
                    "These costs are predictable and appear on your bank statement for the same amount every month",
                    "They form the non-negotiable baseline of your monthly budget",
                ],
                "explanation": "Fixed expenses are costs that remain constant each month — like rent, insurance premiums, and loan repayments. Because they do not change, they are the easiest to plan for in a budget.",
            },
            indent=2,
        ),
    },
]


def _md5(text: str) -> str:
    return hashlib.md5((text or "").encode()).hexdigest()


def _load_standards() -> str:
    if not STANDARDS_PATH.exists():
        raise CommandError(f"Authoring standards not found at {STANDARDS_PATH}")
    return STANDARDS_PATH.read_text(encoding="utf-8")


def _build_system_prompt(standards: str) -> str:
    return f"""You are a professional content editor for Garzoni, a personal finance learning app for everyday people in the UK and EU.

Your job is to rewrite multiple-choice exercise questions so they test real understanding of the specific lesson, not generic finance trivia.

--- AUTHORING STANDARDS ---
{standards}
--- END AUTHORING STANDARDS ---

OUTPUT FORMAT — non-negotiable:
• Output ONLY valid JSON. No markdown fences, no commentary, no extra keys.
• The JSON must have exactly these keys: question, options, hints, explanation.
• options must be an array of exactly 4 strings.
• The correct answer must remain at the SAME INDEX as the original — do not change which option is correct.

CONTENT RULES:
• Question must be specific to the Path → Course → Lesson context, not generic trivia.
• Wrong options (distractors) must reflect real misconceptions learners might have — not obviously silly.
• Hints guide the learner toward the answer without giving it away. Maximum 2 hints.
• Explanation is shown after the learner answers — clearly reinforce WHY the correct answer is right.
• Simple, direct language. Banned words: crucial, individuals, utilise, meticulously, subsequently, thereby, whereby, nonetheless, furthermore, allocate (unless needed for context).
• No vague motivational language."""


def _build_user_prompt(path_title, course_title, lesson_title, section_title, exercise_data):
    correct_idx = exercise_data.get("correctAnswer", 0)
    return (
        f"PATH: {path_title}\n"
        f"COURSE: {course_title}\n"
        f"LESSON: {lesson_title}\n"
        f"EXERCISE TITLE: {section_title}\n\n"
        f"CURRENT EXERCISE:\n"
        f"QUESTION: {exercise_data.get('question', '')}\n"
        f"OPTIONS: {json.dumps(exercise_data.get('options', []))}\n"
        f"CORRECT ANSWER INDEX: {correct_idx}\n"
        f"HINTS: {json.dumps(exercise_data.get('hints', []))}\n"
        f"EXPLANATION: {exercise_data.get('explanation', '')}"
    )


def _build_messages(system_prompt, user_prompt):
    messages = [{"role": "system", "content": system_prompt}]
    for ex in FEW_SHOT_EXAMPLES:
        messages.append({"role": "user", "content": ex["user"]})
        messages.append({"role": "assistant", "content": ex["assistant"]})
    messages.append({"role": "user", "content": user_prompt})
    return messages


class _RateLimitRetry(Exception):
    def __init__(self, wait_seconds):
        self.wait_seconds = wait_seconds


def _call_openai(client, system_prompt, user_prompt):
    messages = _build_messages(system_prompt, user_prompt)
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            response = client.chat.completions.create(
                model=OPENAI_MODEL,
                messages=messages,
                temperature=0.2,
                max_tokens=800,
                response_format={"type": "json_object"},
            )
            return json.loads(response.choices[0].message.content.strip())
        except Exception as exc:
            error_str = str(exc)
            is_rate_limit = "429" in error_str or "rate_limit" in error_str.lower()
            if is_rate_limit and attempt < MAX_RETRIES:
                wait = 60 * attempt
                match = re.search(r"try again in (\d+)s", error_str)
                if match:
                    wait = int(match.group(1)) + 2
                raise _RateLimitRetry(wait)
            raise


def _validate(data, original_correct_idx):
    if not isinstance(data, dict):
        return "response is not a JSON object"
    for key in ("question", "options", "explanation"):
        if key not in data:
            return f"missing key: {key}"
    if not isinstance(data["options"], list) or len(data["options"]) != 4:
        return f"options must be exactly 4 items, got {len(data.get('options', []))}"
    if not all(isinstance(o, str) for o in data["options"]):
        return "all options must be strings"
    return None


def _apply_record(section_id, original_data, rewritten_data, metadata):
    section = LessonSection.objects.get(id=section_id)

    new_data = dict(original_data)
    new_data["question"] = rewritten_data["question"]
    new_data["options"] = rewritten_data["options"]
    new_data["explanation"] = rewritten_data.get(
        "explanation", original_data.get("explanation", "")
    )
    if rewritten_data.get("hints"):
        new_data["hints"] = rewritten_data["hints"]

    section.exercise_data = new_data
    section.save(update_fields=["exercise_data"])

    LessonSectionTranslation.objects.filter(section=section).update(
        exercise_data={},
        source_hash="",
    )

    EducationAuditLog.objects.create(
        user=None,
        action="ai_rewrite",
        target_type="LessonSection",
        target_id=section_id,
        metadata={
            "model": OPENAI_MODEL,
            "content_type": "exercise",
            "original_hash": _md5(json.dumps(original_data, sort_keys=True)),
            "rewritten_hash": _md5(json.dumps(new_data, sort_keys=True)),
            **metadata,
        },
    )


class Command(BaseCommand):
    help = "Rewrite exercise LessonSections (multiple-choice) with OpenAI."

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Generate rewrites and save JSON but do NOT write to DB.",
        )
        parser.add_argument("--batch-size", type=int, default=10, metavar="N")
        parser.add_argument("--output-file", type=str, default=None, metavar="PATH")
        parser.add_argument("--apply-from-file", type=str, default=None, metavar="PATH")
        parser.add_argument(
            "--skip-processed",
            action="store_true",
            help="Skip exercise sections already rewritten (checks EducationAuditLog).",
        )
        parser.add_argument("--path-id", type=int, default=None, metavar="ID")
        parser.add_argument("--course-id", type=int, default=None, metavar="ID")
        parser.add_argument("--only-ids", type=str, default="", metavar="1,2,3")
        parser.add_argument("--skip-ids", type=str, default="", metavar="1,2,3")

    def handle(self, *args, **options):
        if options["apply_from_file"]:
            self._apply_from_file(options["apply_from_file"])
        else:
            self._run(options)

    def _run(self, options):
        dry_run = options["dry_run"]
        batch_size = options["batch_size"]
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
            LessonSection.objects.filter(content_type="exercise", is_published=True)
            .exclude(exercise_data__isnull=True)
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
        if options["skip_processed"]:
            # Intersect audit log entries with exercise section IDs to avoid
            # colliding with text section rewrite logs (same target_type).
            exercise_section_ids = set(
                LessonSection.objects.filter(content_type="exercise").values_list("id", flat=True)
            )
            already_done = (
                set(
                    EducationAuditLog.objects.filter(
                        action="ai_rewrite", target_type="LessonSection"
                    ).values_list("target_id", flat=True)
                )
                & exercise_section_ids
            )
            if already_done:
                qs = qs.exclude(id__in=already_done)

        sections = list(qs[:batch_size])

        if not sections:
            self.stdout.write(self.style.SUCCESS("No exercise sections to process."))
            return

        mode = "DRY RUN" if dry_run else f"LIVE ({OPENAI_MODEL})"
        self.stdout.write(
            self.style.WARNING(f"{mode} — processing {len(sections)} exercise sections.")
        )

        output_path = options.get("output_file")
        if not output_path:
            DEFAULT_OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            output_path = str(DEFAULT_OUTPUT_DIR / f"exercises_batch_{timestamp}.json")
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
            original_data = section.exercise_data or {}
            correct_idx = original_data.get("correctAnswer", 0)

            self.stdout.write(
                f"  [{i}/{len(sections)}] #{section.id} — "
                f"{path_title} / {lesson_title} / {section_title}"
            )

            user_prompt = _build_user_prompt(
                path_title, course_title, lesson_title, section_title, original_data
            )
            rewritten_data = None
            error_msg = None

            for attempt in range(1, MAX_RETRIES + 1):
                try:
                    candidate = _call_openai(client, system_prompt, user_prompt)
                    err = _validate(candidate, correct_idx)
                    if err:
                        raise ValueError(f"Validation failed: {err}")
                    rewritten_data = candidate
                    break
                except _RateLimitRetry as e:
                    self.stdout.write(
                        self.style.WARNING(
                            f"    Rate limit — waiting {e.wait_seconds}s (attempt {attempt})…"
                        )
                    )
                    time.sleep(e.wait_seconds)
                except Exception as exc:
                    error_msg = str(exc)
                    self.stderr.write(self.style.ERROR(f"    Error (attempt {attempt}): {exc}"))
                    if attempt < MAX_RETRIES:
                        time.sleep(2 * attempt)
                    else:
                        break

            record = {
                "id": section.id,
                "path_title": path_title,
                "course_title": course_title,
                "lesson_title": lesson_title,
                "section_title": section_title,
                "exercise_type": "multiple-choice",
                "original_question": original_data.get("question", ""),
                "original_options": original_data.get("options", []),
                "original_correct_index": correct_idx,
                "original_hints": original_data.get("hints", []),
                "original_explanation": original_data.get("explanation", ""),
                "rewritten_question": rewritten_data.get("question") if rewritten_data else None,
                "rewritten_options": rewritten_data.get("options") if rewritten_data else None,
                "rewritten_correct_index": correct_idx,
                "rewritten_hints": rewritten_data.get("hints", []) if rewritten_data else None,
                "rewritten_explanation": (
                    rewritten_data.get("explanation") if rewritten_data else None
                ),
            }
            if error_msg:
                record["error"] = error_msg

            results.append(record)

            if rewritten_data and not dry_run:
                try:
                    _apply_record(
                        section.id,
                        original_data,
                        rewritten_data,
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
            elif rewritten_data:
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

    def _apply_from_file(self, file_path):
        path = Path(file_path)
        if not path.exists():
            raise CommandError(f"File not found: {file_path}")

        with open(path, "r", encoding="utf-8") as f:
            records = json.load(f)

        applied = 0
        skipped = 0

        for record in records:
            section_id = record.get("id")
            if not section_id:
                skipped += 1
                continue

            if not record.get("rewritten_question") or not record.get("rewritten_options"):
                self.stdout.write(f"  Section {section_id}: skipped (no rewritten data).")
                skipped += 1
                continue

            try:
                section = LessonSection.objects.get(id=section_id)
                original_data = section.exercise_data or {}
                rewritten_data = {
                    "question": record["rewritten_question"],
                    "options": record["rewritten_options"],
                    "hints": record.get("rewritten_hints", []),
                    "explanation": record.get("rewritten_explanation", ""),
                }
                _apply_record(
                    section_id,
                    original_data,
                    rewritten_data,
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
                    f"  #{section_id} ({record.get('lesson_title')} / {record.get('section_title')}): applied."
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

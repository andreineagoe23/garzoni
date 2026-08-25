"""
Rewrite exercise LessonSections (all multiple-choice) using OpenAI.
Rewrites question, options, hints, explanation — keeps the answer in its existing
slot and preserves difficulty.

Two answer-giveaway rules are enforced here, because both were introduced by
earlier runs of this command:

* The model must return ``correct_index`` and it must match the slot we asked
  for. Previously the model was told to "keep the correct answer at the same
  index" and was never checked, so a rewrite could point ``correctAnswer`` at a
  distractor without anything noticing.
* The four options must be close in length. Before this gate, the correct option
  was the longest one in 95% of all knowledge checks and averaged 39 characters
  longer than its distractors — a learner could score without reading the stem.

Slot balance itself is handled separately by ``rebalance_mc_answer_positions``;
this command preserves whatever slot the section already uses.

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

from education.exercise_quality import (
    MAX_LENGTH_RATIO,
    MIN_OPTION_CHARS,
    correct_index_of,
    length_problem,
    target_length_band,
)
from education.models import EducationAuditLog, LessonSection, LessonSectionTranslation
from education.services.checkpoint_quizzes import resync_quiz_from_section

STANDARDS_PATH = Path(__file__).resolve().parents[2] / "content" / "lesson_authoring_standards.md"
DEFAULT_OUTPUT_DIR = Path(__file__).resolve().parents[2] / "content" / "rewrite_output"

OPENAI_MODEL = os.environ.get("OPENAI_REWRITE_MODEL", settings.OPENAI_MODEL_AUTHORING)
REQUEST_DELAY = float(os.environ.get("OPENAI_REWRITE_DELAY", "0.2"))
MAX_RETRIES = 4

# The examples are the strongest signal the model gets, so they carry the two
# properties we care about: the answer sits in a different slot in each one
# (an earlier version put it at index 1 in both, and the corpus came out 75%
# index 1 / 0% index 3), and all four options are within a few characters of
# each other so length never identifies the answer.
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
            "TARGET ANSWER INDEX: 3\n"
            'HINTS: ["Think about what you use every day"]\n'
            "EXPLANATION: Money is a tool used for exchange."
        ),
        "assistant": json.dumps(
            {
                "question": "Which of the following best describes the core purpose of a budget?",
                "options": [
                    "A record of where your money went last month",
                    "A signal to your bank that you handle money well",
                    "A total of the income you expect to earn this year",
                    "A plan for where your money goes before the month starts",
                ],
                "correct_index": 3,
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
            "TARGET ANSWER INDEX: 0\n"
            'HINTS: ["Think about rent or subscriptions"]\n'
            "EXPLANATION: Fixed expenses are the same each month."
        ),
        "assistant": json.dumps(
            {
                "question": "Your rent, insurance, and loan repayment are all examples of which type of expense?",
                "options": [
                    "Fixed costs, because the amount is the same every month",
                    "Variable costs, because the amount depends on your usage",
                    "Optional costs, because you can decide whether to pay them",
                    "Emergency costs, because they turn up without any warning",
                ],
                "correct_index": 0,
                "hints": [
                    "These costs are predictable and leave your account for the same amount every month",
                    "They form the non-negotiable baseline of your monthly budget",
                ],
                "explanation": "Fixed expenses are costs that remain constant each month — like rent, insurance premiums, and loan repayments. Because they do not change, they are the easiest to plan for in a budget.",
            },
            indent=2,
        ),
    },
    {
        "user": (
            "PATH: Basic Finance\n"
            "COURSE: Saving\n"
            "LESSON: Emergency Funds\n"
            "EXERCISE TITLE: Knowledge Check 1\n\n"
            "CURRENT EXERCISE:\n"
            "QUESTION: How big should an emergency fund be?\n"
            'OPTIONS: ["A lot", "Three to six months of essential spending", "£100", "One year of salary"]\n'
            "TARGET ANSWER INDEX: 2\n"
            'HINTS: ["Think in months, not in a flat amount"]\n'
            "EXPLANATION: Three to six months is the usual guidance."
        ),
        "assistant": json.dumps(
            {
                "question": "Your essential outgoings are £1,200 a month. What is the usual target for an emergency fund?",
                "options": [
                    "£1,200, so you can always cover one more month",
                    "£14,400, matching a full year of essential spending",
                    "£3,600 to £7,200, or three to six months of essentials",
                    "£600, since half a month is enough for most surprises",
                ],
                "correct_index": 2,
                "hints": [
                    "The target is set in months of spending, not as a flat amount",
                    "It has to cover a gap in income, not a single unexpected bill",
                ],
                "explanation": "An emergency fund is sized in months of essential spending, normally three to six. At £1,200 a month that is £3,600 to £7,200 — enough to absorb a job loss rather than one surprise bill.",
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
• The JSON must have exactly these keys: question, options, correct_index, hints, explanation.
• options must be an array of exactly 4 strings.
• correct_index must equal the TARGET ANSWER INDEX given in the request. Write the correct option into that slot and put distractors in the other three.

ANSWER MUST NOT BE GUESSABLE FROM SHAPE — this is checked and rejected:
• All four options must be close to the same length. The longest may not exceed \
{MAX_LENGTH_RATIO:.2f}× the shortest.
• Every option must be at least {MIN_OPTION_CHARS} characters.
• The correct option must not be the most detailed, most qualified, or most complete-sounding one. \
If the correct option needs a clause like "because…", give the distractors one too.
• Do not signal the answer with hedges ("always", "never", "all of the above") or with a distractor \
that is obviously absurd.

CONTENT RULES:
• Question must be specific to the Path → Course → Lesson context, not generic trivia.
• Wrong options (distractors) must reflect real misconceptions learners might have — not obviously silly.
• Hints guide the learner toward the answer without giving it away. Maximum 2 hints.
• Explanation is shown after the learner answers — clearly reinforce WHY the correct answer is right.
• Simple, direct language. Banned words: crucial, individuals, utilise, meticulously, subsequently, thereby, whereby, nonetheless, furthermore, allocate (unless needed for context).
• No vague motivational language."""


def _build_user_prompt(
    path_title,
    course_title,
    lesson_title,
    section_title,
    exercise_data,
    target_idx,
    retry_note=None,
):
    existing = exercise_data.get("options") or []
    low, mid, high = target_length_band(existing)
    prompt = (
        f"PATH: {path_title}\n"
        f"COURSE: {course_title}\n"
        f"LESSON: {lesson_title}\n"
        f"EXERCISE TITLE: {section_title}\n\n"
        f"CURRENT EXERCISE:\n"
        f"QUESTION: {exercise_data.get('question', '')}\n"
        f"OPTIONS: {json.dumps(existing)}\n"
        f"TARGET ANSWER INDEX: {target_idx}\n"
        f"TARGET OPTION LENGTH: aim for about {mid} characters per option; "
        f"every one of the four must land between {low} and {high} characters, "
        f"the correct one included\n"
        f"HINTS: {json.dumps(exercise_data.get('hints', []))}\n"
        f"EXPLANATION: {exercise_data.get('explanation', '')}"
    )
    if retry_note:
        prompt += f"\n\nYOUR PREVIOUS ANSWER WAS REJECTED: {retry_note}\nFix that and return the JSON again."
    return prompt


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
            lowered = error_str.lower()
            # An exhausted credit balance also comes back as a 429. Retrying it
            # just sleeps through three backoffs before failing, once per record
            # — an hour of waiting on an error that will never clear on its own.
            if "insufficient_quota" in lowered or "credit_balance_exhausted" in lowered:
                raise CommandError(
                    "OpenAI credit balance exhausted — top up at "
                    "https://platform.openai.com/settings/organization/billing/ and re-run."
                )
            is_rate_limit = "429" in error_str or "rate_limit" in lowered
            if is_rate_limit and attempt < MAX_RETRIES:
                wait = 60 * attempt
                match = re.search(r"try again in (\d+)s", error_str)
                if match:
                    wait = int(match.group(1)) + 2
                raise _RateLimitRetry(wait)
            raise


def _validate(data, target_idx):
    """
    Reject a rewrite that would be answerable without reading the question.

    Returns None when the candidate is usable, otherwise a message that is fed
    back to the model on the next attempt.
    """
    if not isinstance(data, dict):
        return "response is not a JSON object"
    for key in ("question", "options", "explanation"):
        if key not in data:
            return f"missing key: {key}"
    if not isinstance(data["options"], list) or len(data["options"]) != 4:
        return f"options must be exactly 4 items, got {len(data.get('options', []))}"
    if not all(isinstance(o, str) for o in data["options"]):
        return "all options must be strings"

    correct = data.get("correct_index")
    if isinstance(correct, bool) or not isinstance(correct, int):
        return "correct_index missing or not an integer"
    if correct != target_idx:
        return f"correct_index must be {target_idx}, got {correct}"

    options = [o.strip() for o in data["options"]]
    if len(set(options)) != len(options):
        return "options must all be different"

    return length_problem(options, correct)


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

    # The model states which slot it wrote the answer into, and _validate has
    # already confirmed it matches the slot we asked for. Trusting the original
    # index instead (what this used to do) let a rewrite silently point
    # correctAnswer at a distractor.
    correct_index = rewritten_data.get("correct_index")
    if not isinstance(correct_index, int) or isinstance(correct_index, bool):
        raise ValueError(f"section {section_id}: rewrite has no usable correct_index")
    if not 0 <= correct_index < len(new_data["options"]):
        raise ValueError(f"section {section_id}: correct_index {correct_index} out of range")
    new_data["correctAnswer"] = correct_index
    new_data.pop("correct_answer", None)

    section.exercise_data = new_data
    section.save(update_fields=["exercise_data"])

    LessonSectionTranslation.objects.filter(section=section).update(
        exercise_data=None,
        source_hash="",
    )

    # The lesson checkpoint modal reads a Quiz row materialized from this
    # section. It was only ever populated on creation, so before this every
    # rewrite left the checkpoint showing the pre-rewrite wording and option
    # order while the in-lesson check showed the new one.
    resync_quiz_from_section(section)

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
            # Multiple-choice only. The filter used to be content_type alone,
            # which swept in numeric and drag-and-drop sections and rewrote
            # their stems into MC questions the widget cannot render.
            LessonSection.objects.filter(
                content_type="exercise",
                exercise_type="multiple-choice",
                is_published=True,
            )
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
            # Rewrites keep the slot the section already uses; balancing slots
            # across the corpus is rebalance_mc_answer_positions' job. A row
            # with an unusable index falls back to 0 rather than to whatever
            # `.get(..., 0)` happened to return for a string.
            existing_options = (
                original_data.get("options")
                if isinstance(original_data.get("options"), list)
                else []
            )
            correct_idx = correct_index_of(original_data, len(existing_options) or 4) or 0

            self.stdout.write(
                f"  [{i}/{len(sections)}] #{section.id} — "
                f"{path_title} / {lesson_title} / {section_title}"
            )

            rewritten_data = None
            error_msg = None
            retry_note = None

            for attempt in range(1, MAX_RETRIES + 1):
                # The rejection reason goes back into the prompt: a bare retry
                # at temperature 0.2 tends to return the same rejected shape.
                user_prompt = _build_user_prompt(
                    path_title,
                    course_title,
                    lesson_title,
                    section_title,
                    original_data,
                    correct_idx,
                    retry_note,
                )
                try:
                    candidate = _call_openai(client, system_prompt, user_prompt)
                    err = _validate(candidate, correct_idx)
                    if err:
                        retry_note = err
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
                except CommandError:
                    # Unrecoverable (e.g. no credits) — abort the run instead of
                    # working through every remaining record to fail identically.
                    raise
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
                "rewritten_correct_index": (
                    rewritten_data.get("correct_index") if rewritten_data else None
                ),
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
                # Batch files written before the model returned correct_index
                # carry only the original slot; fall back to it rather than
                # guessing, and let _apply_record reject anything unusable.
                correct_index = record.get("rewritten_correct_index")
                if correct_index is None:
                    correct_index = record.get(
                        "original_correct_index", original_data.get("correctAnswer")
                    )
                rewritten_data = {
                    "question": record["rewritten_question"],
                    "options": record["rewritten_options"],
                    "correct_index": correct_index,
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

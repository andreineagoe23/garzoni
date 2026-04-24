"""
Rewrite standalone Exercise model records and Quiz model records using OpenAI.
Handles all exercise types: multiple-choice, drag-and-drop, numeric, budget-allocation.

Target exercises only:
    python manage.py rewrite_standalone_exercises --target exercises --batch-size 50

Target quizzes only:
    python manage.py rewrite_standalone_exercises --target quizzes

Target both (default):
    python manage.py rewrite_standalone_exercises --batch-size 50

Dry-run:
    python manage.py rewrite_standalone_exercises --dry-run --batch-size 10

Full automated run:
    python manage.py rewrite_standalone_exercises --skip-processed --batch-size 100
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

from education.models import EducationAuditLog, Exercise, ExerciseTranslation, Quiz, QuizTranslation

DEFAULT_OUTPUT_DIR = Path(__file__).resolve().parents[2] / "content" / "rewrite_output"

OPENAI_MODEL = os.environ.get("OPENAI_REWRITE_MODEL", "gpt-4o")
REQUEST_DELAY = float(os.environ.get("OPENAI_REWRITE_DELAY", "0.2"))
MAX_RETRIES = 3

# ---------------------------------------------------------------------------
# System prompts — one per exercise type
# ---------------------------------------------------------------------------

SYSTEM_PROMPT_MULTIPLE_CHOICE = """You are a professional content editor for Garzoni, a personal finance learning app for everyday people in the UK and EU.

Rewrite multiple-choice exercises to test real understanding, not generic recall.

OUTPUT FORMAT — non-negotiable:
• Output ONLY valid JSON. No markdown fences, no commentary.
• Keys: question, options, hints. options = exactly 4 strings. hints = 1-2 strings.
• The correct answer MUST remain at the SAME INDEX as specified — do not reorder options.

CONTENT RULES:
• Question tests genuine understanding of the topic, not surface-level definitions.
• Distractors reflect real misconceptions — not obviously wrong.
• Hints guide thinking without giving the answer away.
• Simple, direct language. No banned words: crucial, individuals, utilise, meticulously, subsequently, thereby, whereby, nonetheless, furthermore."""

SYSTEM_PROMPT_DRAG_AND_DROP = """You are a professional content editor for Garzoni, a personal finance learning app for everyday people in the UK and EU.

Rewrite drag-and-drop ordering exercises. The learner must arrange items in the correct order.

OUTPUT FORMAT — non-negotiable:
• Output ONLY valid JSON. No markdown fences, no commentary.
• Keys: question, items, hints. items = array of strings (same length as original). hints = 1-2 strings.
• Keep items in the SAME ARRAY POSITIONS — the correct_answer indices reference these positions.
• Rewrite each item's text to be clearer or more specific, but keep the same concept at each position.

CONTENT RULES:
• Question must clearly ask the learner to arrange/order the items.
• Each item should be concise (3-7 words ideally).
• Hints give a clue about the ordering principle without revealing the full answer.
• Simple, direct language."""

SYSTEM_PROMPT_MATCHING = """You are a professional content editor for Garzoni, a personal finance learning app for everyday people in the UK and EU.

Rewrite matching exercises. The learner drags each term to match its definition.

OUTPUT FORMAT — non-negotiable:
• Output ONLY valid JSON. No markdown fences, no commentary.
• Keys: question, pairs. pairs = array of objects with "term" and "match" keys (same length as original).
• Keep the same number of pairs as the original.

CONTENT RULES:
• question introduces the matching task clearly (e.g. "Match each term to its correct definition.").
• Each "term" is a finance concept (short, 1-3 words).
• Each "match" is a clear, plain-English definition (one sentence, no jargon).
• Pairs must test real understanding — not trivially obvious matches.
• Simple, direct language. No banned words: crucial, individuals, utilise, meticulously."""

SYSTEM_PROMPT_NUMERIC = """You are a professional content editor for Garzoni, a personal finance learning app for everyday people in the UK and EU.

Rewrite numeric calculation exercises. The learner must calculate and enter a number.

OUTPUT FORMAT — non-negotiable:
• Output ONLY valid JSON. No markdown fences, no commentary.
• Keys: question, hints, validation, placeholder.
• DO NOT change expected_value, tolerance, unit, or period_hint — only rewrite text fields.

CONTENT RULES:
• Question must include the exact same numbers and formula as the original (same calculation, reworded).
• Hints guide the learner through the calculation steps without giving the final answer.
• validation describes the formula or method in one sentence.
• placeholder is the input field label (e.g., "Enter amount", "Enter percentage").
• Simple, direct language."""

SYSTEM_PROMPT_BUDGET_ALLOCATION = """You are a professional content editor for Garzoni, a personal finance learning app for everyday people in the UK and EU.

Rewrite budget-allocation exercises. The learner distributes an income across budget categories.

OUTPUT FORMAT — non-negotiable:
• Output ONLY valid JSON. No markdown fences, no commentary.
• Keys: question, hints. hints = 1-3 strings.
• DO NOT change income amounts, categories, or correct allocations — only rewrite the question and hints.

CONTENT RULES:
• Question must state the same total income and the same categories as the original.
• Hints guide without revealing the exact allocation.
• Simple, direct language."""

SYSTEM_PROMPT_QUIZ = """You are a professional content editor for Garzoni, a personal finance learning app for everyday people in the UK and EU.

Rewrite quiz questions (multiple-choice). The quiz tests lesson comprehension.

OUTPUT FORMAT — non-negotiable:
• Output ONLY valid JSON. No markdown fences, no commentary.
• Keys: question, choices, correct_index.
• choices = array of strings (same length as original, max 4).
• correct_index = integer (0-based) indicating which choice is correct.

CONTENT RULES:
• Question tests understanding, not generic recall.
• Choices are specific and plausible. Distractors reflect real misconceptions.
• Simple, direct language. No banned words: crucial, individuals, utilise, meticulously, subsequently."""


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _md5(text: str) -> str:
    return hashlib.md5((text or "").encode()).hexdigest()


class _RateLimitRetry(Exception):
    def __init__(self, wait_seconds):
        self.wait_seconds = wait_seconds


def _call_openai(client, system_prompt, messages_extra):
    messages = [{"role": "system", "content": system_prompt}] + messages_extra
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            response = client.chat.completions.create(
                model=OPENAI_MODEL,
                messages=messages,
                temperature=0.2,
                max_tokens=600,
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


# ---------------------------------------------------------------------------
# Per-type user prompt builders
# ---------------------------------------------------------------------------


def _user_prompt_multiple_choice(exercise):
    correct_idx = exercise.correct_answer if isinstance(exercise.correct_answer, int) else 0
    data = exercise.exercise_data or {}
    return (
        f"CATEGORY: {exercise.category or 'Finance'}\n"
        f"DIFFICULTY: {exercise.difficulty or 'beginner'}\n\n"
        f"QUESTION: {exercise.question}\n"
        f"OPTIONS: {json.dumps(data.get('options', []))}\n"
        f"CORRECT ANSWER INDEX: {correct_idx}\n"
        f"HINTS: {json.dumps(data.get('hints', []))}"
    )


def _user_prompt_drag_and_drop(exercise):
    data = exercise.exercise_data or {}
    correct = exercise.correct_answer
    return (
        f"CATEGORY: {exercise.category or 'Finance'}\n\n"
        f"QUESTION: {exercise.question}\n"
        f"ITEMS (in array order): {json.dumps(data.get('items', []))}\n"
        f"CORRECT ORDER (indices): {json.dumps(correct)}\n"
        f"HINTS: {json.dumps(data.get('hints', []))}"
    )


def _user_prompt_numeric(exercise):
    data = exercise.exercise_data or {}
    return (
        f"CATEGORY: {exercise.category or 'Finance'}\n\n"
        f"QUESTION: {exercise.question}\n"
        f"EXPECTED VALUE: {data.get('expected_value')}\n"
        f"UNIT: {data.get('unit', '')}\n"
        f"TOLERANCE: {data.get('tolerance')}\n"
        f"HINTS: {json.dumps(data.get('hints', []))}\n"
        f"VALIDATION: {data.get('validation', '')}\n"
        f"PLACEHOLDER: {data.get('placeholder', '')}"
    )


def _user_prompt_budget_allocation(exercise):
    data = exercise.exercise_data or {}
    return (
        f"CATEGORY: {exercise.category or 'Finance'}\n\n"
        f"QUESTION: {exercise.question}\n"
        f"CATEGORIES: {json.dumps(data.get('categories', []))}\n"
        f"CORRECT ALLOCATION: {json.dumps(exercise.correct_answer)}\n"
        f"HINTS: {json.dumps(data.get('hints', []))}"
    )


def _user_prompt_matching(exercise):
    data = exercise.exercise_data or {}
    pairs = data.get("pairs", [])
    return (
        f"CATEGORY: {exercise.category or 'Finance'}\n\n"
        f"QUESTION: {exercise.question}\n"
        f"CURRENT PAIRS: {json.dumps(pairs, indent=2)}"
    )


def _user_prompt_quiz(quiz):
    choices = quiz.choices or []
    choice_texts = [c["text"] if isinstance(c, dict) else str(c) for c in choices]
    # Find the index of the current correct answer
    correct_idx = next(
        (i for i, t in enumerate(choice_texts) if t == quiz.correct_answer),
        0,
    )
    return (
        f"QUESTION: {quiz.question}\n"
        f"CHOICES: {json.dumps(choice_texts)}\n"
        f"CORRECT ANSWER INDEX: {correct_idx}"
    )


# ---------------------------------------------------------------------------
# Per-type validators
# ---------------------------------------------------------------------------


def _validate_multiple_choice(data, original_correct_idx):
    for key in ("question", "options"):
        if key not in data:
            return f"missing key: {key}"
    if not isinstance(data["options"], list) or len(data["options"]) != 4:
        return f"options must be exactly 4 items, got {len(data.get('options', []))}"
    if not all(isinstance(o, str) for o in data["options"]):
        return "all options must be strings"
    return None


def _validate_drag_and_drop(data, original_item_count):
    for key in ("question", "items"):
        if key not in data:
            return f"missing key: {key}"
    if not isinstance(data["items"], list) or len(data["items"]) != original_item_count:
        return f"items must have {original_item_count} elements, got {len(data.get('items', []))}"
    return None


def _validate_numeric(data):
    if "question" not in data:
        return "missing key: question"
    return None


def _validate_budget_allocation(data):
    if "question" not in data:
        return "missing key: question"
    return None


def _validate_matching(data, original_pair_count):
    for key in ("question", "pairs"):
        if key not in data:
            return f"missing key: {key}"
    if not isinstance(data["pairs"], list) or len(data["pairs"]) != original_pair_count:
        return f"pairs must have {original_pair_count} items, got {len(data.get('pairs', []))}"
    for p in data["pairs"]:
        if not isinstance(p, dict) or "term" not in p or "match" not in p:
            return "each pair must have 'term' and 'match' keys"
    return None


def _validate_quiz(data, original_choice_count):
    for key in ("question", "choices", "correct_index"):
        if key not in data:
            return f"missing key: {key}"
    if not isinstance(data["choices"], list) or len(data["choices"]) != original_choice_count:
        return (
            f"choices must have {original_choice_count} items, got {len(data.get('choices', []))}"
        )
    if not isinstance(data["correct_index"], int) or not (
        0 <= data["correct_index"] < original_choice_count
    ):
        return f"correct_index must be 0-{original_choice_count - 1}"
    return None


# ---------------------------------------------------------------------------
# Per-type apply helpers
# ---------------------------------------------------------------------------


def _apply_exercise(exercise, rewritten, exercise_type, metadata):
    original_q = exercise.question
    original_data = dict(exercise.exercise_data or {})

    if exercise_type == "multiple-choice":
        exercise.question = rewritten["question"]
        new_data = dict(original_data)
        new_data["options"] = rewritten["options"]
        if rewritten.get("hints"):
            new_data["hints"] = rewritten["hints"]
        exercise.exercise_data = new_data
        exercise.save(update_fields=["question", "exercise_data"])

    elif exercise_type == "drag-and-drop":
        exercise.question = rewritten["question"]
        new_data = dict(original_data)
        new_data["items"] = rewritten["items"]
        if rewritten.get("hints"):
            new_data["hints"] = rewritten["hints"]
        exercise.exercise_data = new_data
        exercise.save(update_fields=["question", "exercise_data"])

    elif exercise_type == "numeric":
        exercise.question = rewritten["question"]
        new_data = dict(original_data)
        if rewritten.get("hints"):
            new_data["hints"] = rewritten["hints"]
        if rewritten.get("validation"):
            new_data["validation"] = rewritten["validation"]
        if rewritten.get("placeholder"):
            new_data["placeholder"] = rewritten["placeholder"]
        exercise.exercise_data = new_data
        exercise.save(update_fields=["question", "exercise_data"])

    elif exercise_type == "budget-allocation":
        exercise.question = rewritten["question"]
        new_data = dict(original_data)
        if rewritten.get("hints"):
            new_data["hints"] = rewritten["hints"]
        exercise.exercise_data = new_data
        exercise.save(update_fields=["question", "exercise_data"])

    elif exercise_type == "matching":
        exercise.question = rewritten["question"]
        new_data = dict(original_data)
        new_data["pairs"] = rewritten["pairs"]
        # correct_answer mirrors the pairs array
        exercise.exercise_data = new_data
        exercise.correct_answer = rewritten["pairs"]
        exercise.save(update_fields=["question", "exercise_data", "correct_answer"])

    # Blank translation data to mark stale
    ExerciseTranslation.objects.filter(exercise=exercise).update(
        question="",
        exercise_data={},
    )

    EducationAuditLog.objects.create(
        user=None,
        action="ai_rewrite",
        target_type="Exercise",
        target_id=exercise.id,
        metadata={
            "model": OPENAI_MODEL,
            "exercise_type": exercise_type,
            "original_hash": _md5(original_q + json.dumps(original_data, sort_keys=True)),
            "rewritten_hash": _md5(
                exercise.question + json.dumps(exercise.exercise_data, sort_keys=True)
            ),
            **metadata,
        },
    )


def _apply_quiz(quiz, rewritten, metadata):
    original_q = quiz.question
    original_choices = quiz.choices

    choice_texts = rewritten["choices"]
    correct_idx = rewritten["correct_index"]
    new_correct_answer = choice_texts[correct_idx]

    # Rebuild choices preserving original id structure
    old_choices = quiz.choices or []
    new_choices = []
    for i, text in enumerate(choice_texts):
        if i < len(old_choices) and isinstance(old_choices[i], dict):
            new_choices.append({**old_choices[i], "text": text})
        else:
            new_choices.append({"id": i + 1, "text": text})

    quiz.question = rewritten["question"]
    quiz.choices = new_choices
    quiz.correct_answer = new_correct_answer
    quiz.save(update_fields=["question", "choices", "correct_answer"])

    # Blank translations
    QuizTranslation.objects.filter(quiz=quiz).update(
        question="",
        choices=[],
        correct_answer="",
    )

    EducationAuditLog.objects.create(
        user=None,
        action="ai_rewrite",
        target_type="Quiz",
        target_id=quiz.id,
        metadata={
            "model": OPENAI_MODEL,
            "original_hash": _md5(
                original_q + json.dumps(original_choices, sort_keys=True, default=str)
            ),
            "rewritten_hash": _md5(
                quiz.question + json.dumps(new_choices, sort_keys=True, default=str)
            ),
            **metadata,
        },
    )


# ---------------------------------------------------------------------------
# Command
# ---------------------------------------------------------------------------


class Command(BaseCommand):
    help = "Rewrite standalone Exercise and Quiz records with OpenAI."

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Generate rewrites and save JSON but do NOT write to DB.",
        )
        parser.add_argument(
            "--target",
            choices=["exercises", "quizzes", "all"],
            default="all",
            help="What to rewrite: exercises, quizzes, or all (default).",
        )
        parser.add_argument("--batch-size", type=int, default=10, metavar="N")
        parser.add_argument("--output-file", type=str, default=None, metavar="PATH")
        parser.add_argument("--apply-from-file", type=str, default=None, metavar="PATH")
        parser.add_argument(
            "--skip-processed",
            action="store_true",
            help="Skip records already logged in EducationAuditLog.",
        )
        parser.add_argument(
            "--only-ids",
            type=str,
            default="",
            metavar="1,2,3",
            help="Comma-separated Exercise IDs (or Quiz IDs for --target quizzes).",
        )
        parser.add_argument("--skip-ids", type=str, default="", metavar="1,2,3")

    def handle(self, *args, **options):
        if options["apply_from_file"]:
            self._apply_from_file(options["apply_from_file"])
        else:
            self._run(options)

    def _run(self, options):
        dry_run = options["dry_run"]
        target = options["target"]
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

        output_path = options.get("output_file")
        if not output_path:
            DEFAULT_OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            output_path = str(DEFAULT_OUTPUT_DIR / f"standalone_batch_{timestamp}.json")
        else:
            Path(output_path).parent.mkdir(parents=True, exist_ok=True)

        mode = "DRY RUN" if dry_run else f"LIVE ({OPENAI_MODEL})"
        self.stdout.write(self.style.WARNING(f"{mode} — target: {target}"))

        results = []
        total_applied = 0
        total_failed = 0

        if target in ("exercises", "all"):
            applied, failed, recs = self._run_exercises(
                client,
                dry_run,
                batch_size,
                skip_ids,
                only_ids,
                options["skip_processed"],
                output_path,
            )
            results.extend(recs)
            total_applied += applied
            total_failed += failed

        if target in ("quizzes", "all"):
            applied, failed, recs = self._run_quizzes(
                client,
                dry_run,
                batch_size,
                skip_ids,
                only_ids,
                options["skip_processed"],
                output_path,
            )
            results.extend(recs)
            total_applied += applied
            total_failed += failed

        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(results, f, indent=2, ensure_ascii=False)

        self.stdout.write(self.style.SUCCESS(f"\nLog saved: {output_path}"))
        if dry_run:
            self.stdout.write(f"  Would apply: {total_applied}  Failed: {total_failed}")
        else:
            self.stdout.write(
                self.style.SUCCESS(f"  Applied: {total_applied}  Failed: {total_failed}")
            )

    # ------------------------------------------------------------------

    def _run_exercises(
        self, client, dry_run, batch_size, skip_ids, only_ids, skip_processed, output_path
    ):
        qs = Exercise.objects.filter(is_published=True).order_by("id")

        if only_ids:
            qs = qs.filter(id__in=only_ids)
        if skip_ids:
            qs = qs.exclude(id__in=skip_ids)
        if skip_processed:
            already_done = set(
                EducationAuditLog.objects.filter(
                    action="ai_rewrite", target_type="Exercise"
                ).values_list("target_id", flat=True)
            )
            if already_done:
                qs = qs.exclude(id__in=already_done)

        exercises = list(qs[:batch_size])
        if not exercises:
            self.stdout.write("  No exercises to process.")
            return 0, 0, []

        self.stdout.write(f"  Processing {len(exercises)} exercises.")
        results = []
        applied = 0
        failed = 0

        for i, exercise in enumerate(exercises, 1):
            etype = exercise.type
            self.stdout.write(
                f"  [{i}/{len(exercises)}] Exercise #{exercise.id} ({etype}) — {exercise.question[:60]}"
            )

            system_prompt, user_prompt, validate_fn, effective_type = self._get_exercise_handlers(
                exercise, etype
            )
            if system_prompt is None:
                self.stdout.write(f"    Skipping unsupported type: {etype}")
                continue

            rewritten = None
            error_msg = None

            for attempt in range(1, MAX_RETRIES + 1):
                try:
                    candidate = _call_openai(
                        client, system_prompt, [{"role": "user", "content": user_prompt}]
                    )
                    err = validate_fn(candidate)
                    if err:
                        raise ValueError(f"Validation failed: {err}")
                    rewritten = candidate
                    break
                except _RateLimitRetry as e:
                    self.stdout.write(
                        self.style.WARNING(f"    Rate limit — waiting {e.wait_seconds}s…")
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
                "id": exercise.id,
                "target": "exercise",
                "exercise_type": etype,
                "category": exercise.category,
                "original_question": exercise.question,
                "original_exercise_data": exercise.exercise_data,
                "original_correct_answer": exercise.correct_answer,
                "rewritten": rewritten,
            }
            if error_msg:
                record["error"] = error_msg
            results.append(record)

            if rewritten and not dry_run:
                try:
                    _apply_exercise(
                        exercise, rewritten, effective_type, {"source_file": Path(output_path).name}
                    )
                    applied += 1
                    self.stdout.write(self.style.SUCCESS("    ✓ applied"))
                except Exception as exc:
                    self.stderr.write(self.style.ERROR(f"    DB write failed: {exc}"))
                    record["apply_error"] = str(exc)
                    failed += 1
            elif rewritten:
                applied += 1
            else:
                failed += 1

            time.sleep(REQUEST_DELAY)

        return applied, failed, results

    def _get_exercise_handlers(self, exercise, etype):
        data = exercise.exercise_data or {}
        if etype == "multiple-choice":
            correct_idx = exercise.correct_answer if isinstance(exercise.correct_answer, int) else 0
            return (
                SYSTEM_PROMPT_MULTIPLE_CHOICE,
                _user_prompt_multiple_choice(exercise),
                lambda d: _validate_multiple_choice(d, correct_idx),
                "multiple-choice",
            )
        elif etype == "drag-and-drop":
            # Matching exercises (pairs) are stored as drag-and-drop type
            if "pairs" in data:
                pair_count = len(data.get("pairs", []))
                return (
                    SYSTEM_PROMPT_MATCHING,
                    _user_prompt_matching(exercise),
                    lambda d, pc=pair_count: _validate_matching(d, pc),
                    "matching",
                )
            item_count = len(data.get("items", []))
            return (
                SYSTEM_PROMPT_DRAG_AND_DROP,
                _user_prompt_drag_and_drop(exercise),
                lambda d, ic=item_count: _validate_drag_and_drop(d, ic),
                "drag-and-drop",
            )
        elif etype == "numeric":
            return (
                SYSTEM_PROMPT_NUMERIC,
                _user_prompt_numeric(exercise),
                lambda d: _validate_numeric(d),
                "numeric",
            )
        elif etype == "budget-allocation":
            return (
                SYSTEM_PROMPT_BUDGET_ALLOCATION,
                _user_prompt_budget_allocation(exercise),
                lambda d: _validate_budget_allocation(d),
                "budget-allocation",
            )
        return None, None, None, None

    # ------------------------------------------------------------------

    def _run_quizzes(
        self, client, dry_run, batch_size, skip_ids, only_ids, skip_processed, output_path
    ):
        qs = Quiz.objects.order_by("id")

        if only_ids:
            qs = qs.filter(id__in=only_ids)
        if skip_ids:
            qs = qs.exclude(id__in=skip_ids)
        if skip_processed:
            already_done = set(
                EducationAuditLog.objects.filter(
                    action="ai_rewrite", target_type="Quiz"
                ).values_list("target_id", flat=True)
            )
            if already_done:
                qs = qs.exclude(id__in=already_done)

        quizzes = list(qs[:batch_size])
        if not quizzes:
            self.stdout.write("  No quizzes to process.")
            return 0, 0, []

        self.stdout.write(f"  Processing {len(quizzes)} quizzes.")
        results = []
        applied = 0
        failed = 0

        for i, quiz in enumerate(quizzes, 1):
            self.stdout.write(f"  [{i}/{len(quizzes)}] Quiz #{quiz.id} — {quiz.question[:60]}")

            choices = quiz.choices or []
            choice_count = len(choices)
            user_prompt = _user_prompt_quiz(quiz)

            rewritten = None
            error_msg = None

            for attempt in range(1, MAX_RETRIES + 1):
                try:
                    candidate = _call_openai(
                        client,
                        SYSTEM_PROMPT_QUIZ,
                        [{"role": "user", "content": user_prompt}],
                    )
                    err = _validate_quiz(candidate, choice_count)
                    if err:
                        raise ValueError(f"Validation failed: {err}")
                    rewritten = candidate
                    break
                except _RateLimitRetry as e:
                    self.stdout.write(
                        self.style.WARNING(f"    Rate limit — waiting {e.wait_seconds}s…")
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
                "id": quiz.id,
                "target": "quiz",
                "original_question": quiz.question,
                "original_choices": quiz.choices,
                "original_correct_answer": quiz.correct_answer,
                "rewritten": rewritten,
            }
            if error_msg:
                record["error"] = error_msg
            results.append(record)

            if rewritten and not dry_run:
                try:
                    _apply_quiz(quiz, rewritten, {"source_file": Path(output_path).name})
                    applied += 1
                    self.stdout.write(self.style.SUCCESS("    ✓ applied"))
                except Exception as exc:
                    self.stderr.write(self.style.ERROR(f"    DB write failed: {exc}"))
                    record["apply_error"] = str(exc)
                    failed += 1
            elif rewritten:
                applied += 1
            else:
                failed += 1

            time.sleep(REQUEST_DELAY)

        return applied, failed, results

    # ------------------------------------------------------------------

    def _apply_from_file(self, file_path):
        path = Path(file_path)
        if not path.exists():
            raise CommandError(f"File not found: {file_path}")

        with open(path, "r", encoding="utf-8") as f:
            records = json.load(f)

        applied = 0
        skipped = 0

        for record in records:
            record_id = record.get("id")
            rewritten = record.get("rewritten")
            target = record.get("target", "exercise")

            if not record_id or not rewritten:
                skipped += 1
                continue

            try:
                if target == "quiz":
                    quiz = Quiz.objects.get(id=record_id)
                    choices = quiz.choices or []
                    err = _validate_quiz(rewritten, len(choices))
                    if err:
                        raise ValueError(err)
                    _apply_quiz(quiz, rewritten, {"source_file": path.name})
                    self.stdout.write(f"  Quiz #{record_id}: applied.")
                else:
                    exercise = Exercise.objects.get(id=record_id)
                    etype = exercise.type
                    _, _, validate_fn, effective_type = self._get_exercise_handlers(exercise, etype)
                    if validate_fn:
                        err = validate_fn(rewritten)
                        if err:
                            raise ValueError(err)
                    _apply_exercise(exercise, rewritten, effective_type, {"source_file": path.name})
                    self.stdout.write(f"  Exercise #{record_id} ({etype}): applied.")
                applied += 1
            except (Exercise.DoesNotExist, Quiz.DoesNotExist):
                self.stderr.write(
                    self.style.WARNING(f"  #{record_id} ({target}): not found — skipping.")
                )
                skipped += 1
            except Exception as exc:
                self.stderr.write(self.style.ERROR(f"  #{record_id} ({target}): error — {exc}"))
                skipped += 1

        self.stdout.write(self.style.SUCCESS(f"\nDone. Applied: {applied}  Skipped: {skipped}"))

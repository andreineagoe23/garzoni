import json
import re

from django.core.management.base import BaseCommand
from django.utils.html import strip_tags

from education.models import Lesson
from education.exercise_quality import correct_index_of, length_problem, slot_distribution
from education.lesson_section_structure import SECTION_TEMPLATE_9

# Canonical 9-section layout, derived from the single source of truth.
TARGET_TYPES = [ctype for _o, _t, ctype, _r in SECTION_TEMPLATE_9]
TEXT_ORDERS = [o for o, _t, ctype, _r in SECTION_TEMPLATE_9 if ctype == "text"]
EXERCISE_ORDERS = [o for o, _t, ctype, _r in SECTION_TEMPLATE_9 if ctype == "exercise"]
VIDEO_ORDERS = [o for o, _t, ctype, _r in SECTION_TEMPLATE_9 if ctype == "video"]
# Key Takeaways (7) and Next Steps (8) are intentionally short per authoring standards.
SUMMARY_ORDERS = {7, 8}

YOUTUBE_ID_RE = re.compile(
    r"(?:youtu\.be/|youtube\.com/(?:watch\?v=|embed/|shorts/))([A-Za-z0-9_-]{11})"
)
GENERIC_PATTERNS = [
    "what's one way to use what you learned",
    "what is one way to use what you learned",
    "what's one key takeaway",
    "quick check",
]


def has_valid_youtube_url(url: str | None) -> bool:
    if not url:
        return False
    return bool(YOUTUBE_ID_RE.search(url))


class Command(BaseCommand):
    help = "Quality gates for lessons: 9-section structure, text depth, non-generic exercises, video validity."

    def add_arguments(self, parser):
        parser.add_argument("--json", action="store_true", help="Output JSON report to stdout.")
        parser.add_argument(
            "--output",
            type=str,
            default="",
            metavar="PATH",
            help="Write JSON report directly to this file path (avoids stdout pollution).",
        )
        parser.add_argument(
            "--min-text-len",
            type=int,
            default=300,
            help="Minimum chars for deep text sections (1, 2, 4, 5). Default: 300",
        )
        parser.add_argument(
            "--min-summary-len",
            type=int,
            default=150,
            help="Minimum chars for summary text sections (7 Key Takeaways, 8 Next Steps). Default: 150",
        )
        parser.add_argument(
            "--min-question-len",
            type=int,
            default=80,
            help="Minimum chars for exercise questions. Default: 80",
        )

    def handle(self, *args, **options):
        as_json = options["json"]
        min_text_len = options["min_text_len"]
        min_summary_len = options["min_summary_len"]
        min_question_len = options["min_question_len"]

        rows = []
        failing = 0
        # Answer-slot bias is invisible per lesson (two checks each) and only
        # shows up across the corpus, so it is reported rather than gated.
        answer_slots: list[tuple[list, int | None]] = []

        lessons = (
            Lesson.objects.select_related("course")
            .prefetch_related("sections")
            .order_by("course_id", "id")
        )
        for lesson in lessons:
            sections = list(lesson.sections.all().order_by("order"))
            reasons = []

            if len(sections) != len(TARGET_TYPES):
                reasons.append(f"expected {len(TARGET_TYPES)} sections, found {len(sections)}")
            current_types = [s.content_type for s in sections]
            if current_types != TARGET_TYPES:
                reasons.append(f"invalid section order/types: {current_types}")

            by_order = {s.order: s for s in sections}

            for order in TEXT_ORDERS:
                s = by_order.get(order)
                if not s or s.content_type != "text":
                    reasons.append(f"section {order} must be text")
                    continue
                text_len = len(strip_tags(s.text_content or "").strip())
                floor = min_summary_len if order in SUMMARY_ORDERS else min_text_len
                if text_len < floor:
                    reasons.append(f"text section {order} too short ({text_len} < {floor})")

            for order in EXERCISE_ORDERS:
                s = by_order.get(order)
                if not s or s.content_type != "exercise":
                    reasons.append(f"section {order} must be exercise")
                    continue
                data = s.exercise_data or {}
                q = (data.get("question") or "").strip() if isinstance(data, dict) else ""
                opts = data.get("options") if isinstance(data, dict) else []
                correct = data.get("correctAnswer") if isinstance(data, dict) else None
                if len(q) < min_question_len:
                    reasons.append(
                        f"exercise section {order} question too short ({len(q)} < {min_question_len})"
                    )
                q_lower = q.lower()
                if any(p in q_lower for p in GENERIC_PATTERNS):
                    reasons.append(f"exercise section {order} uses generic prompt")
                # Type-specific shape checks (multiple-choice is the default).
                ex_type = s.exercise_type or "multiple-choice"
                if ex_type == "multiple-choice":
                    if not isinstance(opts, list) or len(opts) < 4:
                        reasons.append(f"exercise section {order} requires 4 options")
                    if not isinstance(correct, int):
                        reasons.append(f"exercise section {order} missing integer correctAnswer")
                    if isinstance(opts, list) and len(opts) >= 2:
                        idx = correct_index_of(data, len(opts))
                        answer_slots.append((list(opts), idx))
                        shape = length_problem([str(o) for o in opts], idx)
                        if shape:
                            reasons.append(f"exercise section {order} {shape}")
                elif ex_type == "numeric":
                    if (
                        data.get("expected_value") if isinstance(data, dict) else None
                    ) is None and (
                        data.get("correct_answer") if isinstance(data, dict) else None
                    ) is None:
                        reasons.append(f"exercise section {order} numeric missing expected_value")
                elif ex_type == "drag-and-drop":
                    items = data.get("items") if isinstance(data, dict) else None
                    if not isinstance(items, list) or len(items) < 2:
                        reasons.append(f"exercise section {order} drag-and-drop needs >=2 items")

            for order in VIDEO_ORDERS:
                s = by_order.get(order)
                if not s or s.content_type != "video":
                    reasons.append(f"section {order} must be video")
                elif not has_valid_youtube_url(s.video_url):
                    reasons.append(f"section {order} has invalid youtube URL")

            if reasons:
                failing += 1

            rows.append(
                {
                    "course": lesson.course.title if lesson.course else "",
                    "lesson_id": lesson.id,
                    "lesson_title": lesson.title,
                    "section_types": current_types,
                    "status": "fail" if reasons else "pass",
                    "reasons": reasons,
                }
            )

        payload = {
            "total_lessons": len(rows),
            "failing_lessons": failing,
            "passing_lessons": len(rows) - failing,
            "target_types": TARGET_TYPES,
            "answer_positions": slot_distribution(answer_slots),
            "results": rows,
        }

        output_path = options.get("output", "")
        if output_path:
            with open(output_path, "w", encoding="utf-8") as fh:
                json.dump(payload, fh, ensure_ascii=False)
            self.stderr.write(f"JSON report written to {output_path}")
            return

        if as_json:
            self.stdout.write(json.dumps(payload, ensure_ascii=False))
            return

        self.stdout.write(f"Total lessons: {payload['total_lessons']}")
        self.stdout.write(f"Passing lessons: {payload['passing_lessons']}")
        self.stdout.write(f"Failing lessons: {payload['failing_lessons']}")

        pos = payload["answer_positions"]
        if pos["total"]:
            spread = "  ".join(
                f"[{slot}] {n} ({100 * n / pos['total']:.0f}%)"
                for slot, n in pos["by_slot"].items()
            )
            self.stdout.write("")
            self.stdout.write(f"Answer slot ({pos['total']} multiple-choice checks): {spread}")
            self.stdout.write(
                f"Correct option is the longest: {pos['correct_is_longest']} "
                f"({pos['correct_is_longest_pct']}%)"
            )
        self.stdout.write("")
        for row in rows:
            if row["status"] == "fail":
                self.stdout.write(
                    f"- FAIL lesson #{row['lesson_id']} {row['lesson_title']}: "
                    f"{'; '.join(row['reasons'])}"
                )

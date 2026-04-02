import json
import re

from django.core.management.base import BaseCommand
from django.utils.html import strip_tags

from education.models import Lesson

TARGET_TYPES = ["text", "exercise", "text", "video", "text", "exercise", "text"]
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
    help = "Quality gates for lessons: exact structure, text depth, non-generic exercises, and video validity."

    def add_arguments(self, parser):
        parser.add_argument("--json", action="store_true", help="Output JSON report.")
        parser.add_argument(
            "--min-text-len",
            type=int,
            default=500,
            help="Minimum chars for text sections (except order 7). Default: 500",
        )
        parser.add_argument(
            "--min-summary-len",
            type=int,
            default=350,
            help="Minimum chars for final text section (order 7). Default: 350",
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

        lessons = (
            Lesson.objects.select_related("course")
            .prefetch_related("sections")
            .order_by("course_id", "id")
        )
        for lesson in lessons:
            sections = list(lesson.sections.all().order_by("order"))
            reasons = []

            if len(sections) != 7:
                reasons.append(f"expected 7 sections, found {len(sections)}")
            current_types = [s.content_type for s in sections]
            if current_types != TARGET_TYPES:
                reasons.append(f"invalid section order/types: {current_types}")

            by_order = {s.order: s for s in sections}

            for order in (1, 3, 5):
                s = by_order.get(order)
                if not s or s.content_type != "text":
                    reasons.append(f"section {order} must be text")
                    continue
                text_len = len(strip_tags(s.text_content or "").strip())
                if text_len < min_text_len:
                    reasons.append(f"text section {order} too short ({text_len} < {min_text_len})")

            s7 = by_order.get(7)
            if not s7 or s7.content_type != "text":
                reasons.append("section 7 must be text")
            else:
                text_len = len(strip_tags(s7.text_content or "").strip())
                if text_len < min_summary_len:
                    reasons.append(f"text section 7 too short ({text_len} < {min_summary_len})")

            for order in (2, 6):
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
                if not isinstance(opts, list) or len(opts) < 4:
                    reasons.append(f"exercise section {order} requires 4 options")
                if not isinstance(correct, int):
                    reasons.append(f"exercise section {order} missing integer correctAnswer")

            s4 = by_order.get(4)
            if not s4 or s4.content_type != "video":
                reasons.append("section 4 must be video")
            else:
                if not has_valid_youtube_url(s4.video_url):
                    reasons.append("section 4 has invalid youtube URL")

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
            "results": rows,
        }

        if as_json:
            self.stdout.write(json.dumps(payload, ensure_ascii=False))
            return

        self.stdout.write(f"Total lessons: {payload['total_lessons']}")
        self.stdout.write(f"Passing lessons: {payload['passing_lessons']}")
        self.stdout.write(f"Failing lessons: {payload['failing_lessons']}")
        self.stdout.write("")
        for row in rows:
            if row["status"] == "fail":
                self.stdout.write(
                    f"- FAIL lesson #{row['lesson_id']} {row['lesson_title']}: "
                    f"{'; '.join(row['reasons'])}"
                )

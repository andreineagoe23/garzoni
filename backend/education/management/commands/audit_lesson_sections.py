import json

from django.core.management.base import BaseCommand
from django.utils.html import strip_tags
from django.utils.text import Truncator

from education.models import LessonSection


class Command(BaseCommand):
    help = "Audit lesson sections for weak or placeholder content so they can be rewritten from trusted sources."

    def add_arguments(self, parser):
        parser.add_argument(
            "--min-text-len",
            type=int,
            default=80,
            help="Minimum length for text sections before they are flagged as very short. Default: 80.",
        )
        parser.add_argument(
            "--min-question-len",
            type=int,
            default=60,
            help="Minimum length for exercise questions before they are flagged as very short. Default: 60.",
        )
        parser.add_argument(
            "--json",
            action="store_true",
            help="Output JSON instead of human-readable text.",
        )
        parser.add_argument(
            "--limit",
            type=int,
            default=None,
            help="Limit the number of flagged sections printed.",
        )

    def handle(self, *args, **options):
        min_text_len = options["min_text_len"]
        min_q_len = options["min_question_len"]
        as_json = options["json"]
        limit = options["limit"]

        qs = (
            LessonSection.objects.select_related("lesson", "lesson__course")
            .prefetch_related("translations")
            .order_by("lesson__course__id", "lesson_id", "order")
        )

        total = qs.count()
        flagged = []

        for section in qs:
            reasons = []

            # Prefer EN translation if present, otherwise fall back to base text_content.
            trans = next((t for t in section.translations.all() if t.language == "en"), None)
            raw_text = (getattr(trans, "text_content", None) if trans else None) or (
                section.text_content or ""
            )
            text = strip_tags(raw_text or "").strip()
            length = len(text)

            if section.content_type == "text":
                if not text:
                    reasons.append("empty text section")
                elif length < min_text_len:
                    reasons.append(f"very short text (<{min_text_len} chars)")

                lower = text.lower()
                if "lorem ipsum" in lower:
                    reasons.append("contains lorem ipsum placeholder")
                if any(tok in lower for tok in ["todo", "tbd", "placeholder"]):
                    reasons.append("contains TODO/TBD/placeholder marker")

            # Exercise-specific checks.
            question_text = ""
            if section.content_type == "exercise":
                data = section.exercise_data or {}
                if isinstance(data, dict):
                    question_text = (data.get("question") or "").strip()
                if not question_text:
                    reasons.append("exercise without question text")
                elif len(question_text) < min_q_len:
                    reasons.append(f"exercise question very short (<{min_q_len} chars)")

            if reasons:
                base_text_for_snippet = question_text or text
                snippet = Truncator(base_text_for_snippet).chars(220)
                flagged.append(
                    {
                        "id": section.id,
                        "course": getattr(getattr(section.lesson, "course", None), "title", None),
                        "lesson_id": section.lesson_id,
                        "lesson_title": getattr(section.lesson, "title", None),
                        "order": section.order,
                        "title": section.title,
                        "content_type": section.content_type,
                        "exercise_type": section.exercise_type,
                        "reasons": reasons,
                        "snippet": snippet,
                    }
                )

        if limit is not None:
            flagged = flagged[:limit]

        if as_json:
            self.stdout.write(json.dumps({"total": total, "flagged": flagged}, ensure_ascii=False))
            return

        self.stdout.write(f"Total sections: {total}")
        self.stdout.write(f"Flagged sections: {len(flagged)}")
        self.stdout.write("")

        for row in flagged:
            self.stdout.write(
                f"- Section #{row['id']} | Course: {row['course']!r} | "
                f"Lesson {row['lesson_id']} – {row['lesson_title']!r} | "
                f"Order {row['order']} | Title: {row['title']!r}"
            )
            self.stdout.write(f"  Content type: {row['content_type']} / {row['exercise_type']}")
            self.stdout.write(f"  Reasons: {', '.join(row['reasons'])}")
            self.stdout.write(f"  Snippet: {row['snippet']}")
            self.stdout.write("")

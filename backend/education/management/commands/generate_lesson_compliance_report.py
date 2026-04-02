import json
from datetime import datetime, timezone
from pathlib import Path

from django.core.management.base import BaseCommand
from django.utils.html import strip_tags

from education.models import Lesson

TARGET_TYPES = ["text", "exercise", "text", "video", "text", "exercise", "text"]


class Command(BaseCommand):
    help = "Generate final compliance report for lesson structure and quality."

    def add_arguments(self, parser):
        parser.add_argument(
            "--output-json",
            type=str,
            default="reports/lesson_compliance_report.json",
            help="Output JSON path relative to backend root.",
        )
        parser.add_argument(
            "--output-md",
            type=str,
            default="reports/lesson_compliance_report.md",
            help="Output markdown path relative to backend root.",
        )

    def handle(self, *args, **options):
        out_json = Path(options["output_json"])
        out_md = Path(options["output_md"])
        out_json.parent.mkdir(parents=True, exist_ok=True)
        out_md.parent.mkdir(parents=True, exist_ok=True)

        lessons = (
            Lesson.objects.select_related("course")
            .prefetch_related("sections")
            .order_by("course_id", "id")
        )

        total_lessons = 0
        total_sections = 0
        passing_lessons = 0
        failing_lessons = 0
        details = []

        for lesson in lessons:
            total_lessons += 1
            sections = list(lesson.sections.all().order_by("order"))
            total_sections += len(sections)
            types = [s.content_type for s in sections]
            reasons = []
            if len(sections) != 7:
                reasons.append(f"expected 7 sections, got {len(sections)}")
            if types != TARGET_TYPES:
                reasons.append(f"types mismatch: {types}")

            text_lens = {}
            for s in sections:
                if s.content_type == "text":
                    text_lens[s.order] = len(strip_tags(s.text_content or "").strip())

            status = "pass" if not reasons else "fail"
            if status == "pass":
                passing_lessons += 1
            else:
                failing_lessons += 1

            details.append(
                {
                    "course": lesson.course.title if lesson.course else "",
                    "lesson_id": lesson.id,
                    "lesson_title": lesson.title,
                    "section_count": len(sections),
                    "section_types": types,
                    "text_lengths": text_lens,
                    "status": status,
                    "reasons": reasons,
                }
            )

        report = {
            "generated_at_utc": datetime.now(timezone.utc).isoformat(),
            "target_template": TARGET_TYPES,
            "summary": {
                "total_lessons": total_lessons,
                "total_sections": total_sections,
                "passing_lessons": passing_lessons,
                "failing_lessons": failing_lessons,
            },
            "details": details,
        }
        out_json.write_text(json.dumps(report, ensure_ascii=False, indent=2))

        md = [
            "# Lesson Compliance Report",
            "",
            f"Generated at (UTC): {report['generated_at_utc']}",
            "",
            "## Summary",
            f"- Total lessons: {total_lessons}",
            f"- Total sections: {total_sections}",
            f"- Passing lessons: {passing_lessons}",
            f"- Failing lessons: {failing_lessons}",
            f"- Target template: `{', '.join(TARGET_TYPES)}`",
            "",
        ]
        if failing_lessons:
            md.append("## Failing Lessons")
            for row in details:
                if row["status"] == "fail":
                    md.append(
                        f"- Lesson {row['lesson_id']} ({row['lesson_title']}): "
                        + "; ".join(row["reasons"])
                    )
        else:
            md.append("All lessons pass structure compliance checks.")
        md.append("")
        out_md.write_text("\n".join(md))

        self.stdout.write(
            self.style.SUCCESS(f"Compliance report generated: {out_json} and {out_md}")
        )

import json
from pathlib import Path

from django.core.management.base import BaseCommand
from django.utils.html import strip_tags

from education.models import Lesson

TARGET_TEMPLATE = ["text", "text", "exercise", "text", "text", "exercise", "text", "text", "video"]


class Command(BaseCommand):
    help = (
        "Export a full lesson inventory and target template mapping for every lesson "
        "(used before rebuilding to the 9-section professional flow)."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--output",
            type=str,
            default="reports/lesson_template_inventory.json",
            help="Output path relative to backend root. Default: reports/lesson_template_inventory.json",
        )

    def handle(self, *args, **options):
        output_rel = options["output"]
        output_path = Path(output_rel)
        output_path.parent.mkdir(parents=True, exist_ok=True)

        lessons = (
            Lesson.objects.select_related("course")
            .prefetch_related("sections")
            .order_by("course_id", "id")
        )
        rows = []
        mismatches = 0

        for lesson in lessons:
            current = [
                {
                    "id": section.id,
                    "order": section.order,
                    "title": section.title,
                    "content_type": section.content_type,
                    "text_len": len(strip_tags(section.text_content or "").strip()),
                    "has_video_url": bool(section.video_url),
                    "has_exercise_question": bool(
                        isinstance(section.exercise_data, dict)
                        and (section.exercise_data.get("question") or "").strip()
                    ),
                }
                for section in lesson.sections.all().order_by("order")
            ]

            current_types = [s["content_type"] for s in current]
            is_exact_template = current_types == TARGET_TEMPLATE
            if not is_exact_template:
                mismatches += 1

            rows.append(
                {
                    "course_id": lesson.course_id,
                    "course_title": lesson.course.title if lesson.course else "",
                    "lesson_id": lesson.id,
                    "lesson_order": None,
                    "lesson_title": lesson.title,
                    "current_section_count": len(current),
                    "current_types": current_types,
                    "matches_target_template": is_exact_template,
                    "target_types": TARGET_TEMPLATE,
                    "current_sections": current,
                }
            )

        payload = {
            "total_lessons": len(rows),
            "target_template": TARGET_TEMPLATE,
            "lessons_not_matching_target_template": mismatches,
            "lessons": rows,
        }
        output_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2))
        self.stdout.write(
            self.style.SUCCESS(
                f"Exported lesson inventory for {len(rows)} lessons to {output_path} "
                f"(mismatches: {mismatches})."
            )
        )

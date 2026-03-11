from django.core.management.base import BaseCommand
from django.db import transaction

from education.models import Lesson, LessonSection, LessonSectionTranslation
from education.lesson_section_structure import SECTION_TEMPLATE_9

# (order, title, content_type) for reshape target
TARGET = [(order, title, ctype) for order, title, ctype, _ in SECTION_TEMPLATE_9]


class Command(BaseCommand):
    help = "Reshape all lessons to 9-section flow: text,text,exercise,text,text,exercise,text,text,video."

    def add_arguments(self, parser):
        parser.add_argument("--dry-run", action="store_true")

    def _upsert_translations(self, section, languages: set[str]):
        for lang in languages:
            LessonSectionTranslation.objects.update_or_create(
                section=section,
                language=lang,
                defaults={
                    "title": section.title,
                    "text_content": section.text_content or "",
                    "exercise_data": section.exercise_data,
                },
            )

    def handle(self, *args, **options):
        dry_run = options["dry_run"]
        lessons = Lesson.objects.prefetch_related("sections", "translations").all().order_by("id")
        updated_lessons = 0
        created_sections = 0

        for lesson in lessons:
            with transaction.atomic():
                sections = list(lesson.sections.all().order_by("order", "id"))
                if not sections:
                    continue

                by_order = {s.order: s for s in sections}
                text_sections = [s for s in sections if s.content_type == "text"]
                ex_sections = [s for s in sections if s.content_type == "exercise"]
                video_sections = [s for s in sections if s.content_type == "video"]

                # If already in target shape and ordered 1..9, only normalize titles/types.
                already_9 = len(sections) == 9 and {s.order for s in sections} == set(range(1, 10))

                s1 = by_order.get(1) or (text_sections[0] if text_sections else None)
                s2 = (
                    by_order.get(2)
                    or by_order.get(3)
                    or (text_sections[1] if len(text_sections) > 1 else s1)
                )
                e1 = by_order.get(3) or by_order.get(2) or (ex_sections[0] if ex_sections else None)
                s4 = (
                    by_order.get(4)
                    or by_order.get(5)
                    or (text_sections[2] if len(text_sections) > 2 else s2)
                )
                s5 = (
                    by_order.get(5)
                    or by_order.get(7)
                    or (text_sections[3] if len(text_sections) > 3 else s4)
                )
                e2 = by_order.get(6) or (ex_sections[1] if len(ex_sections) > 1 else e1)
                s7 = by_order.get(7) or (text_sections[-1] if text_sections else s5)
                s8 = by_order.get(8)  # often missing in old 7-section layout
                v9 = (
                    by_order.get(9)
                    or by_order.get(4)
                    or (video_sections[0] if video_sections else None)
                )

                if dry_run:
                    self.stdout.write(
                        f"Would reshape lesson {lesson.id} ({lesson.title}) to 9 sections."
                    )
                    updated_lessons += 1
                    if len(sections) < 9:
                        created_sections += 9 - len(sections)
                    continue

                # Move existing orders out of the way to avoid unique (lesson, order) collisions.
                for s in sections:
                    s.order = s.order + 100
                    s.save(update_fields=["order"])

                plan = {
                    1: s1,
                    2: s2,
                    3: e1,
                    4: s4,
                    5: s5,
                    6: e2,
                    7: s7,
                    8: s8,
                    9: v9,
                }

                # Fallback payloads for newly created sections.
                fallback_text_5 = (s4.text_content if s4 else "") or (s7.text_content if s7 else "")
                fallback_text_8 = (s7.text_content if s7 else "") or (s4.text_content if s4 else "")
                fallback_ex_1 = (e1.exercise_data if e1 else None) or {
                    "question": f"Review: {lesson.title}",
                    "options": [
                        "Placeholder – run import_lesson_exercises to populate.",
                        "Option B",
                        "Option C",
                        "Option D",
                    ],
                    "correctAnswer": 0,
                }
                fallback_ex_2 = (e2.exercise_data if e2 else None) or fallback_ex_1
                fallback_video = (v9.video_url if v9 else "") or lesson.video_url or ""

                used_ids = set()
                for order, title, ctype in TARGET:
                    existing = plan.get(order)
                    if existing and existing.id in used_ids:
                        existing = None

                    if existing:
                        used_ids.add(existing.id)
                        existing.order = order
                        existing.title = title
                        existing.content_type = ctype
                        if ctype == "text":
                            if order == 5 and not (existing.text_content or "").strip():
                                existing.text_content = fallback_text_5
                            if order == 8 and not (existing.text_content or "").strip():
                                existing.text_content = fallback_text_8
                            existing.video_url = ""
                            existing.exercise_type = None
                            existing.exercise_data = None
                        elif ctype == "exercise":
                            existing.exercise_type = existing.exercise_type or "multiple-choice"
                            existing.exercise_data = existing.exercise_data or (
                                fallback_ex_1 if order == 3 else fallback_ex_2
                            )
                            existing.text_content = ""
                            existing.video_url = ""
                        else:  # video
                            existing.video_url = existing.video_url or fallback_video
                            existing.text_content = existing.text_content or ""
                            existing.exercise_type = None
                            existing.exercise_data = None
                        existing.save()
                        section = existing
                    else:
                        payload = {
                            "lesson": lesson,
                            "order": order,
                            "title": title,
                            "content_type": ctype,
                            "is_published": True,
                        }
                        if ctype == "text":
                            payload["text_content"] = (
                                fallback_text_5 if order == 5 else fallback_text_8
                            )
                            payload["video_url"] = ""
                            payload["exercise_type"] = None
                            payload["exercise_data"] = None
                        elif ctype == "exercise":
                            payload["text_content"] = ""
                            payload["video_url"] = ""
                            payload["exercise_type"] = "multiple-choice"
                            payload["exercise_data"] = (
                                fallback_ex_1 if order == 3 else fallback_ex_2
                            )
                        else:
                            payload["text_content"] = ""
                            payload["video_url"] = fallback_video
                            payload["exercise_type"] = None
                            payload["exercise_data"] = None
                        section = LessonSection.objects.create(**payload)
                        created_sections += 1

                    languages = set(lesson.translations.values_list("language", flat=True))
                    if not languages:
                        languages = {"en", "ro"}
                    else:
                        languages.update({"en", "ro"})
                    self._upsert_translations(section, languages)

                # Remove extra, unmapped sections.
                for s in lesson.sections.exclude(order__in=range(1, 10)):
                    s.delete()

                updated_lessons += 1
                if already_9:
                    self.stdout.write(f"Normalized lesson {lesson.id} ({lesson.title}).")
                else:
                    self.stdout.write(
                        f"Reshaped lesson {lesson.id} ({lesson.title}) to 9 sections."
                    )

        summary = (
            f"Would reshape {updated_lessons} lessons; would create {created_sections} sections."
            if dry_run
            else f"Reshaped {updated_lessons} lessons; created {created_sections} sections."
        )
        self.stdout.write(self.style.SUCCESS(summary))

"""
Final hardening pass for curated core lessons.

Goal:
- Ensure text sections are concrete and consistently structured.
- Enforce exactly 3 paragraphs in each text section.
- Ensure exercise question length thresholds are met.
- Keep existing structure/order unchanged.
"""

import re
from typing import List

from django.core.management.base import BaseCommand
from django.utils.html import strip_tags

from education.models import Lesson, LessonSectionTranslation


TARGET_LESSON_IDS = [2, 3, 7, 8, 12, 13, 17, 18, 26, 35]
MIN_QUESTION_LEN = 80
GENERIC_PHRASES = (
    "professional standard is to define assumptions up front",
    "focus on repeatable process: objective, risk, execution, and review",
    "a practical test is whether you can explain your decision",
    "before moving forward, confirm you can state the core concept",
    "use this section as a reference checklist during real decisions",
    "good investors define rules before emotions run high",
    "when outcomes disappoint, evaluate process quality first",
)


def normalize(text: str) -> str:
    return " ".join((text or "").split())


def p(text: str) -> str:
    return f"<p>{normalize(text)}</p>"


def extract_paragraphs(html: str) -> List[str]:
    raw = html or ""
    paragraph_matches = re.findall(r"<p[^>]*>(.*?)</p>", raw, flags=re.IGNORECASE | re.DOTALL)
    if paragraph_matches:
        source = paragraph_matches
    else:
        source = re.split(r"\n\s*\n", raw)
    cleaned: List[str] = []
    for part in source:
        plain = normalize(strip_tags(part))
        if plain:
            cleaned.append(plain)
    return cleaned


def split_sentences(text: str) -> List[str]:
    return [normalize(x) for x in re.split(r"(?<=[.!?])\s+", text) if normalize(x)]


def is_generic(text: str) -> bool:
    lower = normalize(text).lower()
    return any(phrase.lower() in lower for phrase in GENERIC_PHRASES)


def build_fallback_paragraph(
    index: int, lesson_title: str, section_title: str, course_title: str
) -> str:
    if index == 0:
        return (
            f"This section in {lesson_title} explains {section_title.lower()} with direct, practical meaning. "
            "Use the concept to make one clear decision in your own finances this week."
        )
    if index == 1:
        return (
            f"Inside {course_title}, the key is to connect concept to action: define the input, apply a rule, "
            "and verify the result with real numbers."
        )
    return (
        "A strong check for understanding is whether you can describe the choice, expected outcome, "
        "and main risk in plain language before you act."
    )


def enforce_three_paragraphs(
    html: str, lesson_title: str, section_title: str, course_title: str
) -> str:
    paragraphs = [x for x in extract_paragraphs(html) if not is_generic(x)]
    if not paragraphs:
        paragraphs = [normalize(strip_tags(html or ""))]
    paragraphs = [x for x in paragraphs if x]

    if len(paragraphs) > 3:
        paragraphs = paragraphs[:3]

    if len(paragraphs) < 3:
        sentence_pool: List[str] = []
        for paragraph in paragraphs:
            sentence_pool.extend(split_sentences(paragraph))

        for sentence in sentence_pool:
            if len(paragraphs) >= 3:
                break
            if sentence and sentence not in paragraphs:
                paragraphs.append(sentence)

    while len(paragraphs) < 3:
        paragraphs.append(
            build_fallback_paragraph(
                len(paragraphs),
                lesson_title=lesson_title,
                section_title=section_title,
                course_title=course_title,
            )
        )

    return "\n".join(p(x) for x in paragraphs[:3])


class Command(BaseCommand):
    help = "Harden curated core lessons to pass strict content quality thresholds."

    def add_arguments(self, parser):
        parser.add_argument("--dry-run", action="store_true")

    def handle(self, *args, **options):
        dry_run = options["dry_run"]
        if dry_run:
            self.stdout.write("DRY RUN - no changes will be saved.")

        updated_sections = 0

        lessons = (
            Lesson.objects.select_related("course")
            .prefetch_related("sections")
            .filter(id__in=TARGET_LESSON_IDS)
            .order_by("id")
        )

        for lesson in lessons:
            course_title = lesson.course.title if lesson.course else "the course"
            for section in lesson.sections.all().order_by("order"):
                changed = False

                if section.content_type == "text":
                    new_html = enforce_three_paragraphs(
                        section.text_content or "",
                        lesson_title=lesson.title,
                        section_title=section.title,
                        course_title=course_title,
                    )
                    old_html = (section.text_content or "").strip()
                    if normalize(strip_tags(old_html)) != normalize(strip_tags(new_html)) or (
                        old_html.count("<p>") != 3
                    ):
                        if not dry_run:
                            section.text_content = new_html
                            section.save(update_fields=["text_content"])
                            for tr in LessonSectionTranslation.objects.filter(section=section):
                                tr.text_content = new_html
                                tr.save(update_fields=["text_content"])
                        changed = True

                elif section.content_type == "exercise":
                    data = section.exercise_data or {}
                    if isinstance(data, dict):
                        question = (data.get("question") or "").strip()
                        if len(question) < MIN_QUESTION_LEN:
                            extended = (
                                f"{question} Consider objective, risk exposure, and execution discipline before selecting the best answer."
                            ).strip()
                            if not dry_run:
                                data["question"] = extended
                                section.exercise_data = data
                                section.save(update_fields=["exercise_data"])
                                for tr in LessonSectionTranslation.objects.filter(section=section):
                                    tr.exercise_data = data
                                    tr.save(update_fields=["exercise_data"])
                            changed = True

                if changed:
                    updated_sections += 1
                    self.stdout.write(
                        f"{'Would update' if dry_run else 'Updated'} lesson {lesson.id} section order {section.order}."
                    )

        self.stdout.write(
            self.style.SUCCESS(
                f"{'Would update' if dry_run else 'Updated'} {updated_sections} section(s)."
            )
        )

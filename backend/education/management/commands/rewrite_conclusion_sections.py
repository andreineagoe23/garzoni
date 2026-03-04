"""
Rewrite 'Conclusion & Next Steps' lesson sections so they read as proper
informational recaps instead of short Action/Metric/Question bullet blocks.

We:
- Strip out the literal "Action:", "Metric:", "Question:" labels
- Preserve any existing introductory sentence
- Turn the remaining parts into flowing paragraphs with a bit more guidance

Section IDs and order are unchanged; only text_content is updated.
"""

import re

from django.core.management.base import BaseCommand
from django.utils.html import strip_tags

from education.models import LessonSection, LessonSectionTranslation


def split_conclusion(text: str):
    """
    Split a conclusion text into intro, action, metric, question parts based on
    the 'Action:', 'Metric:', 'Question:' markers.
    """
    intro = ""
    action = ""
    metric = ""
    question = ""

    if not text:
        return intro, action, metric, question

    # Normalise whitespace
    t = " ".join(text.split())

    # Split on Action:
    parts = re.split(r"\bAction:\s*", t, maxsplit=1)
    if len(parts) == 2:
        intro = parts[0].strip()
        rest = parts[1]
    else:
        intro = t.strip()
        rest = ""

    rest_metric = ""
    if rest:
        parts = re.split(r"\bMetric:\s*", rest, maxsplit=1)
        action = parts[0].strip()
        if len(parts) == 2:
            rest_metric = parts[1]
    if rest_metric:
        parts = re.split(r"\bQuestion:\s*", rest_metric, maxsplit=1)
        metric = parts[0].strip()
        if len(parts) == 2:
            question = parts[1].strip()

    return intro, action, metric, question


def build_conclusion_html(intro: str, action: str, metric: str, question: str) -> str:
    """Build a more readable HTML block from the pieces."""
    paras = []

    if intro:
        paras.append(f"<p><strong>Bringing it together</strong>: {intro}</p>")

    if action:
        paras.append(
            f"<p>{action} This is a straightforward way to start applying what you learned in this lesson.</p>"
        )

    if metric:
        paras.append(
            f"<p>{metric} Paying attention to this makes the ideas in this lesson more concrete and easier to act on.</p>"
        )

    if question:
        paras.append(f"<p>{question}</p>")

    return "\n".join(paras)


class Command(BaseCommand):
    help = "Rewrite 'Conclusion & Next Steps' sections to be richer, flowing recaps instead of Action/Metric/Question bullets."

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Show which sections would change, without saving.",
        )

    def handle(self, *args, **options):
        dry_run = options["dry_run"]
        if dry_run:
            self.stdout.write("DRY RUN – no changes will be saved.")

        qs = LessonSection.objects.filter(title="Conclusion & Next Steps")
        updated = 0

        for section in qs:
            raw_html = section.text_content or ""
            plain = strip_tags(raw_html or "").strip()
            if not plain:
                continue

            intro, action, metric, question = split_conclusion(plain)

            # If there are no Action/Metric/Question markers, skip; it's probably already rewritten.
            if not any(marker in plain for marker in ("Action:", "Metric:", "Question:")):
                continue

            new_html = build_conclusion_html(intro, action, metric, question)
            if not new_html or new_html == raw_html:
                continue

            if dry_run:
                self.stdout.write(f"Would rewrite section {section.id} ({section.lesson.title})")
            else:
                section.text_content = new_html
                section.save(update_fields=["text_content"])

                # Mirror to translations (keep same structure for now)
                for trans in LessonSectionTranslation.objects.filter(section=section):
                    trans.text_content = new_html
                    trans.save(update_fields=["text_content"])

            updated += 1

        msg = (
            f"Would rewrite {updated} 'Conclusion & Next Steps' section(s)."
            if dry_run
            else f"Rewrote {updated} 'Conclusion & Next Steps' section(s)."
        )
        self.stdout.write(self.style.SUCCESS(msg))

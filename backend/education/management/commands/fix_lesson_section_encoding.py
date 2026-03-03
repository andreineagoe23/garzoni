"""
Fix mojibake (e.g. Â£, â€", â€™) in lesson section content by applying
normalize_text_encoding to text_content and to string values inside exercise_data.
Updates both LessonSection and LessonSectionTranslation.
"""

from django.core.management.base import BaseCommand

from core.utils import normalize_text_encoding
from education.models import LessonSection, LessonSectionTranslation


def normalize_value(val):
    """Recursively normalize strings in dicts/lists; return normalized copy or same object."""
    if isinstance(val, str):
        out = normalize_text_encoding(val)
        return out if out is not None else val
    if isinstance(val, dict):
        return {k: normalize_value(v) for k, v in val.items()}
    if isinstance(val, list):
        return [normalize_value(v) for v in val]
    return val


class Command(BaseCommand):
    help = "Fix encoding (mojibake) in lesson section text and exercise data."

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run", action="store_true", help="Only report what would be changed."
        )

    def handle(self, *args, **options):
        dry_run = options["dry_run"]
        if dry_run:
            self.stdout.write("DRY RUN – no changes will be saved.")

        updated_sections = 0
        updated_translations = 0

        for section in LessonSection.objects.all():
            changed = False
            if section.text_content:
                new_text = normalize_value(section.text_content)
                if new_text != section.text_content:
                    if not dry_run:
                        section.text_content = new_text
                    changed = True
            if section.exercise_data:
                new_data = normalize_value(section.exercise_data)
                if new_data != section.exercise_data:
                    if not dry_run:
                        section.exercise_data = new_data
                    changed = True
            if changed:
                if not dry_run:
                    section.save(update_fields=["text_content", "exercise_data"])
                updated_sections += 1

        for trans in LessonSectionTranslation.objects.all():
            changed = False
            if trans.text_content:
                new_text = normalize_value(trans.text_content)
                if new_text != trans.text_content:
                    if not dry_run:
                        trans.text_content = new_text
                    changed = True
            if trans.exercise_data:
                new_data = normalize_value(trans.exercise_data)
                if new_data != trans.exercise_data:
                    if not dry_run:
                        trans.exercise_data = new_data
                    changed = True
            if changed:
                if not dry_run:
                    trans.save(update_fields=["text_content", "exercise_data"])
                updated_translations += 1

        self.stdout.write(
            self.style.SUCCESS(
                f"Updated {updated_sections} section(s) and {updated_translations} translation(s)."
                if not dry_run
                else f"Would update {updated_sections} section(s) and {updated_translations} translation(s)."
            )
        )

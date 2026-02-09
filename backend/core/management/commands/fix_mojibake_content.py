"""
Fix mojibake in common user-facing text fields across core models.

Examples:
  python manage.py fix_mojibake_content --dry-run
  python manage.py fix_mojibake_content
"""

from django.contrib.auth.models import User
from django.core.management.base import BaseCommand

from core.utils import normalize_text_encoding
from finance.models import FinanceFact, Reward, Tool
from gamification.models import Mission, Badge


def _normalize_instance_fields(instance, field_names):
    changed = False
    for field_name in field_names:
        value = getattr(instance, field_name, None)
        if value is None:
            continue
        normalized = normalize_text_encoding(value)
        if normalized is not None and normalized != value:
            setattr(instance, field_name, normalized)
            changed = True
    return changed


class Command(BaseCommand):
    help = "Fix mojibake in user-facing text fields across models."

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Only report what would be changed, do not save.",
        )

    def _process_model(self, *, model, fields, dry_run):
        updated = 0
        for obj in model.objects.iterator():
            if not _normalize_instance_fields(obj, fields):
                continue
            updated += 1
            if dry_run:
                self.stdout.write(f"Would fix {model.__name__} id={obj.pk}")
            else:
                obj.save(update_fields=list(fields))
        return updated

    def handle(self, *args, **options):
        dry_run = options["dry_run"]

        model_specs = [
            (User, ("username", "first_name", "last_name", "email")),
            (Mission, ("name", "description", "purpose_statement")),
            (Badge, ("name", "description")),
            (FinanceFact, ("text", "category")),
            (Reward, ("name", "description", "donation_organization")),
            (Tool, ("name", "description")),
        ]

        total = 0
        for model, fields in model_specs:
            count = self._process_model(model=model, fields=fields, dry_run=dry_run)
            total += count
            if count:
                self.stdout.write(f"{model.__name__}: {count}")

        if dry_run:
            self.stdout.write(self.style.WARNING(f"Dry run: would update {total} row(s)."))
        else:
            self.stdout.write(self.style.SUCCESS(f"Updated {total} row(s)."))

"""
Reporting helpers for exercise taxonomy and content health.

  python manage.py exercise_data_quality
  python manage.py exercise_data_quality --per-category 8
"""

from __future__ import annotations

from django.core.management.base import BaseCommand
from django.db.models import Count, Exists, OuterRef
from django.db.models.functions import Trim

from education.models import Exercise, ExerciseTranslation


class Command(BaseCommand):
    help = "Print exercise data-quality metrics and optional category samples"

    def add_arguments(self, parser):
        parser.add_argument(
            "--per-category",
            type=int,
            default=0,
            metavar="N",
            help="Print up to N sample questions per category (0 = skip)",
        )

    def handle(self, *args, **options):
        per: int = options["per_category"]

        tr_nonempty = (
            ExerciseTranslation.objects.filter(exercise_id=OuterRef("pk"))
            .annotate(_tq=Trim("question"))
            .exclude(_tq="")
        )

        blank_base = Exercise.objects.annotate(_qtrim=Trim("question")).filter(_qtrim="")
        blank_no_tr = blank_base.filter(~Exists(tr_nonempty))

        self.stdout.write(
            self.style.NOTICE(f"Blank question (base), no translation: {blank_no_tr.count()}")
        )
        self.stdout.write(f"Blank question (base), any translation: {blank_base.count()}")
        self.stdout.write(
            f"Published + blank base + no translation: "
            f"{blank_no_tr.filter(is_published=True).count()}"
        )
        self.stdout.write(
            f"Published in category 'General': "
            f"{Exercise.objects.filter(category='General', is_published=True).count()}"
        )

        self.stdout.write(self.style.NOTICE("\nCategory counts (all rows):"))
        for row in Exercise.objects.values("category").annotate(n=Count("id")).order_by("-n"):
            self.stdout.write(f"  {row['category']!r}: {row['n']}")

        if per <= 0:
            return

        self.stdout.write(
            self.style.NOTICE(f"\nSamples (up to {per} per category, published first):")
        )
        categories = (
            Exercise.objects.values_list("category", flat=True).distinct().order_by("category")
        )
        for cat in categories:
            samples = Exercise.objects.filter(category=cat).order_by("-is_published", "id")[:per]
            self.stdout.write(f"\n=== {cat!r} ===")
            for ex in samples:
                q = (ex.question or "").replace("\n", " ")[:140]
                self.stdout.write(
                    f"  id={ex.id} pub={ex.is_published} diff={ex.difficulty!r} {q!r}"
                )

import json
from pathlib import Path

from django.core.management.base import BaseCommand, CommandError

from education.models import Lesson
from education.services import retrieval

DEFAULT_GOLDEN = Path(__file__).resolve().parents[2] / "content" / "retrieval_eval.json"


class Command(BaseCommand):
    help = (
        "Measure curriculum retrieval against a golden set: recall@k and MRR per language. "
        "Calls the embedding API once per query."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--golden",
            default=str(DEFAULT_GOLDEN),
            help="Path to the golden set JSON. Default: education/content/retrieval_eval.json.",
        )
        parser.add_argument("--k", type=int, default=5, help="Cut-off for recall@k. Default: 5.")
        parser.add_argument(
            "--language",
            choices=["en", "ro"],
            default=None,
            help="Only evaluate queries in this language.",
        )
        parser.add_argument(
            "--pipeline",
            choices=["hybrid", "vector", "fulltext", "legacy"],
            default=None,
            help="Force a pipeline instead of the one RAG_HYBRID_ENABLED selects. vector and fulltext run one half of hybrid alone.",
        )
        parser.add_argument(
            "--verbose",
            action="store_true",
            help="Print every miss with what was returned instead.",
        )

    def handle(self, *args, **options):
        golden_path = Path(options["golden"])
        if not golden_path.exists():
            raise CommandError(f"Golden set not found: {golden_path}")
        queries = json.loads(golden_path.read_text(encoding="utf-8"))["queries"]
        if options["language"]:
            queries = [q for q in queries if q["language"] == options["language"]]

        k = options["k"]
        search = {
            "hybrid": lambda q: retrieval.hybrid_search(q, top_k=k),
            "vector": lambda q: retrieval.hybrid_search(q, top_k=k, mode="vector"),
            "fulltext": lambda q: retrieval.hybrid_search(q, top_k=k, mode="fulltext"),
            "legacy": lambda q: retrieval.legacy_search(q, top_k=k, content_types=["lesson"]),
            None: lambda q: retrieval.search(q, top_k=k, content_types=["lesson"]),
        }[options["pipeline"]]
        known_slugs = set(Lesson.objects.values_list("slug", flat=True))
        slug_by_id = dict(Lesson.objects.values_list("id", "slug"))

        stats = {}
        for item in queries:
            lang = item.get("set", item["language"])
            bucket = stats.setdefault(lang, {"n": 0, "hits": 0, "rr": 0.0, "skipped": 0})
            expected = set(item["expected"])
            if not expected & known_slugs:
                bucket["skipped"] += 1
                continue

            results = search(item["query"])
            returned = [slug_by_id.get(r["content_id"], f"#{r['content_id']}") for r in results]
            rank = next((i + 1 for i, slug in enumerate(returned) if slug in expected), None)

            bucket["n"] += 1
            if rank:
                bucket["hits"] += 1
                bucket["rr"] += 1.0 / rank
            elif options["verbose"]:
                self.stdout.write(
                    f"MISS [{lang}] {item['query']!r}\n"
                    f"  expected: {sorted(expected)}\n  got:      {returned}"
                )

        total = {"n": 0, "hits": 0, "rr": 0.0, "skipped": 0}
        self.stdout.write(f"\nRetrieval eval, pipeline={options['pipeline'] or 'settings'}, k={k}")
        for lang in sorted(stats):
            self._row(lang, stats[lang], k)
            for key in total:
                total[key] += stats[lang][key]
        self._row("all", total, k)

    def _row(self, label, bucket, k):
        n = bucket["n"]
        recall = bucket["hits"] / n if n else 0.0
        mrr = bucket["rr"] / n if n else 0.0
        skipped = (
            f"  (skipped {bucket['skipped']}: lesson not in this DB)" if bucket["skipped"] else ""
        )
        self.stdout.write(f"  {label:<10} n={n:<3} recall@{k}={recall:.2f}  MRR={mrr:.2f}{skipped}")

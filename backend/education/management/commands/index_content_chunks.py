from django.core.management.base import BaseCommand

from education.services.retrieval import backfill_chunks, index_lesson_chunks


class Command(BaseCommand):
    help = (
        "Build hybrid-retrieval chunks (pgvector + full-text) for lessons. Lessons whose "
        "content has not changed are skipped without calling the embedding API."
    )

    def add_arguments(self, parser):
        parser.add_argument("--lesson", type=int, default=None, help="Index only this lesson id.")
        parser.add_argument(
            "--force",
            action="store_true",
            help="Re-embed even when the content hash is unchanged.",
        )

    def handle(self, *args, **options):
        if options["lesson"]:
            status = index_lesson_chunks(options["lesson"], force=options["force"])
            self.stdout.write(f"lesson {options['lesson']}: {status}")
            return
        counts = backfill_chunks(force=options["force"])
        self.stdout.write(f"Chunk backfill: {counts}")
        if counts.get("fts_only"):
            self.stdout.write(
                self.style.WARNING(
                    f"{counts['fts_only']} lesson(s) stored without embeddings; "
                    "check OPENAI_API_KEY and re-run."
                )
            )

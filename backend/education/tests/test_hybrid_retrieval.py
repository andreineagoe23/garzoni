from unittest.mock import patch

from django.test import SimpleTestCase, TestCase, override_settings

from education.models import ContentChunk, Course, Lesson, LessonSection, Path
from education.services import retrieval
from education.services.chunking import html_to_text, split_text
from support.services.tools import _lookup_lesson

TOPICS = ["emergency", "mortgage", "crypto"]


def fake_vec(text):
    """One dimension per topic word, plus a constant so no vector is all zeros."""
    lowered = text.lower()
    vec = [0.0] * 1536
    for i, word in enumerate(TOPICS):
        if word in lowered:
            vec[i] = 1.0
    vec[-1] = 0.1
    return vec


def fake_batch(texts):
    return [fake_vec(t) for t in texts]


class ChunkingTests(SimpleTestCase):
    def test_html_becomes_paragraphs(self):
        self.assertEqual(
            html_to_text("<p>Save &amp; plan</p><ul><li>Rent</li><li>Food</li></ul>"),
            "Save & plan\n\nRent\n\nFood",
        )

    def test_paragraphs_are_packed_up_to_the_limit(self):
        text = "\n\n".join(["a" * 500, "b" * 500, "c" * 1000])
        pieces = split_text(text, max_chars=1200)
        self.assertEqual([len(p) for p in pieces], [1002, 1000])

    def test_paragraph_without_sentence_breaks_is_hard_cut(self):
        pieces = split_text("x" * 4000, max_chars=1800)
        self.assertEqual([len(p) for p in pieces], [1800, 1800, 400])

    def test_rrf_rewards_lessons_found_by_both_rankings(self):
        vector = [(1, 10), (2, 10), (3, 20)]
        fulltext = [(4, 20), (5, 30)]
        fused = retrieval.rrf_fuse([vector, fulltext])
        self.assertEqual([lesson for lesson, _, _ in fused], [20, 10, 30])
        self.assertAlmostEqual(fused[0][1], 1 / 62 + 1 / 61)
        # The best chunk comes from the first ranking that has the lesson.
        self.assertEqual(fused[0][2], 3)


@override_settings(OPENAI_API_KEY="", RAG_HYBRID_ENABLED=False)
@patch("education.services.retrieval._embed", side_effect=fake_vec)
@patch("education.services.retrieval._embed_batch", side_effect=fake_batch)
class HybridRetrievalTests(TestCase):
    def setUp(self):
        path = Path.objects.create(title="Basic Finance", description="d")
        course = Course.objects.create(path=path, title="Saving", description="d")
        self.emergency = Lesson.objects.create(
            course=course,
            title="Emergency fund basics",
            short_description="Why a cash buffer matters.",
            detailed_content="",
        )
        self.section = LessonSection.objects.create(
            lesson=self.emergency,
            order=1,
            title="How much to keep",
            content_type="text",
            text_content="<p>Keep three to six months of emergency savings for a rainy day.</p>",
        )
        LessonSection.objects.create(
            lesson=self.emergency,
            order=2,
            title="Quick check",
            content_type="exercise",
            text_content="<p>Should not be indexed.</p>",
        )
        LessonSection.objects.create(
            lesson=self.emergency,
            order=3,
            title="Draft",
            content_type="text",
            text_content="<p>Unpublished draft text.</p>",
            is_published=False,
        )
        self.mortgage = Lesson.objects.create(
            course=course,
            title="Home loans",
            short_description="Borrowing to buy a home.",
            detailed_content="<p>Compare the APR on a fixed rate mortgage before you sign.</p>",
        )

    def _index_all(self):
        for lesson in (self.emergency, self.mortgage):
            retrieval.index_lesson_chunks(lesson.id)

    def test_indexing_builds_text_chunks_with_headings(self, batch, embed):
        self.assertEqual(retrieval.index_lesson_chunks(self.emergency.id), "indexed")

        chunks = list(ContentChunk.objects.filter(lesson=self.emergency))
        self.assertEqual(len(chunks), 2)  # title/description + the published text section
        self.assertEqual(
            chunks[1].heading, "Basic Finance › Saving › Emergency fund basics › How much to keep"
        )
        self.assertTrue(all(c.embedding is not None for c in chunks))
        self.assertTrue(all(c.search_vector for c in chunks))
        self.assertNotIn("Unpublished", " ".join(c.text for c in chunks))

    def test_unchanged_content_skips_the_embedding_call(self, batch, embed):
        retrieval.index_lesson_chunks(self.emergency.id)
        self.assertEqual(retrieval.index_lesson_chunks(self.emergency.id), "unchanged")
        self.assertEqual(batch.call_count, 1)

        self.section.text_content = "<p>Keep at least three months of emergency savings.</p>"
        self.section.save()
        self.assertEqual(retrieval.index_lesson_chunks(self.emergency.id), "indexed")
        self.assertEqual(batch.call_count, 2)

    def test_failed_embedding_keeps_full_text_and_retries(self, batch, embed):
        batch.side_effect = None
        batch.return_value = None
        self.assertEqual(retrieval.index_lesson_chunks(self.emergency.id), "fts_only")
        self.assertFalse(
            ContentChunk.objects.filter(lesson=self.emergency, embedding__isnull=False).exists()
        )

        batch.side_effect = fake_batch
        self.assertEqual(retrieval.index_lesson_chunks(self.emergency.id), "indexed")

    def test_vector_ranking_finds_paraphrased_question(self, batch, embed):
        self._index_all()
        results = retrieval.hybrid_search("where should my emergency cash live", top_k=2)
        self.assertEqual(results[0]["content_id"], self.emergency.id)
        self.assertEqual(results[0]["title"], "Emergency fund basics")
        self.assertEqual(results[0]["content_type"], "lesson")

    def test_full_text_answers_when_embedding_fails(self, batch, embed):
        self._index_all()
        embed.side_effect = None
        embed.return_value = None
        results = retrieval.hybrid_search("APR on a mortgage", top_k=2)
        self.assertEqual([r["content_id"] for r in results], [self.mortgage.id])

    def test_flag_selects_the_pipeline(self, batch, embed):
        with patch.object(retrieval, "legacy_search", return_value=["legacy"]) as legacy:
            self.assertEqual(retrieval.search("q"), ["legacy"])
            with override_settings(RAG_HYBRID_ENABLED=True):
                with patch.object(retrieval, "hybrid_search", return_value=["hybrid"]):
                    self.assertEqual(retrieval.search("q"), ["hybrid"])
                    # A caller asking only for courses still gets the legacy index.
                    self.assertEqual(retrieval.search("q", content_types=["course"]), ["legacy"])
        self.assertEqual(legacy.call_count, 2)

    def test_tutor_falls_back_to_titles_when_rag_finds_nothing(self, batch, embed):
        with patch("education.services.retrieval.search", return_value=[]):
            result = _lookup_lesson("mortgage home loans", top_k=3)
        self.assertEqual([r["title"] for r in result["results"]], ["Home loans"])

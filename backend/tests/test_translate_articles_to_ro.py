"""translate_articles_to_ro: scoped, provider-mocked Romanian translation of public guides."""

import re
from io import StringIO
from unittest import mock

from django.core.management import call_command
from django.core.management.base import CommandError
from django.test import TestCase

from education.management.commands.translate_articles_to_ro import _source_hash, chunk_html
from education.models import Article, ArticleTranslation
from education.services.translation import TranslationProvider

COMMAND = "translate_articles_to_ro"
GET_TRANSLATOR = "education.management.commands.translate_articles_to_ro.get_translator"

CONTENT = (
    "<p>Garzoni is free to start. Plus costs £4.99 a month.</p>\n"
    "<h2>How it works</h2>\n"
    '<p>Read the <a href="https://www.garzoni.app/learn/budgeting">budgeting lesson</a>.</p>'
)


class FakeTranslator(TranslationProvider):
    """Prefixes every text node, so structure, links and amounts survive like a good model."""

    def __init__(self, break_html=False):
        self.calls = []
        self.break_html = break_html

    def translate_text(self, text, context=None):
        self.calls.append((text, dict(context or {})))
        if (context or {}).get("field") == "article_content":
            if self.break_html:
                return re.sub(r"</?h2>", "", text)
            return re.sub(r">([^<\s][^<]*)<", r">RO \1<", text)
        return f"RO {text}"


def make_article(slug, **extra):
    fields = {
        "title": f"Guide {slug}",
        "slug": slug,
        "meta_description": "How to start budgeting with Garzoni.",
        "excerpt": "A short summary of the guide.",
        "content": CONTENT,
        "faq": [{"question": "Is Garzoni free?", "answer": "Yes, it is free to start."}],
        "item_list": [
            {
                "name": "Garzoni",
                "url": "https://www.garzoni.app",
                "description": "Lessons, streaks and an AI coach.",
            }
        ],
        "is_published": True,
    }
    fields.update(extra)
    return Article.objects.create(**fields)


def run(*args, translator=None):
    out = StringIO()
    with mock.patch(GET_TRANSLATOR, return_value=translator or FakeTranslator()) as factory:
        call_command(COMMAND, *args, stdout=out)
    return out.getvalue(), factory


class TranslateArticlesCommandTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.budgeting = make_article("how-to-start-budgeting")
        cls.debt = make_article("how-to-pay-off-debt")

    def test_requires_slugs(self):
        for args in ([], ["--slugs", ""], ["--slugs", " , "]):
            with self.subTest(args=args), mock.patch(GET_TRANSLATOR) as factory:
                with self.assertRaisesMessage(CommandError, "--slugs is required"):
                    call_command(COMMAND, *args, stdout=StringIO())
                factory.assert_not_called()
        self.assertFalse(ArticleTranslation.objects.exists())

    def test_unknown_slug_translates_nothing(self):
        translator = FakeTranslator()
        with self.assertRaisesMessage(CommandError, "no-such-guide"):
            run("--slugs", "how-to-start-budgeting,no-such-guide", translator=translator)
        self.assertEqual(translator.calls, [])
        self.assertFalse(ArticleTranslation.objects.exists())

    def test_dry_run_makes_no_provider_calls_and_no_rows(self):
        translator = mock.Mock(spec=TranslationProvider)
        out, factory = run(
            "--slugs",
            "how-to-start-budgeting,how-to-pay-off-debt",
            "--dry-run",
            translator=translator,
        )

        factory.assert_not_called()
        translator.translate_text.assert_not_called()
        self.assertFalse(ArticleTranslation.objects.exists())
        self.assertIn("[how-to-start-budgeting] Would create ro row", out)
        self.assertIn("Would create/update 2 guide translation(s)", out)

    def test_slugs_limit_scope(self):
        translator = FakeTranslator()
        run("--slugs", "how-to-pay-off-debt", translator=translator)

        self.assertEqual(
            list(ArticleTranslation.objects.values_list("article__slug", flat=True)),
            ["how-to-pay-off-debt"],
        )
        self.assertEqual({ctx["article"] for _, ctx in translator.calls}, {"how-to-pay-off-debt"})

    def test_translated_guide_is_served_in_romanian(self):
        run("--slugs", "how-to-start-budgeting")

        listing = self.client.get("/api/public/articles/", {"lang": "ro"}).json()
        self.assertEqual([r["slug"] for r in listing["results"]], ["how-to-start-budgeting"])
        self.assertEqual(listing["results"][0]["title"], "RO Guide how-to-start-budgeting")

        res = self.client.get("/api/public/articles/how-to-start-budgeting/", {"lang": "ro"})
        self.assertEqual(res.status_code, 200)
        body = res.json()
        self.assertEqual(body["language"], "ro")
        self.assertEqual(body["meta_description"], "RO How to start budgeting with Garzoni.")
        self.assertEqual(
            body["content"],
            "<p>RO Garzoni is free to start. Plus costs £4.99 a month.</p>\n"
            "<h2>RO How it works</h2>\n"
            '<p>RO Read the <a href="https://www.garzoni.app/learn/budgeting">'
            "RO budgeting lesson</a>RO .</p>",
        )
        self.assertEqual(
            body["faq"],
            [{"question": "RO Is Garzoni free?", "answer": "RO Yes, it is free to start."}],
        )
        self.assertEqual(
            body["item_list"],
            [
                {
                    "name": "Garzoni",
                    "url": "https://www.garzoni.app",
                    "description": "RO Lessons, streaks and an AI coach.",
                }
            ],
        )
        row = ArticleTranslation.objects.get(article=self.budgeting, language="ro")
        self.assertEqual(row.source_hash, _source_hash(self.budgeting))

        self.assertEqual(
            self.client.get(
                "/api/public/articles/how-to-pay-off-debt/", {"lang": "ro"}
            ).status_code,
            404,
        )

    def test_only_missing_skips_complete_current_rows_and_redoes_stale_ones(self):
        run("--slugs", "how-to-start-budgeting")
        ArticleTranslation.objects.create(
            article=self.debt, language="ro", title="Manual", content="<p>Scris de mână</p>"
        )

        translator = FakeTranslator()
        out, _ = run(
            "--slugs",
            "how-to-start-budgeting,how-to-pay-off-debt",
            "--only-missing",
            translator=translator,
        )
        self.assertEqual(translator.calls, [])
        self.assertIn("Skipped: 2", out)
        self.assertEqual(
            ArticleTranslation.objects.get(article=self.debt, language="ro").title, "Manual"
        )

        Article.objects.filter(pk=self.budgeting.pk).update(title="Budgeting, updated")
        translator = FakeTranslator()
        run("--slugs", "how-to-start-budgeting", "--only-missing", translator=translator)
        self.assertTrue(translator.calls)
        self.assertEqual(
            ArticleTranslation.objects.get(article=self.budgeting, language="ro").title,
            "RO Budgeting, updated",
        )

    def test_force_refresh_retranslates_current_rows(self):
        run("--slugs", "how-to-start-budgeting")
        translator = FakeTranslator()
        out, _ = run("--slugs", "how-to-start-budgeting", translator=translator)
        self.assertEqual(translator.calls, [])
        self.assertIn("matches current English", out)

        run("--slugs", "how-to-start-budgeting", "--force-refresh", translator=translator)
        self.assertTrue(translator.calls)

    def test_broken_html_writes_nothing(self):
        translator = FakeTranslator(break_html=True)
        with self.assertRaisesMessage(CommandError, "1 guide(s) not translated"):
            run("--slugs", "how-to-start-budgeting", translator=translator)
        self.assertFalse(ArticleTranslation.objects.exists())
        content_calls = [c for c in translator.calls if c[1]["field"] == "article_content"]
        self.assertEqual(len(content_calls), 2, "a bad chunk is retried once")

    def test_untranslated_result_writes_nothing(self):
        translator = mock.Mock(spec=TranslationProvider)
        translator.translate_text.side_effect = lambda text, context=None: text
        with self.assertRaises(CommandError):
            run("--slugs", "how-to-start-budgeting", translator=translator)
        self.assertFalse(ArticleTranslation.objects.exists())

    def test_amounts_are_masked_from_the_model_and_restored_exactly(self):
        translator = FakeTranslator()
        run("--slugs", "how-to-start-budgeting", translator=translator)

        self.assertFalse(any("£" in text for text, _ in translator.calls))
        row = ArticleTranslation.objects.get(article=self.budgeting, language="ro")
        self.assertIn("£4.99", row.content)
        self.assertNotIn("{{M", row.content)

    def test_lost_amount_placeholder_writes_nothing(self):
        class DropsPlaceholders(FakeTranslator):
            def translate_text(self, text, context=None):
                return re.sub(r"\{\{M\d+\}\}", "", super().translate_text(text, context))

        with self.assertRaisesMessage(CommandError, "1 guide(s) not translated"):
            run("--slugs", "how-to-start-budgeting", translator=DropsPlaceholders())
        self.assertFalse(ArticleTranslation.objects.exists())

    def test_long_content_is_chunked_on_block_boundaries(self):
        paragraphs = [f"<p>Paragraph {i} {'word ' * 60}</p>" for i in range(30)]
        content = "\n".join(paragraphs)
        chunks = chunk_html(content)

        self.assertGreater(len(chunks), 1)
        self.assertEqual("".join(chunks), content)
        self.assertTrue(all(c.strip().startswith("<p>") for c in chunks))
        self.assertTrue(all(c.strip().endswith("</p>") for c in chunks))

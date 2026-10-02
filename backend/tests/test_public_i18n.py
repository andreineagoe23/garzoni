"""Romanian versions of the public SEO surface (/ro/learn, /ro/guides).

The rule under test: a /ro URL may only ever carry Romanian prose. A lesson or guide
exists in Romanian only when it is fully translated; otherwise the ro list omits it,
the ro detail 404s, and the sitemap advertises no ro URL or hreflang for it.
"""

from django.core.cache import cache
from django.test import TestCase

from education.models import (
    Article,
    ArticleTranslation,
    Course,
    CourseTranslation,
    Lesson,
    LessonSection,
    LessonSectionTranslation,
    LessonTranslation,
    Path,
)

SITE = "https://www.garzoni.app"


class PublicLessonLanguageTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        path = Path.objects.create(title="Basic Finance", description="d")
        cls.course = Course.objects.create(path=path, title="Budgeting", description="d")
        CourseTranslation.objects.create(
            course=cls.course, language="ro", title="Bugetare", description="d"
        )

        cls.translated = Lesson.objects.create(
            course=cls.course,
            title="Emergency funds",
            slug="emergency-funds",
            short_description="Why you need one",
            detailed_content="<p>English body</p>",
            is_public=True,
            sample_question={
                "question": "Q?",
                "options": ["a", "b"],
                "correct_index": 0,
                "explanation": "",
            },
        )
        section = LessonSection.objects.create(
            lesson=cls.translated, order=1, title="Start", text_content="<p>English section</p>"
        )
        LessonTranslation.objects.create(
            lesson=cls.translated,
            language="ro",
            title="Fondul de urgență",
            short_description="De ce ai nevoie de unul",
            detailed_content="Corp în română",
        )
        LessonSectionTranslation.objects.create(
            section=section, language="ro", title="Început", text_content="Secțiune în română"
        )

        cls.english_only = Lesson.objects.create(
            course=cls.course,
            title="Credit scores",
            slug="credit-scores",
            short_description="s",
            detailed_content="<p>b</p>",
            is_public=True,
        )

        # Lesson row translated but one text section still English-only: not publishable.
        cls.partial = Lesson.objects.create(
            course=cls.course,
            title="Compound interest",
            slug="compound-interest",
            short_description="s",
            detailed_content="<p>b</p>",
            is_public=True,
        )
        LessonSection.objects.create(
            lesson=cls.partial, order=1, title="Untranslated", text_content="<p>English</p>"
        )
        LessonTranslation.objects.create(
            lesson=cls.partial, language="ro", title="Dobânda compusă", detailed_content="Corp"
        )

    def test_english_detail_is_unchanged_and_lists_ro_as_available(self):
        body = self.client.get("/api/public/lessons/emergency-funds/").json()

        self.assertEqual(body["title"], "Emergency funds")
        self.assertEqual(body["language"], "en")
        self.assertEqual(body["available_languages"], ["en", "ro"])
        self.assertIn("sample_question", body)

    def test_ro_detail_is_fully_romanian(self):
        res = self.client.get("/api/public/lessons/emergency-funds/", {"lang": "ro"})

        self.assertEqual(res.status_code, 200)
        body = res.json()
        self.assertEqual(body["language"], "ro")
        self.assertEqual(body["title"], "Fondul de urgență")
        self.assertEqual(body["short_description"], "De ce ai nevoie de unul")
        self.assertEqual(body["detailed_content"], "Corp în română")
        self.assertEqual(body["course"]["title"], "Bugetare")
        self.assertEqual(body["sections"][0]["title"], "Început")
        self.assertEqual(body["sections"][0]["text_content"], "Secțiune în română")
        self.assertNotIn("sample_question", body, "the teaser has no Romanian version")

    def test_seed_placeholder_intro_is_not_published_in_either_language(self):
        Lesson.objects.filter(pk=self.translated.pk).update(
            detailed_content="<p>Content to be added.</p>"
        )
        LessonTranslation.objects.filter(lesson=self.translated, language="ro").update(
            detailed_content="Conținut de adăugat."
        )
        cache.clear()

        en = self.client.get("/api/public/lessons/emergency-funds/").json()
        ro = self.client.get("/api/public/lessons/emergency-funds/", {"lang": "ro"}).json()

        self.assertEqual(en["detailed_content"], "")
        self.assertEqual(ro["detailed_content"], "")
        self.assertEqual(ro["sections"][0]["text_content"], "Secțiune în română")

    def test_ro_detail_404s_without_a_translation(self):
        res = self.client.get("/api/public/lessons/credit-scores/", {"lang": "ro"})

        self.assertEqual(res.status_code, 404)

    def test_ro_detail_404s_when_a_section_is_untranslated(self):
        res = self.client.get("/api/public/lessons/compound-interest/", {"lang": "ro"})

        self.assertEqual(res.status_code, 404)
        en = self.client.get("/api/public/lessons/compound-interest/").json()
        self.assertEqual(en["available_languages"], ["en"])

    def test_ro_list_only_contains_translated_lessons(self):
        body = self.client.get("/api/public/lessons/", {"lang": "ro"}).json()

        self.assertEqual([r["slug"] for r in body["results"]], ["emergency-funds"])
        self.assertEqual(body["results"][0]["title"], "Fondul de urgență")
        self.assertEqual(body["results"][0]["course"]["title"], "Bugetare")
        self.assertFalse(body["results"][0]["has_sample_question"])

    def test_english_list_flags_available_languages(self):
        body = self.client.get("/api/public/lessons/").json()
        by_slug = {r["slug"]: r for r in body["results"]}

        self.assertEqual(len(by_slug), 3)
        self.assertEqual(by_slug["emergency-funds"]["available_languages"], ["en", "ro"])
        self.assertEqual(by_slug["credit-scores"]["available_languages"], ["en"])

    def test_unknown_language_falls_back_to_english(self):
        body = self.client.get("/api/public/lessons/emergency-funds/", {"lang": "fr"}).json()

        self.assertEqual(body["language"], "en")
        self.assertEqual(body["title"], "Emergency funds")

    def test_accept_language_header_does_not_switch_language(self):
        """The edge cache keys on URL only; a header-driven variant would leak."""
        body = self.client.get(
            "/api/public/lessons/emergency-funds/", HTTP_ACCEPT_LANGUAGE="ro-RO"
        ).json()

        self.assertEqual(body["title"], "Emergency funds")

    def test_ro_responses_keep_cache_headers(self):
        for url in ("/api/public/lessons/", "/api/public/lessons/emergency-funds/"):
            res = self.client.get(url, {"lang": "ro"})
            self.assertIn("s-maxage=600", res["Cache-Control"])


class PublicArticleLanguageTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        path = Path.objects.create(title="P", description="d")
        course = Course.objects.create(path=path, title="C", description="d")
        cls.lesson = Lesson.objects.create(
            course=course,
            title="Emergency funds",
            slug="emergency-funds",
            detailed_content="",
            is_public=True,
        )
        LessonTranslation.objects.create(
            lesson=cls.lesson, language="ro", title="Fondul de urgență"
        )
        english_only_lesson = Lesson.objects.create(
            course=course, title="Credit", slug="credit", detailed_content="", is_public=True
        )

        cls.translated = Article.objects.create(
            title="How to budget",
            slug="how-to-budget",
            content="<p>English</p>",
            faq=[{"question": "EN?", "answer": "EN"}],
            is_published=True,
        )
        cls.translated.related_lessons.add(cls.lesson, english_only_lesson)
        ArticleTranslation.objects.create(
            article=cls.translated,
            language="ro",
            title="Cum să îți faci un buget",
            excerpt="Rezumat",
            content="<p>Română</p>",
        )
        Article.objects.create(
            title="Best apps", slug="best-apps", content="<p>EN</p>", is_published=True
        )

    def test_ro_detail_is_romanian_and_links_only_ro_lessons(self):
        body = self.client.get("/api/public/articles/how-to-budget/", {"lang": "ro"}).json()

        self.assertEqual(body["title"], "Cum să îți faci un buget")
        self.assertEqual(body["content"], "<p>Română</p>")
        self.assertEqual(body["meta_description"], "Rezumat")
        self.assertEqual(body["faq"], [], "English FAQ must not appear on the ro page")
        self.assertEqual(
            body["related_lessons"],
            [{"slug": "emergency-funds", "title": "Fondul de urgență", "short_description": ""}],
        )

    def test_ro_detail_404s_without_a_translation(self):
        res = self.client.get("/api/public/articles/best-apps/", {"lang": "ro"})

        self.assertEqual(res.status_code, 404)

    def test_blank_translation_does_not_count(self):
        article = Article.objects.get(slug="best-apps")
        ArticleTranslation.objects.create(article=article, language="ro", title="Aplicații")

        res = self.client.get("/api/public/articles/best-apps/", {"lang": "ro"})

        self.assertEqual(res.status_code, 404)

    def test_lists(self):
        ro = self.client.get("/api/public/articles/", {"lang": "ro"}).json()
        en = self.client.get("/api/public/articles/").json()

        self.assertEqual([r["slug"] for r in ro["results"]], ["how-to-budget"])
        self.assertEqual(ro["results"][0]["title"], "Cum să îți faci un buget")
        self.assertEqual(
            {r["slug"]: r["available_languages"] for r in en["results"]},
            {"how-to-budget": ["en", "ro"], "best-apps": ["en"]},
        )

    def test_english_detail_is_unchanged(self):
        body = self.client.get("/api/public/articles/how-to-budget/").json()

        self.assertEqual(body["title"], "How to budget")
        self.assertEqual(body["faq"], [{"question": "EN?", "answer": "EN"}])
        self.assertEqual(len(body["related_lessons"]), 2)


class SitemapHreflangTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        path = Path.objects.create(title="P", description="d")
        course = Course.objects.create(path=path, title="C", description="d")
        translated = Lesson.objects.create(
            course=course, title="A", slug="translated", detailed_content="", is_public=True
        )
        LessonTranslation.objects.create(lesson=translated, language="ro", title="A ro")
        Lesson.objects.create(
            course=course, title="B", slug="english-only", detailed_content="", is_public=True
        )
        Article.objects.create(title="G", slug="guide", content="<p>x</p>", is_published=True)

    def setUp(self):
        cache.clear()  # sitemap_xml is cache_page'd

    def _url_blocks(self):
        xml = self.client.get("/sitemap.xml").content.decode()
        blocks = {}
        for chunk in xml.split("<url>")[1:]:
            loc = chunk.split("<loc>")[1].split("</loc>")[0]
            blocks[loc] = chunk
        return xml, blocks

    def test_ro_lesson_and_index_are_listed_with_reciprocal_hreflang(self):
        xml, blocks = self._url_blocks()

        self.assertIn('xmlns:xhtml="http://www.w3.org/1999/xhtml"', xml)
        for loc in (f"{SITE}/learn/translated", f"{SITE}/ro/learn/translated"):
            block = blocks[loc]
            self.assertIn(
                f'hreflang="en" href="{SITE}/learn/translated"', block, f"missing on {loc}"
            )
            self.assertIn(f'hreflang="ro" href="{SITE}/ro/learn/translated"', block)
            self.assertIn(f'hreflang="x-default" href="{SITE}/learn/translated"', block)
        self.assertIn(f"{SITE}/ro/learn", blocks)
        self.assertIn(f'hreflang="ro" href="{SITE}/ro/learn"', blocks[f"{SITE}/learn"])

    def test_untranslated_content_gets_no_ro_url(self):
        xml, blocks = self._url_blocks()

        self.assertNotIn(f"{SITE}/ro/learn/english-only", xml)
        self.assertNotIn("xhtml:link", blocks[f"{SITE}/learn/english-only"])
        self.assertNotIn(f"{SITE}/ro/guides", xml, "no ro guide exists, so no ro index either")
        self.assertNotIn("xhtml:link", blocks[f"{SITE}/guides"])

    def test_each_url_is_listed_once(self):
        xml, _ = self._url_blocks()
        locs = [chunk.split("</loc>")[0] for chunk in xml.split("<loc>")[1:]]

        self.assertEqual(len(locs), len(set(locs)))

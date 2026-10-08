"""The first lesson of every course is a free public sample (/learn/<slug>).

The rule under test (education.services.public_lessons): a lesson is public when it is
flagged is_public, or when it is the first lesson (lowest id) of an active course and has
published prose. Every other lesson stays private, and every public surface — list, detail,
sitemap, guide related-lessons — agrees on the same set.
"""

from django.core.cache import cache
from django.test import TestCase

from education.models import (
    Article,
    Course,
    Lesson,
    LessonSection,
    LessonSectionTranslation,
    LessonTranslation,
    Path,
)
from education.services.public_lessons import public_lessons

SITE = "https://www.garzoni.app"


def _lesson(course, slug, prose="<p>Body</p>", **kwargs):
    lesson = Lesson.objects.create(
        course=course, title=slug.replace("-", " ").title(), slug=slug, **kwargs
    )
    if prose is not None:
        LessonSection.objects.create(lesson=lesson, order=1, title="Intro", text_content=prose)
    return lesson


class FirstLessonIsPublicTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        path = Path.objects.create(title="Real Estate", description="d", access_tier="pro")
        cls.course = Course.objects.create(path=path, title="Mortgages", description="d")
        cls.first = _lesson(cls.course, "mortgage-basics", detailed_content="")
        cls.second = _lesson(cls.course, "fixed-vs-variable", detailed_content="")
        cls.flagged = _lesson(cls.course, "remortgaging", detailed_content="", is_public=True)

        inactive = Course.objects.create(
            path=path, title="Retired course", description="d", is_active=False
        )
        cls.inactive_first = _lesson(inactive, "retired-first", detailed_content="")

        # First lesson has no published prose: the course gets no sample, and the second
        # lesson is not promoted in its place.
        empty = Course.objects.create(path=path, title="Draft course", description="d")
        cls.empty_first = _lesson(empty, "draft-first", prose=None, detailed_content="")
        LessonSection.objects.create(
            lesson=cls.empty_first,
            order=1,
            title="Draft",
            text_content="<p>x</p>",
            is_published=False,
        )
        cls.empty_second = _lesson(empty, "draft-second", detailed_content="")

    def setUp(self):
        cache.clear()

    def test_list_has_first_lessons_and_flagged_ones_only(self):
        body = self.client.get("/api/public/lessons/").json()

        self.assertEqual({r["slug"] for r in body["results"]}, {"mortgage-basics", "remortgaging"})
        self.assertEqual(body["count"], 2)

    def test_first_lesson_detail_is_served(self):
        res = self.client.get("/api/public/lessons/mortgage-basics/")

        self.assertEqual(res.status_code, 200)
        body = res.json()
        self.assertEqual(body["title"], "Mortgage Basics")
        self.assertEqual(body["course"]["id"], self.course.id)
        self.assertEqual(body["sections"][0]["text_content"], "<p>Body</p>")

    def test_other_lessons_stay_private(self):
        for slug in ("fixed-vs-variable", "retired-first", "draft-first", "draft-second"):
            res = self.client.get(f"/api/public/lessons/{slug}/")
            self.assertEqual(res.status_code, 404, slug)

    def test_first_is_by_id_not_title(self):
        # "Fixed vs variable" sorts before "Mortgage basics" alphabetically; id decides.
        self.assertEqual(
            set(public_lessons().filter(course=self.course).values_list("slug", flat=True)),
            {"mortgage-basics", "remortgaging"},
        )

    def test_unflagging_the_first_lesson_does_not_hide_it(self):
        Lesson.objects.filter(pk=self.first.pk).update(is_public=False)

        self.assertEqual(self.client.get("/api/public/lessons/mortgage-basics/").status_code, 200)

    def test_sitemap_lists_first_lessons_and_not_private_ones(self):
        xml = self.client.get("/sitemap.xml").content.decode()

        self.assertIn(f"<loc>{SITE}/learn/mortgage-basics</loc>", xml)
        self.assertIn(f"<loc>{SITE}/learn/remortgaging</loc>", xml)
        for slug in ("fixed-vs-variable", "retired-first", "draft-first", "draft-second"):
            self.assertNotIn(f"/learn/{slug}<", xml)

    def test_lesson_without_slug_is_not_listed(self):
        Lesson.objects.filter(pk=self.first.pk).update(slug="")

        slugs = [r["slug"] for r in self.client.get("/api/public/lessons/").json()["results"]]

        self.assertEqual(slugs, ["remortgaging"])

    def test_guide_links_first_lessons_but_not_private_ones(self):
        article = Article.objects.create(
            title="Mortgages", slug="mortgages", content="<p>x</p>", is_published=True
        )
        article.related_lessons.add(self.first, self.second)

        body = self.client.get("/api/public/articles/mortgages/").json()

        self.assertEqual([r["slug"] for r in body["related_lessons"]], ["mortgage-basics"])


class FirstLessonRomanianTests(TestCase):
    """A first lesson appears under /ro only when fully translated, like any public one."""

    @classmethod
    def setUpTestData(cls):
        path = Path.objects.create(title="Basic Finance", description="d")
        translated_course = Course.objects.create(path=path, title="Budgeting", description="d")
        translated = _lesson(translated_course, "what-is-a-budget", detailed_content="")
        LessonTranslation.objects.create(lesson=translated, language="ro", title="Ce e un buget")
        LessonSectionTranslation.objects.create(
            section=translated.sections.get(), language="ro", title="Intro", text_content="Corp"
        )
        _lesson(translated_course, "budget-second", detailed_content="")

        english_course = Course.objects.create(path=path, title="Credit", description="d")
        _lesson(english_course, "what-is-credit", detailed_content="")

    def setUp(self):
        cache.clear()

    def test_ro_list_and_detail(self):
        ro = self.client.get("/api/public/lessons/", {"lang": "ro"}).json()

        self.assertEqual([r["slug"] for r in ro["results"]], ["what-is-a-budget"])
        res = self.client.get("/api/public/lessons/what-is-a-budget/", {"lang": "ro"})
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()["title"], "Ce e un buget")

    def test_untranslated_first_lesson_is_english_only(self):
        en = self.client.get("/api/public/lessons/what-is-credit/")
        ro = self.client.get("/api/public/lessons/what-is-credit/", {"lang": "ro"})

        self.assertEqual(en.status_code, 200)
        self.assertEqual(en.json()["available_languages"], ["en"])
        self.assertEqual(ro.status_code, 404)

    def test_sitemap_ro_urls_only_for_translated_first_lessons(self):
        xml = self.client.get("/sitemap.xml").content.decode()

        self.assertIn(f"<loc>{SITE}/ro/learn/what-is-a-budget</loc>", xml)
        self.assertIn(f"<loc>{SITE}/learn/what-is-credit</loc>", xml)
        self.assertNotIn("/ro/learn/what-is-credit", xml)
        self.assertNotIn("/learn/budget-second", xml)

"""Public, unauthenticated views for SEO-indexable lesson previews.

Exposed under /api/public/lessons/<slug>/. These views deliberately return only
content safe for public reading (title, image, prose) and never exercise answers,
quiz state, or per-user progress.

Language: `?lang=ro` returns the Romanian version (web serves it at /ro/learn/... and
/ro/guides/...). Only the query string selects it — /api/public/* is edge-cached on
the URL, so a header-driven variant would hand one caller's language to everyone. A
lesson or guide exists in a language only when it is fully translated; detail views
404 otherwise so English prose is never published under a /ro URL.
"""

from django.db.models import Exists, Max, OuterRef, Prefetch, Q
from django.http import Http404, HttpResponse
from django.utils import timezone
from django.utils.html import strip_tags
from django.views.decorators.cache import cache_page
from rest_framework.decorators import api_view, permission_classes, throttle_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from core.media_url import canonical_file_field_url

from .models import (
    Article,
    ArticleTranslation,
    CourseTranslation,
    Lesson,
    LessonSection,
    LessonSectionTranslation,
    LessonTranslation,
    PathTranslation,
)
from .utils import DEFAULT_LANGUAGE, SUPPORTED_LANGUAGES

TRANSLATED_LANGUAGES = [lang for lang in SUPPORTED_LANGUAGES if lang != DEFAULT_LANGUAGE]


# Seed text left in Lesson.detailed_content by add_missing_courses (and its literal
# Romanian translation). The real prose lives in the sections, so a public page
# should render no intro rather than publish "Content to be added." to Google.
_PLACEHOLDER_INTROS = {"", "content to be added", "conținut de adăugat"}
# The same idea in SQL, for the English side of the "is it translated" check: an empty
# paragraph or the seed text is no body, so a translation needs none either.
_NO_ENGLISH_BODY_RE = r"^\s*(<p>)?\s*(content to be added\.?)?\s*(</p>)?\s*$"


def _public_intro(html: str | None) -> str:
    text = strip_tags(html or "").strip().rstrip(".").strip().lower()
    return "" if text in _PLACEHOLDER_INTROS else html


def _public_language(request) -> str:
    lang = (request.GET.get("lang") or "").strip().lower()
    return lang if lang in SUPPORTED_LANGUAGES else DEFAULT_LANGUAGE


def _lesson_translated(lang: str) -> Exists:
    """Title, body (when English has one) and every non-empty text section in `lang`."""
    untranslated_section = (
        LessonSection.objects.filter(lesson=OuterRef("lesson"), content_type="text")
        .exclude(text_content__isnull=True)
        .exclude(text_content="")
        .filter(
            ~Exists(
                LessonSectionTranslation.objects.filter(section=OuterRef("pk"), language=lang)
                .exclude(text_content__isnull=True)
                .exclude(text_content="")
            )
        )
    )
    return Exists(
        LessonTranslation.objects.filter(lesson=OuterRef("pk"), language=lang)
        .exclude(title="")
        .filter(Q(lesson__detailed_content__iregex=_NO_ENGLISH_BODY_RE) | ~Q(detailed_content=""))
        .filter(~Exists(untranslated_section))
    )


def _article_translated(lang: str) -> Exists:
    return Exists(
        ArticleTranslation.objects.filter(article=OuterRef("pk"), language=lang)
        .exclude(title="")
        .exclude(content="")
    )


def _with_languages(queryset, translated):
    """Annotate `in_<lang>` for every translated language (see _languages)."""
    return queryset.annotate(**{f"in_{lang}": translated(lang) for lang in TRANSLATED_LANGUAGES})


def _languages(obj) -> list:
    return [DEFAULT_LANGUAGE] + [
        lang for lang in TRANSLATED_LANGUAGES if getattr(obj, f"in_{lang}", False)
    ]


def _only_in(queryset, lang: str):
    """Restrict an annotated queryset to rows that exist in `lang`."""
    if lang == DEFAULT_LANGUAGE:
        return queryset
    return queryset.filter(**{f"in_{lang}": True})


def _lang_prefetch(lookup: str, model, lang: str) -> Prefetch:
    return Prefetch(lookup, queryset=model.objects.filter(language=lang))


def _translation(obj, lang: str):
    if obj is None or lang == DEFAULT_LANGUAGE:
        return None
    return next((t for t in obj.translations.all() if t.language == lang), None)


def _section_payload(section: LessonSection, lang: str = DEFAULT_LANGUAGE) -> dict:
    trans = _translation(section, lang)
    text_content = trans.text_content if trans else section.text_content
    return {
        "id": section.id,
        "order": section.order,
        "title": trans.title if trans and trans.title else section.title,
        "content_type": section.content_type,
        "text_content": text_content or "" if section.content_type == "text" else "",
        # Per-section attribution (E-E-A-T): surfaced as a Sources block + schema
        # citations on the lesson page. Empty unless an editor has populated them.
        "source_label": section.source_label or "",
        "source_url": section.source_url or "",
    }


@api_view(["GET"])
@permission_classes([AllowAny])
@throttle_classes([])  # public SEO reads — crawlers/prerender hit these in bursts
def public_lesson_detail(request, slug: str):
    lang = _public_language(request)
    lessons = _with_languages(
        Lesson.objects.select_related("course", "course__path").prefetch_related("sections"),
        _lesson_translated,
    )
    if lang != DEFAULT_LANGUAGE:
        lessons = _only_in(lessons, lang).prefetch_related(
            _lang_prefetch("translations", LessonTranslation, lang),
            _lang_prefetch("sections__translations", LessonSectionTranslation, lang),
            _lang_prefetch("course__translations", CourseTranslation, lang),
        )
    try:
        lesson = lessons.get(slug=slug, is_public=True)
    except Lesson.DoesNotExist:
        raise Http404("Lesson not found")

    trans = _translation(lesson, lang)
    course_trans = _translation(lesson.course, lang)

    image_url = canonical_file_field_url(lesson.image) or ""

    # Lessons carry no timestamp of their own, but each section has a real
    # auto_now updated_at. The newest section edit is an honest "last updated"
    # signal for the lesson (rendered visibly + as schema dateModified).
    section_updates = [s.updated_at for s in lesson.sections.all() if s.updated_at]
    updated_at = max(section_updates).isoformat() if section_updates else None

    payload = {
        "slug": lesson.slug,
        "language": lang,
        "available_languages": _languages(lesson),
        "title": trans.title if trans else lesson.title,
        "short_description": trans.short_description if trans else lesson.short_description,
        "detailed_content": _public_intro(
            trans.detailed_content if trans else lesson.detailed_content
        ),
        "image_url": image_url,
        "updated_at": updated_at,
        "course": {
            "id": lesson.course_id,
            "title": (
                course_trans.title if course_trans else lesson.course.title if lesson.course else ""
            ),
        },
        "sections": [
            _section_payload(s, lang)
            for s in sorted(lesson.sections.all(), key=lambda x: x.order)
            if s.content_type == "text"
        ],
    }

    # Guest-taste teaser (plan §3.1). Surfaced only for public lessons that have
    # a hand-whitelisted sample_question. correct_index + explanation are safe to
    # expose because these teasers are authored by hand and never drawn from the
    # real quiz pool — client-side answer checking is intentional here. English
    # only: the teaser has no translation.
    sample_question = lesson.sample_question if lang == DEFAULT_LANGUAGE else None
    if isinstance(sample_question, dict) and sample_question.get("question"):
        payload["sample_question"] = {
            "question": sample_question.get("question"),
            "options": sample_question.get("options") or [],
            "correct_index": sample_question.get("correct_index"),
            "explanation": sample_question.get("explanation") or "",
        }

    response = Response(payload)
    response["Cache-Control"] = "public, s-maxage=600, stale-while-revalidate=300"
    return response


@api_view(["GET"])
@permission_classes([AllowAny])
@throttle_classes([])  # public SEO reads — crawlers/prerender hit these in bursts
def public_lesson_list(request):
    """List all publicly-indexable lessons, grouped for the /learn catalog.

    Only returns lessons explicitly flagged is_public=True — identical security
    boundary to public_lesson_detail. Never exposes private or auth-gated content.
    """
    lang = _public_language(request)
    lessons = _only_in(
        _with_languages(
            Lesson.objects.select_related("course", "course__path")
            .filter(is_public=True)
            .order_by("course__order", "id"),
            _lesson_translated,
        ),
        lang,
    )
    if lang != DEFAULT_LANGUAGE:
        lessons = lessons.prefetch_related(
            _lang_prefetch("translations", LessonTranslation, lang),
            _lang_prefetch("course__translations", CourseTranslation, lang),
            _lang_prefetch("course__path__translations", PathTranslation, lang),
        )

    items = []
    for lesson in lessons:
        image_url = canonical_file_field_url(lesson.image) or ""
        trans = _translation(lesson, lang)
        course = lesson.course
        course_trans = _translation(course, lang)
        path = course.path if course else None
        path_trans = _translation(path, lang)
        items.append(
            {
                "slug": lesson.slug,
                "available_languages": _languages(lesson),
                "title": trans.title if trans else lesson.title,
                "short_description": (
                    trans.short_description if trans else lesson.short_description
                )
                or "",
                "image_url": image_url,
                # Boolean only — the teaser question itself lives on the detail
                # endpoint so the correct answer never ships in the catalog list.
                "has_sample_question": lang == DEFAULT_LANGUAGE
                and bool(
                    isinstance(lesson.sample_question, dict)
                    and lesson.sample_question.get("question")
                ),
                "course": {
                    "id": lesson.course_id,
                    "title": course_trans.title if course_trans else course.title if course else "",
                },
                "path": {
                    "id": course.path_id if course else None,
                    "title": path_trans.title if path_trans else path.title if path else "",
                },
            }
        )

    response = Response({"count": len(items), "results": items})
    response["Cache-Control"] = "public, s-maxage=600, stale-while-revalidate=300"
    return response


def _article_card(article: Article, lang: str = DEFAULT_LANGUAGE) -> dict:
    trans = _translation(article, lang)
    return {
        "slug": article.slug,
        "available_languages": _languages(article),
        "title": trans.title if trans else article.title,
        "category": article.category,
        "excerpt": (trans.excerpt if trans else article.excerpt) or "",
        "author": article.author,
        "image_url": canonical_file_field_url(article.image) or "",
        "published_at": article.published_at.isoformat() if article.published_at else None,
        "updated_at": article.updated_at.isoformat() if article.updated_at else None,
    }


@api_view(["GET"])
@permission_classes([AllowAny])
@throttle_classes([])  # public SEO reads — crawlers/prerender hit these in bursts
def public_article_list(request):
    """List published articles for the /guides index. Only is_published=True."""
    lang = _public_language(request)
    articles = _only_in(
        _with_languages(Article.objects.filter(is_published=True), _article_translated), lang
    )
    if lang != DEFAULT_LANGUAGE:
        articles = articles.prefetch_related(
            _lang_prefetch("translations", ArticleTranslation, lang)
        )
    items = [_article_card(a, lang) for a in articles]
    response = Response({"count": len(items), "results": items})
    response["Cache-Control"] = "public, s-maxage=600, stale-while-revalidate=300"
    return response


@api_view(["GET"])
@permission_classes([AllowAny])
@throttle_classes([])  # public SEO reads — crawlers/prerender hit these in bursts
def public_article_detail(request, slug: str):
    lang = _public_language(request)
    articles = _with_languages(
        Article.objects.prefetch_related("related_lessons", "related_lessons__course"),
        _article_translated,
    )
    if lang != DEFAULT_LANGUAGE:
        articles = _only_in(articles, lang).prefetch_related(
            _lang_prefetch("translations", ArticleTranslation, lang)
        )
    try:
        article = articles.get(slug=slug, is_published=True)
    except Article.DoesNotExist:
        raise Http404("Article not found")

    image_url = canonical_file_field_url(article.image) or ""
    trans = _translation(article, lang)
    related_lessons = article.related_lessons.filter(is_public=True)
    if lang != DEFAULT_LANGUAGE:
        # Link only lessons that exist at /<lang>/learn/<slug>, under their own titles.
        related_lessons = _only_in(
            _with_languages(related_lessons, _lesson_translated), lang
        ).prefetch_related(_lang_prefetch("translations", LessonTranslation, lang))
    source = trans or article

    payload = {
        "slug": article.slug,
        "language": lang,
        "available_languages": _languages(article),
        "title": source.title,
        "category": article.category,
        "meta_description": source.meta_description or source.excerpt or "",
        "excerpt": source.excerpt or "",
        "content": source.content or "",
        "author": article.author,
        "image_url": image_url,
        "faq": source.faq or [],
        "item_list": source.item_list or [],
        "published_at": article.published_at.isoformat() if article.published_at else None,
        "updated_at": article.updated_at.isoformat() if article.updated_at else None,
        "related_lessons": [
            {
                "slug": lesson.slug,
                "title": lesson_trans.title if lesson_trans else lesson.title,
                "short_description": (
                    lesson_trans.short_description if lesson_trans else lesson.short_description
                )
                or "",
            }
            for lesson in related_lessons
            for lesson_trans in [_translation(lesson, lang)]
        ],
    }
    response = Response(payload)
    response["Cache-Control"] = "public, s-maxage=600, stale-while-revalidate=300"
    return response


@cache_page(60 * 60)
def sitemap_xml(request):
    """Plain XML sitemap. No django.contrib.sitemaps dependency.

    lastmod is a real content-updated date where we have one (lessons/articles
    carry `updated_at`). Static pages omit lastmod rather than stamp today's
    date on every crawl — Google ignores a lastmod that changes every day, so a
    lie is worse than an omission. /login and /register are excluded (thin,
    non-indexable utility pages that shouldn't be in the sitemap).
    """
    site_url = "https://www.garzoni.app"

    # (loc, priority, changefreq, lastmod-or-None)
    static_urls = [
        (f"{site_url}/", "1.0", "daily", None),
        (f"{site_url}/learn", "0.9", "weekly", None),
        (f"{site_url}/guides", "0.9", "weekly", None),
        (f"{site_url}/about", "0.7", "monthly", None),
        (f"{site_url}/authors/andrei-neagoe", "0.6", "monthly", None),
        (f"{site_url}/editorial-standards", "0.5", "yearly", None),
        (f"{site_url}/subscriptions", "0.8", "weekly", None),
        (f"{site_url}/privacy-policy", "0.3", "yearly", None),
        (f"{site_url}/cookie-policy", "0.3", "yearly", None),
        (f"{site_url}/terms-of-service", "0.3", "yearly", None),
        (f"{site_url}/financial-disclaimer", "0.3", "yearly", None),
    ]

    def _iso(dt):
        return dt.date().isoformat() if dt else None

    # Translated versions live under /<lang>/. Each language version of a page gets
    # its own <url>, and every version lists all of them (plus x-default = English)
    # as xhtml:link alternates — Google wants the hreflang set on both sides.
    lessons = Lesson.objects.filter(is_public=True)
    articles = Article.objects.filter(is_published=True)
    translated_lessons = {
        lang: set(lessons.filter(_lesson_translated(lang)).values_list("slug", flat=True))
        for lang in TRANSLATED_LANGUAGES
    }
    translated_articles = {
        lang: set(articles.filter(_article_translated(lang)).values_list("slug", flat=True))
        for lang in TRANSLATED_LANGUAGES
    }
    alternates = {}  # loc -> [(hreflang, href)]

    def _langs(translated, slug=None):
        return [DEFAULT_LANGUAGE] + [
            lang
            for lang in TRANSLATED_LANGUAGES
            if (slug in translated[lang] if slug else translated[lang])
        ]

    def _versions(path, langs, *meta):
        locs = {
            lang: f"{site_url}{path}" if lang == DEFAULT_LANGUAGE else f"{site_url}/{lang}{path}"
            for lang in langs
        }
        if len(locs) > 1:
            links = [*locs.items(), ("x-default", locs[DEFAULT_LANGUAGE])]
            for loc in locs.values():
                alternates[loc] = links
        return [(loc, *meta) for loc in locs.values()]

    static_locs = {url[0] for url in static_urls}
    index_urls = [
        url
        for path, translated in (("/learn", translated_lessons), ("/guides", translated_articles))
        for url in _versions(path, _langs(translated), "0.9", "weekly", None)
        if url[0] not in static_locs
    ]

    # The landing page: "/" is English, "/ro" its Romanian twin (no trailing slash,
    # so it can't go through _versions, which would build "/ro/").
    home_links = [
        ("en", f"{site_url}/"),
        ("ro", f"{site_url}/ro"),
        ("x-default", f"{site_url}/"),
    ]
    alternates[f"{site_url}/"] = home_links
    alternates[f"{site_url}/ro"] = home_links
    home_urls = [(f"{site_url}/ro", "1.0", "daily", None)]

    # Public calculators exist in every language (static copy, no translation gate).
    calculator_urls = _versions(
        "/calculators/compound-interest",
        [DEFAULT_LANGUAGE, *TRANSLATED_LANGUAGES],
        "0.8",
        "monthly",
        None,
    )

    # Lessons carry no timestamp of their own — the honest "last modified" is the
    # newest section edit (matches the lesson detail API's updated_at).
    lesson_urls = [
        url
        for slug, updated in lessons.annotate(
            section_updated=Max("sections__updated_at")
        ).values_list("slug", "section_updated")
        for url in _versions(
            f"/learn/{slug}", _langs(translated_lessons, slug), "0.9", "weekly", _iso(updated)
        )
    ]

    article_urls = [
        url
        for slug, updated in articles.values_list("slug", "updated_at")
        for url in _versions(
            f"/guides/{slug}", _langs(translated_articles, slug), "0.8", "weekly", _iso(updated)
        )
    ]

    parts = ['<?xml version="1.0" encoding="UTF-8"?>']
    parts.append(
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" '
        'xmlns:xhtml="http://www.w3.org/1999/xhtml">'
    )
    for loc, priority, changefreq, lastmod in (
        static_urls + home_urls + index_urls + calculator_urls + lesson_urls + article_urls
    ):
        parts.append("<url>")
        parts.append(f"<loc>{loc}</loc>")
        if lastmod:
            parts.append(f"<lastmod>{lastmod}</lastmod>")
        parts.append(f"<changefreq>{changefreq}</changefreq>")
        parts.append(f"<priority>{priority}</priority>")
        # After the sitemap elements: the 0.9 XSD only allows foreign elements last.
        for hreflang, href in alternates.get(loc, ()):
            parts.append(f'<xhtml:link rel="alternate" hreflang="{hreflang}" href="{href}"/>')
        parts.append("</url>")
    parts.append("</urlset>")

    response = HttpResponse("".join(parts), content_type="application/xml")
    response["Cache-Control"] = "public, max-age=3600"
    return response

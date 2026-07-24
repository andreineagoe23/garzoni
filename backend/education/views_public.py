"""Public, unauthenticated views for SEO-indexable lesson previews.

Exposed under /api/public/lessons/<slug>/. These views deliberately return only
content safe for public reading (title, image, prose) and never exercise answers,
quiz state, or per-user progress.
"""

from django.db.models import Max
from django.http import Http404, HttpResponse
from django.utils import timezone
from django.views.decorators.cache import cache_page
from rest_framework.decorators import api_view, permission_classes, throttle_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from .models import Article, Lesson, LessonSection


def _section_payload(section: LessonSection) -> dict:
    return {
        "id": section.id,
        "order": section.order,
        "title": section.title,
        "content_type": section.content_type,
        "text_content": section.text_content or "" if section.content_type == "text" else "",
        # Per-section attribution (E-E-A-T): surfaced as a Sources block + schema
        # citations on the lesson page. Empty unless an editor has populated them.
        "source_label": section.source_label or "",
        "source_url": section.source_url or "",
    }


@api_view(["GET"])
@permission_classes([AllowAny])
@throttle_classes([])  # public SEO reads — crawlers/prerender hit these in bursts
def public_lesson_detail(request, slug: str):
    try:
        lesson = (
            Lesson.objects.select_related("course", "course__path")
            .prefetch_related("sections")
            .get(slug=slug, is_public=True)
        )
    except Lesson.DoesNotExist:
        raise Http404("Lesson not found")

    image_url = ""
    try:
        if lesson.image:
            image_url = request.build_absolute_uri(lesson.image.url)
    except Exception:
        image_url = ""

    # Lessons carry no timestamp of their own, but each section has a real
    # auto_now updated_at. The newest section edit is an honest "last updated"
    # signal for the lesson (rendered visibly + as schema dateModified).
    section_updates = [s.updated_at for s in lesson.sections.all() if s.updated_at]
    updated_at = max(section_updates).isoformat() if section_updates else None

    payload = {
        "slug": lesson.slug,
        "title": lesson.title,
        "short_description": lesson.short_description,
        "detailed_content": lesson.detailed_content or "",
        "image_url": image_url,
        "updated_at": updated_at,
        "course": {
            "id": lesson.course_id,
            "title": lesson.course.title if lesson.course else "",
        },
        "sections": [
            _section_payload(s)
            for s in sorted(lesson.sections.all(), key=lambda x: x.order)
            if s.content_type == "text"
        ],
    }

    # Guest-taste teaser (plan §3.1). Surfaced only for public lessons that have
    # a hand-whitelisted sample_question. correct_index + explanation are safe to
    # expose because these teasers are authored by hand and never drawn from the
    # real quiz pool — client-side answer checking is intentional here.
    sample_question = lesson.sample_question
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
    lessons = (
        Lesson.objects.select_related("course", "course__path")
        .filter(is_public=True)
        .order_by("course__order", "id")
    )

    items = []
    for lesson in lessons:
        image_url = ""
        try:
            if lesson.image:
                image_url = request.build_absolute_uri(lesson.image.url)
        except Exception:
            image_url = ""
        items.append(
            {
                "slug": lesson.slug,
                "title": lesson.title,
                "short_description": lesson.short_description or "",
                "image_url": image_url,
                # Boolean only — the teaser question itself lives on the detail
                # endpoint so the correct answer never ships in the catalog list.
                "has_sample_question": bool(
                    isinstance(lesson.sample_question, dict)
                    and lesson.sample_question.get("question")
                ),
                "course": {
                    "id": lesson.course_id,
                    "title": lesson.course.title if lesson.course else "",
                },
                "path": {
                    "id": lesson.course.path_id if lesson.course else None,
                    "title": (
                        lesson.course.path.title if lesson.course and lesson.course.path else ""
                    ),
                },
            }
        )

    response = Response({"count": len(items), "results": items})
    response["Cache-Control"] = "public, s-maxage=600, stale-while-revalidate=300"
    return response


def _article_card(article: Article) -> dict:
    return {
        "slug": article.slug,
        "title": article.title,
        "category": article.category,
        "excerpt": article.excerpt or "",
        "image_url": article.image.url if article.image else "",
        "published_at": article.published_at.isoformat() if article.published_at else None,
        "updated_at": article.updated_at.isoformat() if article.updated_at else None,
    }


@api_view(["GET"])
@permission_classes([AllowAny])
@throttle_classes([])  # public SEO reads — crawlers/prerender hit these in bursts
def public_article_list(request):
    """List published articles for the /guides index. Only is_published=True."""
    articles = Article.objects.filter(is_published=True)
    items = [_article_card(a) for a in articles]
    response = Response({"count": len(items), "results": items})
    response["Cache-Control"] = "public, s-maxage=600, stale-while-revalidate=300"
    return response


@api_view(["GET"])
@permission_classes([AllowAny])
@throttle_classes([])  # public SEO reads — crawlers/prerender hit these in bursts
def public_article_detail(request, slug: str):
    try:
        article = Article.objects.prefetch_related(
            "related_lessons", "related_lessons__course"
        ).get(slug=slug, is_published=True)
    except Article.DoesNotExist:
        raise Http404("Article not found")

    image_url = ""
    try:
        if article.image:
            image_url = request.build_absolute_uri(article.image.url)
    except Exception:
        image_url = ""

    payload = {
        "slug": article.slug,
        "title": article.title,
        "category": article.category,
        "meta_description": article.meta_description or article.excerpt or "",
        "excerpt": article.excerpt or "",
        "content": article.content or "",
        "author": article.author,
        "image_url": image_url,
        "faq": article.faq or [],
        "item_list": article.item_list or [],
        "published_at": article.published_at.isoformat() if article.published_at else None,
        "updated_at": article.updated_at.isoformat() if article.updated_at else None,
        "related_lessons": [
            {
                "slug": lesson.slug,
                "title": lesson.title,
                "short_description": lesson.short_description or "",
            }
            for lesson in article.related_lessons.filter(is_public=True)
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
        (f"{site_url}/marketing", "0.8", "weekly", None),
        (f"{site_url}/learn", "0.9", "weekly", None),
        (f"{site_url}/guides", "0.9", "weekly", None),
        (f"{site_url}/about", "0.7", "monthly", None),
        (f"{site_url}/subscriptions", "0.8", "weekly", None),
        (f"{site_url}/privacy-policy", "0.3", "yearly", None),
        (f"{site_url}/cookie-policy", "0.3", "yearly", None),
        (f"{site_url}/terms-of-service", "0.3", "yearly", None),
        (f"{site_url}/financial-disclaimer", "0.3", "yearly", None),
    ]

    def _iso(dt):
        return dt.date().isoformat() if dt else None

    # Lessons carry no timestamp of their own — the honest "last modified" is the
    # newest section edit (matches the lesson detail API's updated_at).
    lesson_urls = [
        (f"{site_url}/learn/{slug}", "0.9", "weekly", _iso(updated))
        for slug, updated in Lesson.objects.filter(is_public=True)
        .annotate(section_updated=Max("sections__updated_at"))
        .values_list("slug", "section_updated")
    ]

    article_urls = [
        (f"{site_url}/guides/{slug}", "0.8", "weekly", _iso(updated))
        for slug, updated in Article.objects.filter(is_published=True).values_list(
            "slug", "updated_at"
        )
    ]

    parts = ['<?xml version="1.0" encoding="UTF-8"?>']
    parts.append('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">')
    for loc, priority, changefreq, lastmod in static_urls + lesson_urls + article_urls:
        parts.append("<url>")
        parts.append(f"<loc>{loc}</loc>")
        if lastmod:
            parts.append(f"<lastmod>{lastmod}</lastmod>")
        parts.append(f"<changefreq>{changefreq}</changefreq>")
        parts.append(f"<priority>{priority}</priority>")
        parts.append("</url>")
    parts.append("</urlset>")

    response = HttpResponse("".join(parts), content_type="application/xml")
    response["Cache-Control"] = "public, max-age=3600"
    return response

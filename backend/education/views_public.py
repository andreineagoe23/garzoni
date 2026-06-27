"""Public, unauthenticated views for SEO-indexable lesson previews.

Exposed under /api/public/lessons/<slug>/. These views deliberately return only
content safe for public reading (title, image, prose) and never exercise answers,
quiz state, or per-user progress.
"""

from django.http import Http404, HttpResponse
from django.utils import timezone
from django.views.decorators.cache import cache_page
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from .models import Lesson, LessonSection


def _section_payload(section: LessonSection) -> dict:
    return {
        "id": section.id,
        "order": section.order,
        "title": section.title,
        "content_type": section.content_type,
        "text_content": section.text_content or "" if section.content_type == "text" else "",
    }


@api_view(["GET"])
@permission_classes([AllowAny])
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

    payload = {
        "slug": lesson.slug,
        "title": lesson.title,
        "short_description": lesson.short_description,
        "detailed_content": lesson.detailed_content or "",
        "image_url": image_url,
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
    response = Response(payload)
    response["Cache-Control"] = "public, max-age=3600, s-maxage=86400"
    return response


@api_view(["GET"])
@permission_classes([AllowAny])
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
    response["Cache-Control"] = "public, max-age=3600, s-maxage=86400"
    return response


@cache_page(60 * 60)
def sitemap_xml(request):
    """Plain XML sitemap. No django.contrib.sitemaps dependency."""
    site_url = "https://www.garzoni.app"
    now_iso = timezone.now().date().isoformat()

    static_urls = [
        (f"{site_url}/", "1.0", "daily"),
        (f"{site_url}/marketing", "0.8", "weekly"),
        (f"{site_url}/learn", "0.9", "weekly"),
        (f"{site_url}/about", "0.7", "monthly"),
        (f"{site_url}/subscriptions", "0.8", "weekly"),
        (f"{site_url}/login", "0.5", "monthly"),
        (f"{site_url}/register", "0.5", "monthly"),
        (f"{site_url}/privacy-policy", "0.3", "yearly"),
        (f"{site_url}/cookie-policy", "0.3", "yearly"),
        (f"{site_url}/terms-of-service", "0.3", "yearly"),
        (f"{site_url}/financial-disclaimer", "0.3", "yearly"),
    ]

    lesson_urls = [
        (f"{site_url}/learn/{slug}", "0.9", "weekly")
        for slug in Lesson.objects.filter(is_public=True).values_list("slug", flat=True)
    ]

    parts = ['<?xml version="1.0" encoding="UTF-8"?>']
    parts.append('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">')
    for loc, priority, changefreq in static_urls + lesson_urls:
        parts.append("<url>")
        parts.append(f"<loc>{loc}</loc>")
        parts.append(f"<lastmod>{now_iso}</lastmod>")
        parts.append(f"<changefreq>{changefreq}</changefreq>")
        parts.append(f"<priority>{priority}</priority>")
        parts.append("</url>")
    parts.append("</urlset>")

    response = HttpResponse("".join(parts), content_type="application/xml")
    response["Cache-Control"] = "public, max-age=3600"
    return response

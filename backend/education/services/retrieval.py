"""
Semantic retrieval over Garzoni curriculum content.

Embedding model: text-embedding-3-small (1536-d).
Storage: ContentEmbedding.embedding (JSONField with float list).
Similarity: cosine similarity in Python (fast enough for <5k documents).

When pgvector is available and the column is migrated to VectorField,
replace the Python similarity loop with a DB-side ANN query.
"""

from __future__ import annotations

import logging
import math
from typing import Any, Dict, List, Optional

from django.conf import settings

logger = logging.getLogger(__name__)

_EMBEDDING_MODEL = "text-embedding-3-small"
_EMBEDDING_DIM = 1536


# ---------------------------------------------------------------------------
# Embed helpers
# ---------------------------------------------------------------------------


def _embed(text: str) -> Optional[List[float]]:
    """Get a single embedding vector. Returns None on failure."""
    key = getattr(settings, "OPENAI_API_KEY", "") or ""
    if not key:
        logger.error("[retrieval] OPENAI_API_KEY not configured")
        return None
    try:
        from openai import OpenAI

        client = OpenAI(api_key=key)
        resp = client.embeddings.create(
            model=_EMBEDDING_MODEL,
            input=text[:8000],
        )
        return resp.data[0].embedding
    except Exception as exc:
        logger.error("[retrieval] embed error: %s", exc)
        return None


def _cosine(a: List[float], b: List[float]) -> float:
    dot = sum(x * y for x, y in zip(a, b))
    na = math.sqrt(sum(x * x for x in a))
    nb = math.sqrt(sum(x * x for x in b))
    if na == 0 or nb == 0:
        return 0.0
    return dot / (na * nb)


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


def search(
    query: str,
    top_k: int = 5,
    content_types: Optional[List[str]] = None,
) -> List[Dict[str, Any]]:
    """
    Semantic search over embedded curriculum content.
    Returns list of {content_type, content_id, title, score} dicts.
    """
    from education.models import ContentEmbedding

    query_vec = _embed(query)
    if query_vec is None:
        return []

    qs = ContentEmbedding.objects.all()
    if content_types:
        qs = qs.filter(content_type__in=content_types)

    rows = list(qs.values("content_type", "content_id", "title", "body_snippet", "embedding"))
    if not rows:
        return []

    scored = []
    for row in rows:
        emb = row["embedding"]
        if not emb or len(emb) != _EMBEDDING_DIM:
            continue
        score = _cosine(query_vec, emb)
        scored.append(
            {
                "content_type": row["content_type"],
                "content_id": row["content_id"],
                "title": row["title"],
                "snippet": row["body_snippet"][:200],
                "score": round(score, 4),
            }
        )

    scored.sort(key=lambda x: x["score"], reverse=True)
    return scored[:top_k]


# ---------------------------------------------------------------------------
# Indexing helpers
# ---------------------------------------------------------------------------


def index_lesson(lesson_id: int) -> bool:
    """Embed and upsert a single Lesson. Returns True on success."""
    from education.models import Lesson, ContentEmbedding

    try:
        lesson = Lesson.objects.select_related("course", "course__path").get(id=lesson_id)
    except Lesson.DoesNotExist:
        return False

    path_name = lesson.course.path.title if lesson.course and lesson.course.path else ""
    course_name = lesson.course.title if lesson.course else ""
    text = f"{lesson.title}. {lesson.short_description or ''} Course: {course_name}. Path: {path_name}."
    vec = _embed(text)
    if vec is None:
        return False

    ContentEmbedding.objects.update_or_create(
        content_type="lesson",
        content_id=lesson_id,
        defaults={
            "title": lesson.title,
            "body_snippet": text[:500],
            "embedding": vec,
            "embedding_model": _EMBEDDING_MODEL,
        },
    )
    return True


def index_course(course_id: int) -> bool:
    from education.models import Course, ContentEmbedding

    try:
        course = Course.objects.select_related("path").get(id=course_id)
    except Course.DoesNotExist:
        return False

    path_name = course.path.title if course.path else ""
    text = f"{course.title}. {course.description or ''} Path: {path_name}."
    vec = _embed(text)
    if vec is None:
        return False

    ContentEmbedding.objects.update_or_create(
        content_type="course",
        content_id=course_id,
        defaults={
            "title": course.title,
            "body_snippet": text[:500],
            "embedding": vec,
            "embedding_model": _EMBEDDING_MODEL,
        },
    )
    return True


def index_skill(skill_name: str) -> bool:
    from education.models import ContentEmbedding
    import hashlib

    skill_id = int(hashlib.md5(skill_name.encode()).hexdigest()[:8], 16) % 2_000_000
    text = f"Financial skill: {skill_name}. Practice and master {skill_name} in personal finance."
    vec = _embed(text)
    if vec is None:
        return False

    ContentEmbedding.objects.update_or_create(
        content_type="skill",
        content_id=skill_id,
        defaults={
            "title": skill_name,
            "body_snippet": text[:200],
            "embedding": vec,
            "embedding_model": _EMBEDDING_MODEL,
        },
    )
    return True


def backfill_all(batch_size: int = 50) -> Dict[str, int]:
    """
    Full backfill: embed all Lessons and Courses that don't have embeddings yet.
    Designed to be called from a management command or Celery task.
    Returns counts of indexed items.
    """
    from education.models import Lesson, Course, ContentEmbedding

    existing_lesson_ids = set(
        ContentEmbedding.objects.filter(content_type="lesson").values_list("content_id", flat=True)
    )
    existing_course_ids = set(
        ContentEmbedding.objects.filter(content_type="course").values_list("content_id", flat=True)
    )

    lesson_ids = list(
        Lesson.objects.exclude(id__in=existing_lesson_ids).values_list("id", flat=True)[:batch_size]
    )
    course_ids = list(
        Course.objects.filter(is_active=True)
        .exclude(id__in=existing_course_ids)
        .values_list("id", flat=True)[:batch_size]
    )

    lesson_ok = sum(1 for lid in lesson_ids if index_lesson(lid))
    course_ok = sum(1 for cid in course_ids if index_course(cid))

    logger.info("[retrieval] backfill lessons=%s courses=%s", lesson_ok, course_ok)
    return {"lessons": lesson_ok, "courses": course_ok}

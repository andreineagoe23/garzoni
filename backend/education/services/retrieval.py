"""
Retrieval over Garzoni curriculum content.

Two pipelines, chosen by settings.RAG_HYBRID_ENABLED:

- hybrid (ContentChunk): lessons split into section chunks, embedded with
  text-embedding-3-small into a pgvector column (HNSW, cosine). A query runs a vector search
  and a Postgres full-text search, and the two rankings are fused per lesson with Reciprocal
  Rank Fusion. If the embedding call fails, full-text alone still answers.
- legacy (ContentEmbedding): one embedding per lesson/course from its metadata, cosine
  similarity computed in Python. Kept until the hybrid pipeline is proven on the eval set
  (python manage.py eval_retrieval).
"""

from __future__ import annotations

import logging
import math
from collections import Counter, defaultdict
from typing import Any, Dict, List, Optional

from django.conf import settings
from django.contrib.postgres.search import SearchVector
from django.db import connection, transaction

logger = logging.getLogger(__name__)

_EMBEDDING_MODEL = "text-embedding-3-small"
_EMBEDDING_DIM = 1536

# Content is authored in English; Romanian queries still match through the embeddings.
INDEXED_LANGUAGES = ("en",)
_FTS_CONFIG = {"en": "english"}
_CANDIDATES = 50
_RRF_K = 60


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

        client = OpenAI(api_key=key, timeout=30.0)
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
    Search curriculum content with the pipeline selected by RAG_HYBRID_ENABLED.
    Returns list of {content_type, content_id, title, snippet, score} dicts.
    """
    wants_lessons = not content_types or "lesson" in content_types
    if getattr(settings, "RAG_HYBRID_ENABLED", False) and wants_lessons:
        try:
            return hybrid_search(query, top_k=top_k)
        except Exception:
            logger.exception("[retrieval] hybrid search failed, falling back to legacy")
    return legacy_search(query, top_k=top_k, content_types=content_types)


def legacy_search(
    query: str,
    top_k: int = 5,
    content_types: Optional[List[str]] = None,
) -> List[Dict[str, Any]]:
    """Cosine similarity in Python over ContentEmbedding rows (one vector per lesson/course)."""
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


# ---------------------------------------------------------------------------
# Hybrid pipeline (ContentChunk: pgvector + full-text, fused with RRF)
# ---------------------------------------------------------------------------


def _embed_batch(texts: List[str]) -> Optional[List[List[float]]]:
    """Embed several texts in one call, preserving order. Returns None on failure."""
    key = getattr(settings, "OPENAI_API_KEY", "") or ""
    if not key or not texts:
        return None
    try:
        from openai import OpenAI

        client = OpenAI(api_key=key, timeout=60.0)
        resp = client.embeddings.create(
            model=_EMBEDDING_MODEL,
            input=[t[:8000] for t in texts],
        )
        return [item.embedding for item in sorted(resp.data, key=lambda d: d.index)]
    except Exception as exc:
        logger.error("[retrieval] batch embed error: %s", exc)
        return None


def index_lesson_chunks(lesson_id: int, force: bool = False) -> str:
    """
    Rebuild a lesson's chunks. Returns "indexed", "fts_only" (stored without embeddings,
    retried next run), "unchanged", "empty" or "missing".
    """
    from education.models import ContentChunk, Lesson
    from education.services.chunking import build_lesson_chunks, content_hash

    lesson = (
        Lesson.objects.select_related("course__path")
        .prefetch_related(
            "translations",
            "course__translations",
            "course__path__translations",
            "sections__translations",
        )
        .filter(id=lesson_id)
        .first()
    )
    if lesson is None:
        ContentChunk.objects.filter(lesson_id=lesson_id).delete()
        return "missing"

    statuses = []
    for language in INDEXED_LANGUAGES:
        existing = ContentChunk.objects.filter(lesson=lesson, language=language)
        title, chunks = build_lesson_chunks(lesson, language)
        if not chunks:
            existing.delete()
            statuses.append("empty")
            continue

        digest = content_hash(chunks, _EMBEDDING_MODEL)
        stored_hashes = set(existing.values_list("content_hash", flat=True))
        if (
            not force
            and stored_hashes == {digest}
            and not existing.filter(embedding__isnull=True).exists()
        ):
            statuses.append("unchanged")
            continue

        vectors = _embed_batch([c.embedding_input for c in chunks])
        config = _FTS_CONFIG[language]
        with transaction.atomic():
            existing.delete()
            ContentChunk.objects.bulk_create(
                [
                    ContentChunk(
                        lesson=lesson,
                        section_id=c.section_id,
                        language=language,
                        chunk_index=c.chunk_index,
                        title=title[:200],
                        heading=c.heading,
                        text=c.text,
                        content_hash=digest,
                        embedding=vectors[i] if vectors else None,
                        embedding_model=_EMBEDDING_MODEL if vectors else "",
                    )
                    for i, c in enumerate(chunks)
                ]
            )
            ContentChunk.objects.filter(lesson=lesson, language=language).update(
                search_vector=SearchVector("heading", weight="A", config=config)
                + SearchVector("text", weight="B", config=config)
            )
        statuses.append("indexed" if vectors else "fts_only")

    # One status per lesson: the worst outcome wins so failures stay visible in counts.
    for status in ("fts_only", "indexed", "unchanged"):
        if status in statuses:
            return status
    return "empty"


def backfill_chunks(force: bool = False) -> Dict[str, int]:
    """Index every lesson. Unchanged lessons cost no API call. Returns counts per status."""
    from education.models import Lesson

    counts: Counter = Counter()
    for lesson_id in Lesson.objects.order_by("id").values_list("id", flat=True):
        counts[index_lesson_chunks(lesson_id, force=force)] += 1
    logger.info("[retrieval] chunk backfill %s", dict(counts))
    return dict(counts)


def _vector_candidates(query_vec: List[float], language: str) -> List[tuple]:
    from pgvector.django import CosineDistance

    from education.models import ContentChunk

    with transaction.atomic(), connection.cursor() as cursor:
        # Default ef_search (40) would cap results below _CANDIDATES.
        cursor.execute("SET LOCAL hnsw.ef_search = 100")
        return list(
            ContentChunk.objects.filter(language=language, embedding__isnull=False)
            .order_by(CosineDistance("embedding", query_vec))
            .values_list("id", "lesson_id")[:_CANDIDATES]
        )


def _fulltext_candidates(query: str, language: str) -> List[tuple]:
    # Every query term must match (plainto_tsquery ANDs them). Matching ANY term was tried and
    # measured worse on the eval set (MRR 0.81 -> 0.68): common words like "money" or "month"
    # match most chunks and push noise into the fusion. Strict matching only fires on precise
    # queries ("APR vs AER", "DeFi"), which is the job full-text has next to the vectors.
    sql = """
        SELECT c.id, c.lesson_id
        FROM education_content_chunk c, plainto_tsquery(%s::regconfig, %s) q
        WHERE c.language = %s AND c.search_vector @@ q
        ORDER BY ts_rank_cd(c.search_vector, q) DESC, c.id
        LIMIT %s
    """
    with connection.cursor() as cursor:
        cursor.execute(sql, [_FTS_CONFIG[language], query, language, _CANDIDATES])
        return cursor.fetchall()


def rrf_fuse(rankings: List[List[tuple]], k: int = _RRF_K) -> List[tuple]:
    """
    Fuse ranked (chunk_id, lesson_id) lists at lesson level with Reciprocal Rank Fusion.
    A lesson's rank in each list is the position of its best chunk. Returns
    [(lesson_id, score, best_chunk_id)] best first; the best chunk comes from the first
    list that contains the lesson.
    """
    scores: Dict[int, float] = defaultdict(float)
    best_chunk: Dict[int, int] = {}
    for ranking in rankings:
        seen = set()
        for chunk_id, lesson_id in ranking:
            if lesson_id in seen:
                continue
            seen.add(lesson_id)
            scores[lesson_id] += 1.0 / (k + len(seen))
            best_chunk.setdefault(lesson_id, chunk_id)
    ordered = sorted(scores.items(), key=lambda kv: (-kv[1], kv[0]))
    return [(lesson_id, score, best_chunk[lesson_id]) for lesson_id, score in ordered]


def hybrid_search(
    query: str, top_k: int = 5, language: str = "en", mode: str = "hybrid"
) -> List[Dict[str, Any]]:
    """
    Vector + full-text search over ContentChunk, fused per lesson with RRF.
    mode="vector" or "fulltext" runs one side alone, for eval_retrieval diagnostics.
    """
    from education.models import ContentChunk

    query = (query or "").strip()
    if not query:
        return []

    rankings = []
    if mode in ("hybrid", "vector"):
        query_vec = _embed(query)
        if query_vec is not None:
            rankings.append(_vector_candidates(query_vec, language))
    if mode in ("hybrid", "fulltext"):
        rankings.append(_fulltext_candidates(query, language))

    fused = rrf_fuse(rankings)[:top_k]
    chunks = ContentChunk.objects.in_bulk([chunk_id for _, _, chunk_id in fused])
    return [
        {
            "content_type": "lesson",
            "content_id": lesson_id,
            "title": chunks[chunk_id].title,
            "snippet": chunks[chunk_id].text[:200],
            "score": round(score, 4),
        }
        for lesson_id, score, chunk_id in fused
    ]

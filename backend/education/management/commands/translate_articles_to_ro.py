"""
Translate public guides (Article) to Romanian via the configured translation provider
(OpenAI by default, same model selection as ``translate_lessons_to_ro``).

A guide is served at /ro/guides/<slug> only when its ``ro`` ArticleTranslation has a title
and content, so a guide that fails any part of its translation is not written at all —
storing the English source as the "translation" would publish English prose on a /ro URL.

``--slugs`` is required: there is no "translate every guide" mode.

Usage examples:
    # Preview: no provider calls, no writes
    python manage.py translate_articles_to_ro --slugs how-to-start-budgeting --dry-run

    # Translate guides that have no complete, current ro row yet
    python manage.py translate_articles_to_ro --slugs a,b,c --only-missing

    # Re-translate even when the ro row matches the current English
    python manage.py translate_articles_to_ro --slugs a --force-refresh
"""

from __future__ import annotations

import hashlib
import json
import logging
import re
from collections import Counter
from typing import Any, Dict, List, Optional

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from education.models import Article, ArticleTranslation
from education.services.translation import (
    OpenAIPaymentRequiredError,
    TranslationProvider,
    _strip_code_fence,
    get_translator,
)

logger = logging.getLogger(__name__)

LANGUAGE_CODE = "ro"
# The provider caps completions at 2048 tokens and Romanian runs longer than English,
# so long guides go out in chunks of whole top-level HTML blocks.
MAX_CHUNK_CHARS = 2500

VOID_TAGS = {"area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "wbr"}
BLOCK_TAGS = {
    "p",
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    "ul",
    "ol",
    "li",
    "table",
    "thead",
    "tbody",
    "tr",
    "th",
    "td",
    "blockquote",
    "figure",
    "img",
    "pre",
}
TAG_RE = re.compile(r"<(/?)([a-zA-Z][a-zA-Z0-9]*)\b[^>]*?(/?)>")
HREF_RE = re.compile(r"""\b(?:href|src)\s*=\s*["']([^"']*)["']""", re.IGNORECASE)
MONEY_RE = re.compile(r"[£$€]\s?\d[\d,.]*")


class ArticleTranslationFailed(Exception):
    pass


def _source_hash(article: Article) -> str:
    source = "|".join(
        [
            article.title or "",
            article.meta_description or "",
            article.excerpt or "",
            article.content or "",
            json.dumps(article.faq or [], sort_keys=True, ensure_ascii=False),
            json.dumps(article.item_list or [], sort_keys=True, ensure_ascii=False),
        ]
    )
    return hashlib.sha256(source.encode("utf-8")).hexdigest()[:16]


def split_html_blocks(content: str) -> List[str]:
    """Split HTML at top-level element boundaries; text between blocks rides with them."""
    blocks: List[str] = []
    depth = 0
    start = 0
    for match in TAG_RE.finditer(content):
        closing, name, self_closing = match.group(1), match.group(2).lower(), match.group(3)
        if name in VOID_TAGS or self_closing:
            if depth == 0:
                blocks.append(content[start : match.end()])
                start = match.end()
            continue
        if closing:
            depth = max(0, depth - 1)
            if depth == 0:
                blocks.append(content[start : match.end()])
                start = match.end()
        else:
            depth += 1
    tail = content[start:]
    if tail.strip():
        blocks.append(tail)
    return [b for b in blocks if b.strip()]


def chunk_html(content: str, max_chars: int = MAX_CHUNK_CHARS) -> List[str]:
    chunks: List[str] = []
    current = ""
    for block in split_html_blocks(content):
        if current and len(current) + len(block) > max_chars:
            chunks.append(current)
            current = ""
        current += block
    if current.strip():
        chunks.append(current)
    return chunks


def _block_tags(html_text: str) -> List[str]:
    return [
        m.group(1) + m.group(2).lower()
        for m in TAG_RE.finditer(html_text)
        if m.group(2).lower() in BLOCK_TAGS
    ]


def _looks_untranslated(source: str, result: str) -> bool:
    """The provider hands back the source on failure; a sentence that comes back unchanged
    was not translated. Short strings (a brand name) legitimately can."""
    return result.strip() == source.strip() and len(re.findall(r"[A-Za-z]{3,}", source)) >= 3


class Command(BaseCommand):
    help = (
        "Generate Romanian (ro) translations of the public guides named by --slugs "
        "(title, meta description, excerpt, HTML content, FAQ, item list)."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--slugs",
            type=str,
            default=None,
            help="Comma-separated Article slugs to translate. Required.",
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Show what would be translated without calling the provider or writing.",
        )
        parser.add_argument(
            "--only-missing",
            action="store_true",
            help=(
                "Skip guides whose ro row already has a title and content and was made from "
                "the current English (when the row records a source hash)."
            ),
        )
        parser.add_argument(
            "--force-refresh",
            action="store_true",
            help="Re-translate even when the ro row matches the current English.",
        )

    def handle(self, *args, **options):
        slugs = [s.strip() for s in (options["slugs"] or "").split(",") if s.strip()]
        if not slugs:
            raise CommandError(
                "--slugs is required (comma-separated). This command never translates every "
                "guide at once."
            )
        self.dry_run: bool = options["dry_run"]
        self.only_missing: bool = options["only_missing"]
        self.force_refresh: bool = options["force_refresh"]
        if self.only_missing and self.force_refresh:
            raise CommandError("Cannot combine --only-missing with --force-refresh.")

        slugs = list(dict.fromkeys(slugs))
        articles = {a.slug: a for a in Article.objects.filter(slug__in=slugs)}
        unknown = [s for s in slugs if s not in articles]
        if unknown:
            raise CommandError(f"No guide with slug: {', '.join(unknown)}. Nothing was translated.")

        self.translator: Optional[TranslationProvider] = None if self.dry_run else get_translator()
        self.stats: Dict[str, int] = {"translated": 0, "skipped": 0, "failed": 0}
        failed: List[str] = []

        if self.dry_run:
            self.stdout.write(self.style.NOTICE("DRY RUN – no provider calls, no changes saved.\n"))

        for slug in slugs:
            article = articles[slug]
            try:
                self._process(article)
            except OpenAIPaymentRequiredError as e:
                raise CommandError(
                    "OpenAI returned 402 Payment Required (credits exhausted or billing limit). "
                    "Add credits and re-run with --only-missing to resume."
                ) from e
            except ArticleTranslationFailed as e:
                logger.error("Article %s not translated: %s", slug, e)
                self.stdout.write(self.style.ERROR(f"[{slug}] FAILED, nothing written: {e}"))
                self.stats["failed"] += 1
                failed.append(slug)

        self._print_summary()
        if failed:
            raise CommandError(f"{len(failed)} guide(s) not translated: {', '.join(failed)}")

    def _process(self, article: Article) -> None:
        slug = article.slug
        current_hash = _source_hash(article)
        existing = ArticleTranslation.objects.filter(
            article=article, language=LANGUAGE_CODE
        ).first()
        complete = bool(
            existing and (existing.title or "").strip() and (existing.content or "").strip()
        )
        stored_hash = (existing.source_hash or "") if existing else ""

        if not self.force_refresh and complete:
            if self.only_missing and (not stored_hash or stored_hash == current_hash):
                self.stdout.write(f"[{slug}] skip: ro row already complete")
                self.stats["skipped"] += 1
                return
            if stored_hash == current_hash:
                self.stdout.write(f"[{slug}] skip: ro row matches current English")
                self.stats["skipped"] += 1
                return

        if not article.is_published:
            self.stdout.write(
                self.style.WARNING(f"[{slug}] is not published; ro row will not be public yet")
            )

        if self.dry_run:
            chunks = chunk_html(article.content or "")
            action = "update" if existing else "create"
            self.stdout.write(
                f"[{slug}] Would {action} ro row: title, meta_description, excerpt, "
                f"content ({len(article.content or '')} chars in {len(chunks)} chunk(s)), "
                f"faq ({len(article.faq or [])}), item_list ({len(article.item_list or [])})"
            )
            self.stats["translated"] += 1
            return

        payload = self._translate_article(article)
        payload["source_hash"] = current_hash
        with transaction.atomic():
            ArticleTranslation.objects.update_or_create(
                article=article, language=LANGUAGE_CODE, defaults=payload
            )
        self.stdout.write(self.style.SUCCESS(f"[{slug}] translated"))
        self.stats["translated"] += 1

    # ------------------------------------------------------------------
    # Translation
    # ------------------------------------------------------------------
    def _translate_article(self, article: Article) -> Dict[str, Any]:
        ctx = {"article": article.slug, "title": article.title}
        title = self._translate(article.title, {**ctx, "field": "article_title"})
        if not title:
            raise ArticleTranslationFailed("empty title")
        content = self._translate_html(article.content or "", ctx)
        if not content.strip():
            raise ArticleTranslationFailed("empty content")
        return {
            "title": title[:200],
            "meta_description": self._translate(
                article.meta_description, {**ctx, "field": "article_meta_description"}
            ),
            "excerpt": self._translate(article.excerpt, {**ctx, "field": "article_excerpt"}),
            "content": content,
            "faq": self._translate_faq(article.faq, ctx),
            "item_list": self._translate_item_list(article.item_list, ctx),
        }

    def _translate(self, text: Optional[str], context: Dict[str, Any]) -> str:
        text = (text or "").strip()
        if not text:
            return ""
        try:
            result = self.translator.translate_text(text, context)
        except OpenAIPaymentRequiredError:
            raise
        except Exception as exc:
            raise ArticleTranslationFailed(f"{context.get('field')}: {exc}") from exc
        result = _strip_code_fence(result or "")
        if not result or _looks_untranslated(text, result):
            raise ArticleTranslationFailed(f"{context.get('field')} came back untranslated")
        problem = self._money_mismatch(text, result)
        if problem:
            raise ArticleTranslationFailed(f"{context.get('field')}: {problem}")
        return result

    def _translate_html(self, content: str, ctx: Dict[str, Any]) -> str:
        chunks = chunk_html(content)
        out: List[str] = []
        for index, chunk in enumerate(chunks, start=1):
            chunk_ctx = {**ctx, "field": "article_content", "chunk": f"{index}/{len(chunks)}"}
            last_problem = ""
            result = ""
            # One retry: the model occasionally drops a tag or rewrites a link.
            for _attempt in range(2):
                try:
                    result = self._translate(chunk, chunk_ctx)
                except ArticleTranslationFailed as exc:
                    last_problem = str(exc)
                else:
                    last_problem = self._structure_mismatch(chunk, result)
                if not last_problem:
                    break
                logger.warning(
                    "Article %s chunk %s: %s; retrying", ctx["article"], index, last_problem
                )
            if last_problem:
                raise ArticleTranslationFailed(
                    f"content chunk {index}/{len(chunks)}: {last_problem}"
                )
            # Keep the source's whitespace between blocks; the model strips it.
            leading = chunk[: len(chunk) - len(chunk.lstrip())]
            trailing = chunk[len(chunk.rstrip()) :]
            out.append(leading + result.strip() + trailing)
        return "".join(out)

    def _translate_faq(self, faq: Any, ctx: Dict[str, Any]) -> Optional[List[Any]]:
        if not faq:
            return faq
        translated = []
        for item in faq:
            if not isinstance(item, dict):
                translated.append(item)
                continue
            translated.append(
                {
                    **item,
                    "question": self._translate(
                        item.get("question"), {**ctx, "field": "article_faq_question"}
                    ),
                    "answer": self._translate(
                        item.get("answer"), {**ctx, "field": "article_faq_answer"}
                    ),
                }
            )
        return translated

    def _translate_item_list(self, items: Any, ctx: Dict[str, Any]) -> Optional[List[Any]]:
        # name and url are the product's own and stay as they are; only the blurb is prose.
        if not items:
            return items
        translated = []
        for item in items:
            if isinstance(item, dict) and item.get("description"):
                item = {
                    **item,
                    "description": self._translate(
                        item["description"],
                        {**ctx, "field": "article_item_description", "item": item.get("name")},
                    ),
                }
            translated.append(item)
        return translated

    @staticmethod
    def _structure_mismatch(source: str, result: str) -> str:
        if _block_tags(source) != _block_tags(result):
            return "HTML block structure changed"
        if Counter(HREF_RE.findall(source)) != Counter(HREF_RE.findall(result)):
            return "a link or image URL changed"
        return ""

    @staticmethod
    def _money_mismatch(source: str, result: str) -> str:
        src = Counter(m.replace(" ", "").rstrip(".,") for m in MONEY_RE.findall(source))
        out = Counter(m.replace(" ", "").rstrip(".,") for m in MONEY_RE.findall(result))
        return "" if src == out else f"currency amounts changed ({dict(src)} vs {dict(out)})"

    def _print_summary(self):
        s = self.stats
        prefix = "Would create/update" if self.dry_run else "Created/updated"
        self.stdout.write("")
        self.stdout.write(
            self.style.SUCCESS(f"=== Guide translation summary ({LANGUAGE_CODE}) ===")
        )
        self.stdout.write(f"  {prefix} {s['translated']} guide translation(s)")
        self.stdout.write(f"  Skipped: {s['skipped']}")
        if s["failed"]:
            self.stdout.write(self.style.ERROR(f"  Failed: {s['failed']}"))
        self.stdout.write("")

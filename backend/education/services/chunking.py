"""
Turn lesson content into retrieval chunks.

Chunk 0 is the lesson's identity: its title and one-line description. Its detailed content and
each published text section follow, split on paragraph boundaries when longer than
MAX_CHUNK_CHARS (~450 tokens). Every chunk carries a "Path › Course › Lesson › Section"
heading that is embedded with the text, so a short section still knows what it is about.

Pure functions only: the DB reads live in build_lesson_chunks, the writes in retrieval.py.
"""

from __future__ import annotations

import hashlib
import html
import re
from dataclasses import dataclass
from typing import List, Optional

from django.utils.html import strip_tags

MAX_CHUNK_CHARS = 1800
HEADING_SEP = " › "

_BLOCK_TAGS = re.compile(r"</?(p|div|li|ul|ol|h[1-6]|br|tr|table|blockquote)[^>]*>", re.I)
_BLANK_LINES = re.compile(r"\n\s*\n+")
_SPACES = re.compile(r"[ \t ]+")
_SENTENCE_END = re.compile(r"(?<=[.!?])\s+")


@dataclass
class Chunk:
    section_id: Optional[int]
    chunk_index: int
    heading: str
    text: str

    @property
    def embedding_input(self) -> str:
        return f"{self.heading}\n\n{self.text}"


def html_to_text(raw: Optional[str]) -> str:
    """CKEditor HTML to plain text with paragraphs separated by blank lines."""
    if not raw:
        return ""
    text = _BLOCK_TAGS.sub("\n\n", raw)
    text = html.unescape(strip_tags(text))
    text = _SPACES.sub(" ", text)
    paragraphs = [p.strip() for p in _BLANK_LINES.split(text)]
    return "\n\n".join(p for p in paragraphs if p)


def split_text(text: str, max_chars: int = MAX_CHUNK_CHARS) -> List[str]:
    """Greedy-pack paragraphs into pieces of at most max_chars; split long paragraphs by sentence."""
    units: List[str] = []
    for paragraph in text.split("\n\n"):
        if len(paragraph) <= max_chars:
            units.append(paragraph)
            continue
        units.extend(_pack(_SENTENCE_END.split(paragraph), max_chars, sep=" "))
    return _pack(units, max_chars, sep="\n\n")


def _pack(units: List[str], max_chars: int, sep: str) -> List[str]:
    pieces: List[str] = []
    current = ""
    for unit in units:
        unit = unit.strip()
        if not unit:
            continue
        if current and len(current) + len(sep) + len(unit) > max_chars:
            pieces.append(current)
            current = unit
        else:
            current = f"{current}{sep}{unit}" if current else unit
    if current:
        pieces.append(current)
    # A single sentence longer than max_chars is hard-cut rather than dropped.
    return [p[i : i + max_chars] for p in pieces for i in range(0, len(p), max_chars)]


def heading_for(*parts: Optional[str]) -> str:
    return HEADING_SEP.join(p.strip() for p in parts if p and p.strip())[:600]


def content_hash(chunks: List[Chunk], embedding_model: str) -> str:
    digest = hashlib.sha256(embedding_model.encode())
    for chunk in chunks:
        digest.update(b"\x00")
        digest.update(chunk.embedding_input.encode())
    return digest.hexdigest()


def _translation(obj, language: str):
    """Prefetched translation for language, or None."""
    return next((t for t in obj.translations.all() if t.language == language), None)


def _field(obj, translation, name: str, language: str) -> str:
    """
    Field value in this language. English falls back to the base model, which is authored in
    English; other languages never fall back, so a Romanian chunk is never English text.
    """
    value = getattr(translation, name, None) if translation else None
    if not value and language == "en":
        value = getattr(obj, name, None)
    return value or ""


def build_lesson_chunks(lesson, language: str) -> tuple[str, List[Chunk]]:
    """
    Return (lesson title in this language, chunks) for one lesson.
    Expects lesson with course__path, translations and sections__translations prefetched.
    """
    course = lesson.course
    path = course.path if course else None
    lesson_tr = _translation(lesson, language)
    title = _field(lesson, lesson_tr, "title", language)
    path_title = _field(path, _translation(path, language), "title", language) if path else ""
    course_title = (
        _field(course, _translation(course, language), "title", language) if course else ""
    )
    if not title:
        return "", []

    chunks: List[Chunk] = []
    lesson_heading = heading_for(path_title, course_title, title)
    # Chunk 0 is the lesson's identity (title + one-line description) on its own, so a question
    # about the topic matches it without being diluted by body text.
    summary = _field(lesson, lesson_tr, "short_description", language).strip()
    chunks.append(Chunk(None, 0, lesson_heading, summary or title))
    detailed = html_to_text(_field(lesson, lesson_tr, "detailed_content", language))
    for piece in split_text(detailed) if detailed else []:
        chunks.append(Chunk(None, len(chunks), lesson_heading, piece))

    sections = sorted(lesson.sections.all(), key=lambda s: (s.order, s.id))
    for section in sections:
        if section.content_type != "text" or not section.is_published:
            continue
        section_tr = _translation(section, language)
        body = html_to_text(_field(section, section_tr, "text_content", language))
        if not body:
            continue
        section_heading = heading_for(
            path_title, course_title, title, _field(section, section_tr, "title", language)
        )
        for piece in split_text(body):
            chunks.append(Chunk(section.id, len(chunks), section_heading, piece))

    return title, chunks

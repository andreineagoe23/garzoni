import re
from urllib.error import URLError, HTTPError
from urllib.parse import quote_plus
from urllib.request import urlopen

from django.core.management.base import BaseCommand

from education.models import Lesson


YOUTUBE_ID_RE = re.compile(
    r"(?:youtu\.be/|youtube\.com/(?:watch\?v=|embed/|shorts/))([A-Za-z0-9_-]{11})"
)


def extract_youtube_id(url: str | None) -> str | None:
    if not url:
        return None
    m = YOUTUBE_ID_RE.search(url)
    if m:
        return m.group(1)
    return None


def to_embed_url(url: str | None) -> str | None:
    vid = extract_youtube_id(url)
    if not vid:
        return None
    return f"https://www.youtube.com/embed/{vid}"


def oembed_ok(embed_url: str, timeout: float = 4.0) -> bool:
    # YouTube oEmbed responds for available videos.
    api = (
        "https://www.youtube.com/oembed?url="
        + quote_plus(embed_url.replace("/embed/", "/watch?v="))
        + "&format=json"
    )
    try:
        with urlopen(api, timeout=timeout) as r:  # nosec B310 - trusted static endpoint
            return 200 <= r.status < 300
    except (HTTPError, URLError, TimeoutError):
        return False


class Command(BaseCommand):
    help = (
        "Verify section-4 YouTube embeds for all lessons and optionally fix invalid/missing URLs."
    )

    def add_arguments(self, parser):
        parser.add_argument("--fix", action="store_true", help="Fix invalid/missing URLs in place.")
        parser.add_argument(
            "--check-live",
            action="store_true",
            help="Also call YouTube oEmbed to test URL reachability.",
        )

    def handle(self, *args, **options):
        fix = options["fix"]
        check_live = options["check_live"]

        lessons = list(Lesson.objects.select_related("course").prefetch_related("sections"))
        course_fallback: dict[int, str] = {}

        for lesson in lessons:
            if lesson.course_id in course_fallback:
                continue
            for s in lesson.sections.all().order_by("order"):
                if s.content_type == "video" and s.video_url:
                    embed = to_embed_url(s.video_url)
                    if embed and (not check_live or oembed_ok(embed)):
                        course_fallback[lesson.course_id] = embed
                        break

        invalid = 0
        fixed = 0

        for lesson in lessons:
            section4 = lesson.sections.filter(order=4).first()
            if not section4 or section4.content_type != "video":
                invalid += 1
                self.stdout.write(
                    self.style.WARNING(f"Lesson {lesson.id} has no video at section 4.")
                )
                continue

            current = section4.video_url or ""
            embed = to_embed_url(current)
            live_ok = True
            if embed and check_live:
                live_ok = oembed_ok(embed)

            is_valid = bool(embed) and live_ok
            if is_valid:
                # Canonicalize to embed form.
                if current != embed and fix:
                    section4.video_url = embed
                    section4.save(update_fields=["video_url"])
                    fixed += 1
                continue

            invalid += 1
            fallback = (
                course_fallback.get(lesson.course_id) or "https://www.youtube.com/embed/yutCwdljxng"
            )
            self.stdout.write(
                self.style.WARNING(
                    f"Invalid video in lesson {lesson.id} ({lesson.title}): {current!r} -> fallback {fallback}"
                )
            )
            if fix:
                section4.video_url = fallback
                section4.save(update_fields=["video_url"])
                fixed += 1

        self.stdout.write(
            self.style.SUCCESS(f"Video verification complete. Invalid: {invalid}. Fixed: {fixed}.")
        )

import json
import re
from pathlib import Path

from django.core.management.base import BaseCommand

from education.models import ContentReleaseState, Lesson, LessonSection, LessonSectionTranslation


MANIFEST_PATH = Path(__file__).resolve().parents[2] / "content" / "release_manifest.json"
BROKEN_VIDEO_IDS = {
    "J7dJ_tN1q1E",
    "U926I0fT6gY",
    "3cXKsMAbXyI",
    "Yb6825iv0XM",
    "f4Z8gJ-78dY",
    "EyTb0G0r6q0",
    "BiblWzD9T24",
    "y0i5A9A9Wjw",
    "M0yhHKWBppg",
    "zLb3u5hX1Q0",
    "7R_u4Xl2pKE",
}
YOUTUBE_ID_RE = re.compile(
    r"(?:youtu\.be/|youtube\.com/(?:watch\?v=|embed/|shorts/))([A-Za-z0-9_-]{11})"
)


def topic(title: str) -> str:
    base = title.split(":", 1)[1].strip() if ":" in title else title.strip()
    return " ".join(base.replace("?", "").replace("vs.", "versus").split())


def concept(topic_text: str) -> str:
    t = topic_text.lower()
    for prefix in ("what is ", "introduction to ", "the ", "understanding "):
        if t.startswith(prefix):
            t = t[len(prefix) :]
    return t


def domain(c: str, path: str) -> tuple[str, str, str, str]:
    p = (path or "").lower()
    if any(
        k in c
        for k in ("budget", "spending", "income", "expense", "savings", "no-spend", "sinking fund")
    ):
        return (
            "planned versus actual cash flow",
            "a week with higher variable spending",
            "tight or unrealistic category limits",
            "adjust one category and compare outcomes next week",
        )
    if any(k in c for k in ("credit", "debt", "score")):
        return (
            "payment reliability and utilization trend",
            "a month with several due dates",
            "depending on minimum payments",
            "reduce utilization before adding new borrowing",
        )
    if any(
        k in c for k in ("invest", "asset", "diversification", "compound", "inflation", "wealth")
    ):
        return (
            "contribution consistency and allocation drift",
            "a volatile month with mixed returns",
            "switching strategy after headlines",
            "rebalance only when drift crosses your threshold",
        )
    if any(
        k in c
        for k in (
            "real estate",
            "property",
            "rental",
            "mortgage",
            "commercial",
            "syndication",
            "brrrr",
        )
    ):
        return (
            "net cash flow after reserves",
            "a quarter with vacancy and repair pressure",
            "using optimistic assumptions only",
            "stress-test financing and occupancy assumptions",
        )
    if any(
        k in c for k in ("crypto", "blockchain", "wallet", "defi", "nft", "smart contract", "tax")
    ):
        return (
            "position-size discipline and security compliance",
            "a high-volatility session",
            "expanding risk before security checks",
            "cap exposure and separate storage from trading activity",
        )
    if any(k in c for k in ("forex", "currency", "trading", "backtesting", "leverage", "drawdown")):
        return (
            "rule adherence and drawdown stability",
            "a fast move after economic news",
            "increasing size to recover losses quickly",
            "reduce size and return to tested setups",
        )
    if p == "financial mindset" or any(
        k in c
        for k in (
            "mindset",
            "resilience",
            "stress",
            "gratitude",
            "habit",
            "vision",
            "learning",
            "money story",
            "boundaries",
        )
    ):
        return (
            "weekly habit completion",
            "a stressful week with competing priorities",
            "relying on motivation alone",
            "protect one weekly money review block",
        )
    return (
        "decision quality across repeated cycles",
        "an unexpected change in conditions",
        "changing many variables at once",
        "change one variable and remeasure before next adjustment",
    )


def build_html(
    order: int, c: str, course: str, metric: str, scenario: str, pitfall: str, correction: str
) -> str:
    if order in (1, 2):
        paragraphs = [
            (
                f"This section introduces {c} with practical rules you can apply in real life. "
                f"In {course}, better outcomes usually come from clear process before action. "
                f"Use {metric} as your primary checkpoint while learning {c}."
            ),
            (
                f"Start with one small rule for {c} and test it under normal conditions. "
                f"Use {scenario} as a realistic practice case rather than a perfect scenario. "
                f"Record the outcome for {c} immediately so your notes stay accurate."
            ),
            (
                f"A frequent mistake in {c} is {pitfall}. "
                f"Keep your setup for {c} simple enough to repeat during busy weeks. "
                f"Then improve one part of {c} at a time using evidence from your own results."
            ),
        ]
    elif order in (4, 5):
        paragraphs = [
            (
                f"The core concept in {c} is linking each decision to a measurable result. "
                f"If the result in {c} is vague, the method is probably weak. "
                f"Track {metric} so performance in {c} stays visible over time."
            ),
            (
                f"A useful structure for {c} is objective, limit, and trigger. "
                f"Objective defines success in {c}, limit protects downside, and trigger tells you when to adjust. "
                f"This keeps decisions in {c} stable when pressure rises."
            ),
            (
                f"Stress-test your approach to {c} with {scenario}. "
                f"If the process for {c} fails, simplify and rerun it instead of replacing everything at once. "
                f"This prevents the common error of {pitfall}."
            ),
        ]
    elif order in (7, 8):
        paragraphs = [
            (
                f"Apply {c} to one decision you will make this week. "
                f"Write the objective, the boundary, and the review time for {c} before you execute. "
                f"This turns {c} knowledge into consistent behavior."
            ),
            (
                f"After the decision, compare expected and actual outcomes in {c} using simple numbers tied to {metric}. "
                f"If the gap is meaningful, use a focused correction: {correction}. "
                f"Small adjustments in {c} are easier to sustain than full resets."
            ),
            (
                f"Do not evaluate {c} from a single result. "
                f"Run the same process for {c} across several cycles and review trend quality. "
                f"Repetition with measured feedback is where {c} skill becomes durable."
            ),
        ]
    else:
        paragraphs = [
            (
                f"By now, you should be able to explain {c} in plain language and apply it to real decisions. "
                f"The goal in {c} is confident execution, not memorizing terminology. "
                f"Keep {metric} as your main scorecard for {c}."
            ),
            (
                f"Maintain a version of your {c} process that works in normal weeks, not only ideal ones. "
                f"Consistency in {c} over months usually beats high effort for a few days. "
                f"Reliable {c} routines reduce avoidable mistakes over time."
            ),
            (
                f"Schedule a short weekly review for {c} and look for early drift. "
                f"When results in {c} weaken, apply one correction and measure again before changing anything else. "
                f"This keeps improvement in {c} steady under changing conditions."
            ),
        ]
    return "\n".join(f"<p>{p}</p>" for p in paragraphs)


def extract_embed_id(url: str) -> str:
    m = YOUTUBE_ID_RE.search(url or "")
    return m.group(1) if m else ""


class Command(BaseCommand):
    help = "Idempotent in-place content sync for lessons/videos with version tracking."

    def add_arguments(self, parser):
        parser.add_argument("--dry-run", action="store_true")
        parser.add_argument("--force", action="store_true")

    def handle(self, *args, **options):
        dry_run = options["dry_run"]
        force = options["force"]

        manifest = json.loads(MANIFEST_PATH.read_text())
        target_version = manifest["version"]
        content_key = manifest.get("content_key", "education_content")
        fallback_map = {int(k): v for k, v in manifest.get("video_course_fallbacks", {}).items()}

        state = ContentReleaseState.objects.filter(key=content_key).first()
        if state and state.version == target_version and not force:
            self.stdout.write(
                self.style.SUCCESS(
                    f"Content version {target_version} already applied for key '{content_key}'."
                )
            )
            return

        title_fixes = {
            40: "Lesson 3: Common Forex Strategies",
            51: "Lesson 2: Gamify Your Savings Goals",
        }

        touched_sections = 0
        touched_lessons = 0
        touched_videos = 0

        for lesson in Lesson.objects.select_related("course", "course__path").all().order_by("id"):
            if lesson.id in title_fixes and lesson.title != title_fixes[lesson.id]:
                if not dry_run:
                    lesson.title = title_fixes[lesson.id]
                    lesson.save(update_fields=["title"])
                touched_lessons += 1

            t = topic(lesson.title)
            c = concept(t)
            metric, scenario, pitfall, correction = domain(
                c, lesson.course.path.title if lesson.course and lesson.course.path else ""
            )
            course = lesson.course.title if lesson.course else "this course"

            for section in lesson.sections.filter(
                content_type="text", order__in=[1, 2, 4, 5, 7, 8]
            ).order_by("order"):
                new_html = build_html(
                    section.order, c, course, metric, scenario, pitfall, correction
                )
                if (section.text_content or "").strip() != new_html.strip():
                    if not dry_run:
                        section.text_content = new_html
                        section.save(update_fields=["text_content"])
                        LessonSectionTranslation.objects.filter(section=section).update(
                            text_content=new_html
                        )
                    touched_sections += 1

            video_section = lesson.sections.filter(content_type="video", order=9).first()
            if video_section:
                current = (video_section.video_url or "").strip()
                broken = extract_embed_id(current) in BROKEN_VIDEO_IDS
                fallback = fallback_map.get(lesson.course_id)
                if broken and fallback and current != fallback:
                    if not dry_run:
                        video_section.video_url = fallback
                        video_section.save(update_fields=["video_url"])
                    touched_videos += 1

        if not dry_run:
            ContentReleaseState.objects.update_or_create(
                key=content_key, defaults={"version": target_version}
            )

        mode = "Would update" if dry_run else "Updated"
        self.stdout.write(
            self.style.SUCCESS(
                f"{mode} content release {target_version}: "
                f"text sections={touched_sections}, lesson titles={touched_lessons}, videos={touched_videos}."
            )
        )

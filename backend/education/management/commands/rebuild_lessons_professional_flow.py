import re
from collections import defaultdict

from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils.html import strip_tags
from django.utils.text import Truncator

from education.models import Lesson, LessonSection, LessonSectionTranslation


YOUTUBE_ID_RE = re.compile(
    r"(?:youtu\.be/|youtube\.com/(?:watch\?v=|embed/|shorts/))([A-Za-z0-9_-]{11})"
)

TEMPLATE = [
    ("Overview", "text"),
    ("Knowledge Check 1", "exercise"),
    ("Core Concept", "text"),
    ("Watch & Learn", "video"),
    ("Applied Insight", "text"),
    ("Knowledge Check 2", "exercise"),
    ("Key Takeaways", "text"),
]


def normalize_whitespace(text: str) -> str:
    return re.sub(r"\s+", " ", (text or "")).strip()


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


def html_paragraphs(*paragraphs: str) -> str:
    lines = []
    for p in paragraphs:
        p = normalize_whitespace(p)
        if p:
            lines.append(f"<p>{p}</p>")
    return "\n".join(lines)


class Command(BaseCommand):
    help = (
        "Rebuild all lessons into a professional 7-section flow: "
        "text, exercise, text, video, text, exercise, text."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Show what would be rebuilt without saving changes.",
        )

    def handle(self, *args, **options):
        dry_run = options["dry_run"]
        if dry_run:
            self.stdout.write("DRY RUN - no changes will be saved.")

        lessons = list(
            Lesson.objects.select_related("course")
            .prefetch_related("sections", "translations")
            .order_by("course_id", "id")
        )

        # Build course-level video fallback map from current sections.
        course_video_fallback: dict[int, str] = {}
        for lesson in lessons:
            if lesson.course_id in course_video_fallback:
                continue
            section_urls = [
                s.video_url
                for s in lesson.sections.all()
                if s.content_type == "video" and s.video_url
            ]
            for url in section_urls:
                embed = to_embed_url(url)
                if embed:
                    course_video_fallback[lesson.course_id] = embed
                    break

        updated_lessons = 0
        created_sections = 0

        for lesson in lessons:
            with transaction.atomic():
                source_text = self._build_source_text(lesson)
                course_title = lesson.course.title if lesson.course else "the course"
                profile = self._domain_profile(course_title, lesson.title)
                chunks = self._build_professional_text_chunks(
                    lesson_title=lesson.title,
                    course_title=course_title,
                    source_text=source_text,
                    profile=profile,
                )
                exercise_1 = self._build_exercise(
                    lesson_title=lesson.title,
                    source_html=chunks["overview"],
                    variant=1,
                    profile=profile,
                )
                exercise_2 = self._build_exercise(
                    lesson_title=lesson.title,
                    source_html=chunks["applied"],
                    variant=2,
                    profile=profile,
                )
                video_url = (
                    to_embed_url(lesson.video_url)
                    or course_video_fallback.get(lesson.course_id)
                    or "https://www.youtube.com/embed/J7dJ_tN1q1E"
                )

                if dry_run:
                    self.stdout.write(
                        f"Would rebuild lesson {lesson.id} ({lesson.title}) -> 7 sections"
                    )
                    updated_lessons += 1
                    created_sections += 7
                    continue

                # Full rebuild requested: remove all existing sections, recreate exact template.
                lesson.sections.all().delete()

                payloads = [
                    {
                        "order": 1,
                        "title": TEMPLATE[0][0],
                        "content_type": "text",
                        "text_content": chunks["overview"],
                        "exercise_type": None,
                        "exercise_data": None,
                        "video_url": "",
                    },
                    {
                        "order": 2,
                        "title": TEMPLATE[1][0],
                        "content_type": "exercise",
                        "text_content": "",
                        "exercise_type": "multiple-choice",
                        "exercise_data": exercise_1,
                        "video_url": "",
                    },
                    {
                        "order": 3,
                        "title": TEMPLATE[2][0],
                        "content_type": "text",
                        "text_content": chunks["core"],
                        "exercise_type": None,
                        "exercise_data": None,
                        "video_url": "",
                    },
                    {
                        "order": 4,
                        "title": TEMPLATE[3][0],
                        "content_type": "video",
                        "text_content": chunks["video_intro"],
                        "exercise_type": None,
                        "exercise_data": None,
                        "video_url": video_url,
                    },
                    {
                        "order": 5,
                        "title": TEMPLATE[4][0],
                        "content_type": "text",
                        "text_content": chunks["applied"],
                        "exercise_type": None,
                        "exercise_data": None,
                        "video_url": "",
                    },
                    {
                        "order": 6,
                        "title": TEMPLATE[5][0],
                        "content_type": "exercise",
                        "text_content": "",
                        "exercise_type": "multiple-choice",
                        "exercise_data": exercise_2,
                        "video_url": "",
                    },
                    {
                        "order": 7,
                        "title": TEMPLATE[6][0],
                        "content_type": "text",
                        "text_content": chunks["takeaways"],
                        "exercise_type": None,
                        "exercise_data": None,
                        "video_url": "",
                    },
                ]

                created = []
                for p in payloads:
                    section = LessonSection.objects.create(
                        lesson=lesson,
                        order=p["order"],
                        title=p["title"],
                        content_type=p["content_type"],
                        text_content=p["text_content"] or "",
                        video_url=p["video_url"] or "",
                        exercise_type=p["exercise_type"],
                        exercise_data=p["exercise_data"],
                        is_published=True,
                    )
                    created.append(section)

                languages = set(lesson.translations.values_list("language", flat=True))
                if not languages:
                    languages = {"en", "ro"}
                else:
                    languages.update({"en", "ro"})

                for section in created:
                    for lang in languages:
                        LessonSectionTranslation.objects.create(
                            section=section,
                            language=lang,
                            title=section.title,
                            text_content=section.text_content or "",
                            exercise_data=section.exercise_data,
                        )

                updated_lessons += 1
                created_sections += len(created)

        message = (
            f"Would rebuild {updated_lessons} lessons and create {created_sections} sections."
            if dry_run
            else f"Rebuilt {updated_lessons} lessons and created {created_sections} sections."
        )
        self.stdout.write(self.style.SUCCESS(message))

    def _build_source_text(self, lesson: Lesson) -> str:
        parts = [
            lesson.short_description or "",
            strip_tags(lesson.detailed_content or ""),
        ]
        for section in lesson.sections.all().order_by("order"):
            if section.content_type == "text":
                parts.append(strip_tags(section.text_content or ""))
            elif section.content_type == "exercise":
                q = ""
                if isinstance(section.exercise_data, dict):
                    q = section.exercise_data.get("question") or ""
                parts.append(q)
        merged = normalize_whitespace(" ".join([p for p in parts if p]))
        return merged

    def _domain_profile(self, course_title: str, lesson_title: str) -> dict[str, str]:
        combined = f"{course_title} {lesson_title}".lower()
        default = {
            "focus_area": "financial decision-making",
            "objective_hint": "clarify objective, constraints, and consequences",
            "risk_focus": "mispricing risk and acting on incomplete information",
            "scenario": "a learner comparing two financial choices under real-world constraints",
            "pitfall": "making decisions from confidence rather than evidence",
            "better_practice": "document assumptions and compare alternatives before acting",
            "exercise_context": "a practical personal-finance decision",
            "good_decision": "Set a clear objective, test assumptions, and compare trade-offs before taking action.",
            "bad_decision_1": "Pick the option with the most upside and ignore downside probability.",
            "bad_decision_2": "Follow a popular opinion without checking whether your constraints match.",
            "bad_decision_3": "Delay the decision indefinitely instead of using available evidence.",
            "good_execution": "Track results against your assumptions and adjust only when evidence changes.",
            "bad_execution_1": "Change strategy every time short-term outcomes fluctuate.",
            "bad_execution_2": "Judge quality only by one recent outcome, not process consistency.",
            "bad_execution_3": "Keep decisions undocumented so mistakes cannot be reviewed.",
        }
        if any(
            k in combined for k in ["budget", "saving", "spending", "money mindset", "discipline"]
        ):
            return {
                **default,
                "focus_area": "cash-flow planning and spending control",
                "objective_hint": "prioritize essentials, automate savings, and allocate discretionary spend intentionally",
                "risk_focus": "lifestyle creep and hidden recurring expenses",
                "scenario": "a monthly budget under variable bills and competing priorities",
                "pitfall": "building a budget once and never reconciling it with real transactions",
                "better_practice": "review actual vs planned spending weekly and adjust categories early",
                "exercise_context": "a household budgeting decision",
                "good_decision": "Separate needs from wants, fund essentials first, and assign each remaining dollar to a purpose.",
                "bad_decision_1": "Budget only for fixed bills and ignore variable categories like food or transport.",
                "bad_decision_2": "Rely on memory instead of transaction data to track spending trends.",
                "bad_decision_3": "Increase lifestyle spending every time income rises without increasing savings.",
                "good_execution": "Use weekly check-ins, reconcile transactions, and update caps when patterns change.",
                "bad_execution_1": "Skip tracking for small purchases because they seem insignificant.",
                "bad_execution_2": "Treat every over-budget month as temporary and never change assumptions.",
                "bad_execution_3": "Use savings as a default checking account instead of setting transfer rules.",
            }
        if any(k in combined for k in ["credit", "debt"]):
            return {
                **default,
                "focus_area": "credit use, repayment strategy, and score protection",
                "objective_hint": "manage utilization, payment timing, and borrowing cost",
                "risk_focus": "high-interest revolving debt and late-payment penalties",
                "scenario": "a borrower managing multiple balances with different APRs",
                "pitfall": "paying minimums without a prioritized payoff strategy",
                "better_practice": "rank debts by APR or balance and automate on-time payments",
                "exercise_context": "a debt repayment and credit score decision",
                "good_decision": "Pay on time, control utilization, and direct extra cash to highest-impact balances.",
                "bad_decision_1": "Open new credit lines while already struggling with repayment consistency.",
                "bad_decision_2": "Ignore statement dates and assume due dates are the only timing that matters.",
                "bad_decision_3": "Choose loans by monthly payment only and ignore total borrowing cost.",
                "good_execution": "Track utilization monthly and revise payoff order when rates or cash flow change.",
                "bad_execution_1": "Apply lump-sum payments randomly without a method.",
                "bad_execution_2": "Use credit for non-essential spending during payoff without a limit.",
                "bad_execution_3": "Assume credit score changes are random and stop monitoring reports.",
            }
        if any(k in combined for k in ["investment", "wealth", "compound", "inflation", "asset"]):
            return {
                **default,
                "focus_area": "long-term portfolio construction and risk-adjusted returns",
                "objective_hint": "align time horizon, diversification, and contribution discipline",
                "risk_focus": "concentration risk, performance chasing, and inflation drag",
                "scenario": "an investor balancing growth goals with volatility tolerance",
                "pitfall": "changing allocation based on headlines instead of policy",
                "better_practice": "define an investment policy and rebalance on schedule",
                "exercise_context": "a portfolio allocation decision",
                "good_decision": "Match asset allocation to horizon and risk tolerance, then contribute consistently.",
                "bad_decision_1": "Move fully into last year's top-performing asset class.",
                "bad_decision_2": "Treat emergency savings and long-term investments as the same bucket.",
                "bad_decision_3": "Judge a strategy after a short drawdown without reviewing assumptions.",
                "good_execution": "Rebalance periodically and evaluate performance against a relevant benchmark.",
                "bad_execution_1": "Pause contributions after volatility spikes and wait for certainty.",
                "bad_execution_2": "Add assets without checking overlap, fees, or diversification effect.",
                "bad_execution_3": "Ignore inflation when setting required long-term return targets.",
            }
        if any(
            k in combined
            for k in ["real estate", "property", "rent", "mortgage", "brrrr", "syndication"]
        ):
            return {
                **default,
                "focus_area": "property underwriting, financing, and operational risk control",
                "objective_hint": "analyze cash flow, vacancy assumptions, and financing structure",
                "risk_focus": "overestimating rent, underestimating capex, and liquidity constraints",
                "scenario": "an investor evaluating a rental property acquisition",
                "pitfall": "buying on headline yield without stress-testing assumptions",
                "better_practice": "underwrite conservative scenarios and reserve capital for repairs/vacancy",
                "exercise_context": "a rental property investment decision",
                "good_decision": "Model net operating income conservatively and verify assumptions with market data.",
                "bad_decision_1": "Use optimistic rent assumptions without recent comparable evidence.",
                "bad_decision_2": "Ignore maintenance reserves because the property appears newly renovated.",
                "bad_decision_3": "Choose leverage based on maximum approval rather than risk tolerance.",
                "good_execution": "Track occupancy, repair costs, and debt service coverage against underwriting.",
                "bad_execution_1": "Delay maintenance to protect short-term cash flow.",
                "bad_execution_2": "Assume tenant quality is stable without screening and process controls.",
                "bad_execution_3": "Refinance repeatedly without testing rate and vacancy downside.",
            }
        if any(k in combined for k in ["crypto", "blockchain", "defi", "nft", "wallet"]):
            return {
                **default,
                "focus_area": "digital-asset risk management and protocol-level due diligence",
                "objective_hint": "understand custody, liquidity, and smart-contract exposure",
                "risk_focus": "counterparty risk, key loss, and protocol security failures",
                "scenario": "a user choosing between exchange custody and self-custody",
                "pitfall": "treating token narratives as substitutes for risk controls",
                "better_practice": "size positions carefully and protect keys/recovery processes",
                "exercise_context": "a crypto custody and risk decision",
                "good_decision": "Separate speculative capital from core savings and apply strict custody controls.",
                "bad_decision_1": "Store all assets on a single platform without contingency planning.",
                "bad_decision_2": "Approve unknown smart-contract permissions without reviewing exposure.",
                "bad_decision_3": "Assume high APY products are low risk because returns look consistent.",
                "good_execution": "Review wallet permissions, security practices, and concentration risk regularly.",
                "bad_execution_1": "Reuse weak passwords and skip two-factor authentication on key accounts.",
                "bad_execution_2": "Rotate capital quickly between protocols without checking liquidity depth.",
                "bad_execution_3": "Treat unrealized gains as spendable cash for recurring commitments.",
            }
        if any(k in combined for k in ["forex", "trading", "chart", "leverage", "pip"]):
            return {
                **default,
                "focus_area": "trade planning, position sizing, and risk discipline",
                "objective_hint": "define setup quality, invalidation, and reward-to-risk before entry",
                "risk_focus": "overleverage, emotional execution, and weak journaling",
                "scenario": "a trader evaluating whether to execute a setup under defined rules",
                "pitfall": "entering trades without predefined stop-loss and size rules",
                "better_practice": "use a written plan with position sizing tied to account risk",
                "exercise_context": "a forex trade execution decision",
                "good_decision": "Enter only when setup criteria are met and risk per trade is predefined.",
                "bad_decision_1": "Increase size after losses to recover quickly.",
                "bad_decision_2": "Move stop-loss farther away when price moves against the trade.",
                "bad_decision_3": "Trade every signal without checking market regime or spread conditions.",
                "good_execution": "Journal each trade and evaluate process adherence, not only P&L.",
                "bad_execution_1": "Skip post-trade review after profitable days.",
                "bad_execution_2": "Change strategy rules intraday based on frustration.",
                "bad_execution_3": "Ignore slippage and transaction costs in performance evaluation.",
            }
        return default

    def _build_professional_text_chunks(
        self, lesson_title: str, course_title: str, source_text: str, profile: dict[str, str]
    ) -> dict[str, str]:
        summary = Truncator(source_text).chars(320) if source_text else ""
        if not summary:
            summary = f"{lesson_title} develops practical understanding for {course_title}."

        overview = html_paragraphs(
            f"{lesson_title} focuses on {profile['focus_area']} and explains how to translate ideas into repeatable decisions. "
            f"In {course_title}, the goal is not only understanding terminology but applying it under realistic constraints.",
            f"Reference context for this lesson: {summary} "
            f"Use it to frame what decisions you are responsible for and what outcomes you are trying to improve.",
            f"A professional lens for this topic is to {profile['objective_hint']}. "
            f"This creates consistency and prevents reactive choices driven by noise or pressure.",
        )
        core = html_paragraphs(
            f"Work this lesson through a concrete scenario: {profile['scenario']}. "
            "Start by defining assumptions, then test whether the decision still holds when key variables move against you.",
            f"Primary risk in this domain: {profile['risk_focus']}. "
            f"A common failure pattern is {profile['pitfall']}.",
            f"Stronger practice is to {profile['better_practice']}. "
            "Documenting why a decision was made allows you to evaluate quality later and improve with evidence, not hindsight bias.",
        )
        video_intro = html_paragraphs(
            f"This video reinforces the lesson with examples connected to {course_title}.",
            "Watch for three things: the assumptions used, the risk controls applied, and the criteria used to decide whether to act or wait. "
            "Pause after key segments and check whether your interpretation matches the reasoning shown.",
        )
        applied = html_paragraphs(
            f"In applied work for {lesson_title}, evaluate alternatives against a fixed checklist: objective fit, downside exposure, and execution complexity. "
            f"This keeps analysis grounded in {profile['exercise_context']} rather than opinion.",
            "High-quality decisions are explicit about what could invalidate the original thesis. "
            "Define thresholds in advance so you know when to continue, adjust, or exit.",
            f"Most avoidable errors come from inconsistency between plan and execution. "
            f"Use post-decision review to confirm whether you followed process, not just whether the short-term outcome was positive.",
        )
        takeaways = html_paragraphs(
            f"Key takeaway: {lesson_title} becomes valuable when you pair technical understanding with disciplined execution.",
            f"Before moving on, verify you can explain the core concept, describe the main risk in this domain, and justify one decision using explicit assumptions.",
            f"As you continue in {course_title}, reuse this structure so each lesson builds professional judgment and reduces avoidable mistakes over time.",
        )
        return {
            "overview": overview,
            "core": core,
            "video_intro": video_intro,
            "applied": applied,
            "takeaways": takeaways,
        }

    def _build_exercise(
        self, lesson_title: str, source_html: str, variant: int, profile: dict[str, str]
    ) -> dict:
        source_text = normalize_whitespace(strip_tags(source_html))
        concise = Truncator(source_text).chars(140)
        if variant == 1:
            question = (
                f"When applying {lesson_title} to {profile['exercise_context']}, which choice best reflects professional decision quality "
                f"given this lesson context ({concise})?"
            )
            options = [
                profile["good_decision"],
                profile["bad_decision_1"],
                profile["bad_decision_2"],
                profile["bad_decision_3"],
            ]
            correct = 0
        else:
            question = (
                f"After implementing a decision in {lesson_title}, which follow-up behaviour best demonstrates disciplined execution "
                f"and long-term consistency ({concise})?"
            )
            options = [
                profile["good_execution"],
                profile["bad_execution_1"],
                profile["bad_execution_2"],
                profile["bad_execution_3"],
            ]
            correct = 0
        return {
            "question": question,
            "options": options,
            "correctAnswer": correct,
        }

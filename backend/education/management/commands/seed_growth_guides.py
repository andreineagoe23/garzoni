"""
Seed Phase 5 growth content — the missing SERP surfaces from the SXO audit.

Download-intent SERPs for "financial literacy app" queries are dominated by
best-of *roundups* and *alternatives* pages, not landing pages. Garzoni fielded
only a landing page (competing on 1 of 3 surfaces). This command adds:

  - G1: one "duolingo for finance" roundup (highest intent-fit, weak SERP today)
  - G2: two best-of roundup listicles (the missing dominant page type)
  - G3: three alternatives pages (decision-stage, correct competitor cohort)
  - G4: one segmented "for students" guide

All roundup/alternatives pages carry an ItemList of the apps (SoftwareApplication
entries) so they read as ranked comparisons to Google + AI crawlers.

Honesty guard rails (this is finance content compared against real third-party
apps we don't control):
  - Competitor descriptions are general and hedged; no invented pricing,
    feature lists, or URLs. Every page tells the reader to verify current
    details on each app's own site.
  - Garzoni is positioned honestly by its actual strength ("best for building
    the habit / learning the concepts"), never claimed to win categories it
    doesn't compete in (banking, brokerage, budgeting execution).

Author attribution is still "Garzoni Team" until Phase 4 E1 provides a real
named, credentialed author — roundups compete better with a byline, so revisit
`AUTHOR` once that lands.

Idempotent: re-running updates the existing article by slug.

    python manage.py seed_growth_guides --dry-run
    python manage.py seed_growth_guides            # create/update + publish
    python manage.py seed_growth_guides --draft    # create/update as drafts
"""

from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from education.models import Article, Lesson

# TODO(phase-4 E1): swap to a real named + credentialed author once provided.
AUTHOR = "Garzoni Team"

GARZONI_URL = "https://www.garzoni.app"

# Shared honesty disclaimer appended to every roundup/alternatives page. Apps
# change their features and pricing often, and we don't control the third-party
# products — so we date the review and push verification to the source.
VERIFY_NOTE = (
    "<p><em>App features and pricing change often. This roundup reflects each "
    "app's general positioning at the time of writing — always check the app's "
    "own website or store listing for current details before you sign up. "
    "Garzoni is an education platform and does not give regulated financial "
    "advice.</em></p>"
)


def _apps_table(rows):
    """rows: list of (app, best_for, price_note)."""
    body = "".join(
        f"<tr><td>{app}</td><td>{best_for}</td><td>{price}</td></tr>"
        for app, best_for, price in rows
    )
    return (
        "<table><thead><tr><th>App</th><th>Best for</th><th>Cost</th></tr>"
        f"</thead><tbody>{body}</tbody></table>"
    )


def _roundup(
    title,
    slug,
    category,
    meta,
    excerpt,
    intro,
    methodology,
    table_rows,
    entries,
    choose,
    faq,
    related,
    item_list,
):
    """Build a roundup / alternatives article from a structured spec.

    `entries` is a list of (app_name, html_paragraph) rendered as <h3> blocks.
    `item_list` feeds ItemList JSON-LD (name/url/description).
    """
    entry_html = "".join(f"<h3>{name}</h3>\n{para}" for name, para in entries)
    content = f"""
<p>{intro}</p>
<h2>How we picked</h2>
<p>{methodology}</p>
{_apps_table(table_rows)}
<h2>The apps, one by one</h2>
{entry_html}
<h2>How to choose</h2>
<p>{choose}</p>
{VERIFY_NOTE}
""".strip()
    return {
        "slug": slug,
        "title": title,
        "category": category,
        "meta_description": meta,
        "excerpt": excerpt,
        "faq": faq,
        "item_list": item_list,
        "related": related,
        "content": content,
    }


def _guide(title, slug, meta, excerpt, content, faq, related, category="guide"):
    return {
        "slug": slug,
        "title": title,
        "category": category,
        "meta_description": meta,
        "excerpt": excerpt,
        "faq": faq,
        "item_list": None,
        "related": related,
        "content": content.strip(),
    }


# ---------------------------------------------------------------------------
# G1 — Own "duolingo for finance" (highest intent-fit, weakest competition)
# ---------------------------------------------------------------------------

DUOLINGO_FOR_MONEY = _roundup(
    'The Best "Duolingo for Finance" Apps in 2026',
    "duolingo-for-money-best-apps",
    "roundup",
    'The best "Duolingo for finance" apps in 2026: gamified, bite-sized money '
    "learning compared — Fingo, Zogo, Money Masters, Seed, and Garzoni.",
    'The apps people mean when they search "Duolingo for finance" — gamified, '
    "bite-sized money learning, compared honestly.",
    '"Duolingo for finance" describes a small category of apps that teach money '
    "the way Duolingo teaches languages: short daily lessons, streaks, quizzes, "
    "and gamification instead of dense articles or spreadsheets. If that's what "
    "you're after, these are the apps worth knowing — and how they actually "
    "differ.",
    "We looked for apps that genuinely teach personal-finance <em>concepts</em> "
    "(not budgeting trackers or banking apps), use short lessons and habit "
    "mechanics like streaks or points, and are available to individual learners. "
    "We ranked by how well each one builds durable understanding and a daily "
    "habit — the two things the Duolingo model is actually good at.",
    [
        ("Garzoni", "Depth + a daily habit, with an AI coach", "Free to start"),
        ("Zogo", "Points-for-rewards, bank-distributed", "Free (often via a bank)"),
        ("Fingo", "Gamified bite-sized finance", "Check app"),
        ("Money Masters", "Gamified financial education", "Check app"),
        ("Seed", "Habit-building around money/investing", "Check app"),
    ],
    [
        (
            "Garzoni — best for actually understanding money",
            "<p>Garzoni is a personal-finance education app built on the "
            "language-learning model: a personalised path of ten-minute lessons, "
            "quizzes, daily streaks, and spaced repetition so concepts stick, "
            "plus an AI coach that answers questions the moment they come up. Its "
            "strength is <strong>depth with a habit</strong> — it's built to take "
            'you from "I don\'t get money" to genuine confidence, not just to '
            "nudge you. It's free to start, on the web and iOS, and it doesn't "
            "hold your money or sell products. If your goal is to <em>learn</em>, "
            "start here.</p>",
        ),
        (
            "Zogo",
            "<p>Zogo is known for bite-sized financial-literacy modules and a "
            "points-for-rewards model, and it's often distributed through banks "
            "and credit unions. If your bank offers it and reward points motivate "
            "you, it's an easy, free way to pick up the basics. The trade-off is "
            "breadth over depth, and availability can depend on your bank.</p>",
        ),
        (
            "Fingo",
            "<p>Fingo positions itself as a gamified, bite-sized way to learn "
            "money, leaning hard on the Duolingo-style format. It's a reasonable "
            "pick if streaks and short daily reps are what keep you coming back. "
            "Check its current lesson library and pricing on its own site, as "
            "coverage varies.</p>",
        ),
        (
            "Money Masters",
            "<p>Money Masters is a gamified financial-education app aimed at "
            "making money lessons approachable and fun. Like the others here it "
            "trades depth for accessibility; it's worth a look if the format "
            "clicks for you. Verify its current content and cost before "
            "committing.</p>",
        ),
        (
            "Seed",
            '<p>"Seed" is used by a few different money apps, generally around '
            "building better money or investing habits through small, repeatable "
            "actions. Because the name is shared, confirm you're looking at the "
            "specific app you mean, and check what it actually teaches versus what "
            "it automates.</p>",
        ),
    ],
    "If you want the closest thing to Duolingo for money — a coherent path that "
    "builds real understanding and a daily habit, with a coach when you're stuck "
    "— Garzoni is designed for exactly that. If you mostly want quick, "
    "reward-driven reps and your bank offers it, Zogo is an easy free start. The "
    "others are worth trying if their specific format motivates you; just verify "
    "current features first.",
    [
        {
            "question": 'What is the "Duolingo for finance"?',
            "answer": "It's shorthand for money apps that teach personal finance "
            "the way Duolingo teaches languages — short daily lessons, streaks, "
            "quizzes, and gamification. Garzoni, Zogo, Fingo, Money Masters, and "
            "some apps called Seed all fit the description to different degrees.",
        },
        {
            "question": "Which one is free?",
            "answer": "Garzoni is free to start (no payment card for the Starter "
            "plan) and free to read on the web. Zogo is typically free, often "
            "through a bank. Check the others' current pricing on their own "
            "listings.",
        },
        {
            "question": "Do these apps give financial advice?",
            "answer": "No. These are education apps — they teach concepts and "
            "habits. For regulated, personalised advice (pensions, tax, large "
            "investments), speak to a qualified professional.",
        },
    ],
    ["beliefs-that-shape-financial-behavior", "how-compound-interest-works"],
    [
        {
            "name": "Garzoni",
            "url": GARZONI_URL,
            "description": "Personal-finance education app — lessons, streaks, "
            "spaced repetition, and an AI coach. Best for building real "
            "understanding and a daily habit. Free to start.",
        },
        {
            "name": "Zogo",
            "description": "Bite-sized financial-literacy modules with a "
            "points-for-rewards model, often distributed through banks.",
        },
        {
            "name": "Fingo",
            "description": "Gamified, bite-sized money learning in a " "Duolingo-style format.",
        },
        {
            "name": "Money Masters",
            "description": "Gamified financial-education app focused on making "
            "money lessons approachable.",
        },
        {
            "name": "Seed",
            "description": "Money/investing habit-building app (name shared by a "
            "few products — confirm which one you mean).",
        },
    ],
)


# ---------------------------------------------------------------------------
# G2 — Best-of roundup listicles (the missing dominant page type)
# ---------------------------------------------------------------------------

BEST_FINLIT_APPS = _roundup(
    "Best Financial Literacy Apps in 2026",
    "best-financial-literacy-apps",
    "roundup",
    "The best financial literacy apps in 2026 compared: Garzoni, Zogo, Fingo, "
    "Money Masters, and more — what each teaches, who it's for, and what it costs.",
    "The best apps for actually learning money in 2026 — honest picks for "
    "different goals, from bite-sized reps to real depth.",
    "A financial-literacy app teaches you how money works — budgeting, saving, "
    "credit, debt, and investing — rather than just tracking your spending. The "
    "best one for you depends on whether you want quick reps, reward points, or "
    "genuine, durable understanding. Here are the apps worth your time and what "
    "each is actually best at.",
    "We only included apps whose core job is <em>teaching</em> personal finance "
    "(not banking or budgeting trackers), that individual learners can use "
    "directly, and that use proven learning mechanics — short lessons, quizzes, "
    "repetition, or gamification. We rank by depth of learning and how well each "
    "builds a lasting habit, then note where each is the honest best pick.",
    [
        ("Garzoni", "Depth + habit, with an AI coach", "Free to start"),
        ("Zogo", "Reward points, quick basics", "Free (often via a bank)"),
        ("Fingo", "Gamified daily reps", "Check app"),
        ("Money Masters", "Fun, approachable basics", "Check app"),
    ],
    [
        (
            "Garzoni — best overall for building real understanding",
            "<p>Garzoni pairs a structured, personalised learning path with a "
            "daily habit loop: ten-minute lessons, quizzes, streaks, spaced "
            "repetition, and an AI coach. It's built to actually take you from "
            "beginner to confident — UK-relevant topics (ISAs, credit scores, "
            "National Insurance) included — and it's free to start on web and "
            "iOS. Best for anyone who wants the concepts to <em>stick</em>, not "
            "just a daily streak.</p>",
        ),
        (
            "Zogo — best for reward-driven quick basics",
            "<p>Zogo's short modules and points-for-rewards model make it an easy, "
            "free way to cover the fundamentals, and it's widely available "
            "through banks and credit unions. Great if extrinsic rewards keep you "
            "going; less suited to building deep understanding.</p>",
        ),
        (
            "Fingo — best if streaks are what motivate you",
            "<p>Fingo leans into the gamified, bite-sized, Duolingo-style format. "
            "If daily streaks and tiny reps are what get you to show up, it's "
            "worth a try. Confirm its current lesson coverage and pricing on its "
            "own site.</p>",
        ),
        (
            "Money Masters — best for a fun, low-pressure start",
            "<p>Money Masters focuses on making money lessons approachable and "
            "game-like. A gentle on-ramp if dense finance content puts you off; "
            "check its current content depth and cost before you rely on it.</p>",
        ),
    ],
    "Pick Garzoni if you want to genuinely understand money and keep a habit "
    "going — it's the most complete learning experience here and free to start. "
    "Pick Zogo for reward-driven basics, especially if your bank offers it. Try "
    "Fingo or Money Masters if their gamified format is what makes you show up. "
    "There's no harm in starting with two and keeping the one you actually open.",
    [
        {
            "question": "What is the best financial literacy app?",
            "answer": "For building real, lasting understanding with a daily "
            "habit, Garzoni is the strongest pick — structured lessons, spaced "
            "repetition, and an AI coach, free to start. For quick, "
            "reward-driven basics, Zogo is a solid free option, often through a "
            "bank.",
        },
        {
            "question": "Are financial literacy apps free?",
            "answer": "Many have a free tier. Garzoni is free to start with no "
            "payment card and free to read on the web; Zogo is typically free. "
            "Check current pricing for each app before signing up.",
        },
        {
            "question": "Do these apps replace a financial adviser?",
            "answer": "No. They teach you the concepts so you can make better "
            "decisions and have better conversations. For regulated, personalised "
            "advice, see a qualified professional.",
        },
    ],
    ["tracking-income-and-expenses", "how-compound-interest-works"],
    [
        {
            "name": "Garzoni",
            "url": GARZONI_URL,
            "description": "Best overall for building real understanding and a "
            "daily habit — lessons, spaced repetition, and an AI coach. Free to "
            "start.",
        },
        {
            "name": "Zogo",
            "description": "Reward-points financial-literacy modules, often via a "
            "bank. Best for quick basics.",
        },
        {
            "name": "Fingo",
            "description": "Gamified, streak-driven bite-sized finance lessons.",
        },
        {
            "name": "Money Masters",
            "description": "Approachable, game-like financial-education app for a "
            "low-pressure start.",
        },
    ],
)


BEST_BUDGETING_BEGINNERS = _roundup(
    "Best Budgeting Apps for Beginners in 2026",
    "best-budgeting-apps-for-beginners",
    "roundup",
    "Best budgeting apps for beginners in 2026 — plus why learning the skill "
    "first (with Garzoni) makes any budgeting app work far better.",
    "The beginner-friendly budgeting apps worth trying — and the one thing that "
    "makes all of them work better.",
    "Budgeting apps help you see where your money goes and keep spending on "
    "track. But the honest truth is that a budgeting app only works if you "
    "understand the <em>skill</em> underneath it — needs vs wants, paying "
    "yourself first, and picking a method you'll stick to. Here are beginner-"
    "friendly budgeting tools, and how to get more out of whichever you choose.",
    "For the budgeting tools, we favoured beginner-friendly setup, clear "
    "spending views, and gentle nudges over power-user complexity. We include "
    "one learning-first pick (Garzoni) because the SXO reality is that people "
    "who learn the concepts first stick with a budget far longer — the tool is "
    "only half the job.",
    [
        ("Garzoni", "Learning the skill behind budgeting", "Free to start"),
        ("YNAB", "Hands-on zero-based budgeting", "Paid subscription"),
        ("Monzo", "UK bank with built-in budgeting", "Free account + paid tiers"),
        ("Cleo", "AI chat + spending nudges", "Free + paid tiers"),
    ],
    [
        (
            "Garzoni — learn the skill first (free)",
            "<p>Garzoni isn't a budgeting tracker; it <strong>teaches you how to "
            "budget</strong> — needs vs wants, the 50/30/20 method, paying "
            "yourself first — through short lessons, quizzes, and an AI coach. "
            "Beginners who understand the concepts abandon budgets far less "
            "often. Start free here, then run your budget in whichever app you "
            "like. It pairs with, rather than replaces, the tools below.</p>",
        ),
        (
            "YNAB — best for hands-on budgeters",
            "<p>YNAB (You Need A Budget) is built around zero-based budgeting — "
            "giving every pound a job. It's powerful and has a devoted following, "
            "but it's a paid subscription and has a learning curve. It clicks "
            "fastest once the underlying concepts already make sense.</p>",
        ),
        (
            "Monzo — best if you want budgeting inside your bank (UK)",
            "<p>Monzo is a UK digital bank with budgeting Pots, instant spending "
            "notifications, and summaries baked into the account. If you'd rather "
            "budget where your money already lives, it's a natural fit. It's a "
            "bank, though — it shows your spending; it doesn't teach the "
            "decisions.</p>",
        ),
        (
            "Cleo — best for chat-style nudges",
            "<p>Cleo is an AI chatbot that tracks spending and nudges you about "
            "your balance. It's approachable and good for day-to-day awareness. "
            "Treat the nudges as reminders, not a substitute for understanding "
            "why the numbers move.</p>",
        ),
    ],
    "If you're brand new, spend a week learning the skill with Garzoni (free) so "
    "you know what a good budget looks like, then pick a tool: YNAB for "
    "hands-on, method-driven budgeting; Monzo if you're in the UK and want it "
    "inside your bank; Cleo for light, chat-style nudges. The learning is what "
    "makes any of them stick.",
    [
        {
            "question": "What's the best budgeting app for beginners?",
            "answer": "For hands-on budgeting, YNAB is a strong (paid) choice, and "
            "Monzo works well for UK users who want it inside their bank. But the "
            "highest-impact first step for a beginner is learning the skill — "
            "Garzoni teaches budgeting free, which makes any of those tools work "
            "far better.",
        },
        {
            "question": "Should I learn budgeting or just use an app?",
            "answer": "Both — but learning first pays off. People who understand "
            "needs vs wants, 50/30/20, and paying themselves first stick with a "
            "budget much longer. An app tracks the numbers; the skill keeps you "
            "going.",
        },
        {
            "question": "Is there a free budgeting option?",
            "answer": "Yes. Garzoni is free to start and teaches the skill; many "
            "bank apps (like Monzo) include free budgeting features; and Cleo has "
            "a free tier. Check each app's current pricing.",
        },
    ],
    ["tracking-income-and-expenses", "conducting-an-annual-financial-review"],
    [
        {
            "name": "Garzoni",
            "url": GARZONI_URL,
            "description": "Teaches the budgeting skill itself — free lessons, "
            "quizzes, and an AI coach. The first step that makes any budgeting "
            "app stick.",
        },
        {
            "name": "YNAB",
            "description": "Zero-based budgeting app for hands-on budgeters. Paid " "subscription.",
        },
        {
            "name": "Monzo",
            "description": "UK digital bank with budgeting Pots, alerts, and "
            "spending summaries.",
        },
        {
            "name": "Cleo",
            "description": "AI budgeting chatbot with spending nudges. Free + paid " "tiers.",
        },
    ],
)


# ---------------------------------------------------------------------------
# G3 — Alternatives pages (decision-stage, correct competitor cohort)
# ---------------------------------------------------------------------------


def _alternatives_page(app, slug, meta, excerpt, intro, entries, choose, faq, related, item_list):
    """Alternatives page: same shape as a roundup but framed as 'X alternatives'."""
    entry_html = "".join(f"<h3>{name}</h3>\n{para}" for name, para in entries)
    content = f"""
<p>{intro}</p>
<h2>The best {app} alternatives</h2>
{entry_html}
<h2>How to choose an alternative</h2>
<p>{choose}</p>
{VERIFY_NOTE}
""".strip()
    return {
        "slug": slug,
        "title": f"The Best {app} Alternatives in 2026",
        "category": "alternatives",
        "meta_description": meta,
        "excerpt": excerpt,
        "faq": faq,
        "item_list": item_list,
        "related": related,
        "content": content,
    }


ZOGO_ALTS = _alternatives_page(
    "Zogo",
    "zogo-alternatives",
    "The best Zogo alternatives in 2026: apps to learn financial literacy if "
    "you want more depth, an AI coach, or access without a bank partnership.",
    "Looking for a Zogo alternative? Here are the best apps to learn money — "
    "with more depth or without needing a partner bank.",
    "Zogo is a popular financial-literacy app known for bite-sized modules and "
    "reward points, often offered through banks. People look for alternatives "
    "when they want <em>more depth</em>, an AI coach, or simply an app they can "
    "use directly without their bank partnering with it. These are the best "
    "options.",
    [
        (
            "Garzoni — best for depth and a real habit",
            "<p>Garzoni is the closest alternative for anyone who liked learning "
            "money in an app but wants it to go further. Instead of short modules "
            "for points, it offers a structured path, spaced repetition so "
            "knowledge sticks, and an AI coach — available directly to anyone, no "
            "bank partnership needed, free to start. Best pick if you want to "
            "genuinely understand money, not just collect rewards.</p>",
        ),
        (
            "Fingo",
            "<p>Fingo is another gamified, bite-sized option in the "
            "Duolingo-style mould. If Zogo's format worked for you but you want a "
            "different app, it's a reasonable like-for-like try. Check its "
            "current content and pricing.</p>",
        ),
        (
            "Money Masters",
            "<p>Money Masters offers approachable, game-like financial education. "
            "Similar accessibility to Zogo with a different feel; verify current "
            "coverage before relying on it.</p>",
        ),
    ],
    "If you outgrew Zogo's short modules, Garzoni is the natural step up in "
    "depth — and you don't need a partner bank to use it. If you just want a "
    "different bite-sized app in the same style, Fingo or Money Masters are "
    "worth a look. Match the app to whether you want rewards, depth, or a daily "
    "habit.",
    [
        {
            "question": "What is the best Zogo alternative?",
            "answer": "For more depth and a lasting habit, Garzoni is the "
            "strongest alternative — structured lessons, spaced repetition, and "
            "an AI coach, usable directly without a bank, free to start. For a "
            "similar bite-sized style, Fingo and Money Masters are options.",
        },
        {
            "question": "Is there a Zogo alternative without a bank?",
            "answer": "Yes. Garzoni is available directly to any learner with no "
            "bank partnership required, and it's free to start.",
        },
    ],
    ["scarcity-vs-abundance-thinking", "how-compound-interest-works"],
    [
        {
            "name": "Garzoni",
            "url": GARZONI_URL,
            "description": "Depth-first money learning with spaced repetition and "
            "an AI coach, usable without a bank. Best Zogo alternative for "
            "understanding, not just points.",
        },
        {
            "name": "Fingo",
            "description": "Gamified bite-sized finance lessons in a similar style " "to Zogo.",
        },
        {
            "name": "Money Masters",
            "description": "Approachable, game-like financial-education app.",
        },
    ],
)


MONEY_MASTERS_ALTS = _alternatives_page(
    "Money Masters",
    "money-masters-alternatives",
    "The best Money Masters alternatives in 2026: financial-education apps with "
    "more depth, spaced repetition, and an AI coach.",
    "Best Money Masters alternatives — apps to learn money with more depth and "
    "a stronger habit loop.",
    "Money Masters is a gamified financial-education app that makes money "
    "lessons approachable. If you want an alternative — more depth, a coherent "
    "learning path, or an AI coach — these apps cover the same goal of learning "
    "personal finance, with different strengths.",
    [
        (
            "Garzoni — best for a structured, lasting learning path",
            "<p>Garzoni offers a personalised path of short lessons with quizzes, "
            "streaks, spaced repetition, and an AI coach — built so the concepts "
            "actually stick rather than fade after a fun session. UK-relevant, "
            "free to start on web and iOS. The best pick if you want depth and a "
            "durable habit.</p>",
        ),
        (
            "Zogo",
            "<p>Zogo's bite-sized modules and reward points are a solid, free "
            "alternative, frequently available through banks. Good for quick "
            "basics driven by rewards.</p>",
        ),
        (
            "Fingo",
            "<p>Fingo is a gamified, streak-driven finance-learning app in the "
            "Duolingo mould — a like-for-like alternative if you want to keep the "
            "game-like format. Confirm current features and pricing.</p>",
        ),
    ],
    "Choose Garzoni if you want the lessons to add up to real understanding and "
    "a habit that lasts; choose Zogo for reward-driven quick basics; choose "
    "Fingo if a streak-first game loop is what keeps you engaged.",
    [
        {
            "question": "What is the best Money Masters alternative?",
            "answer": "Garzoni is the strongest alternative for depth and a "
            "lasting habit — structured lessons, spaced repetition, and an AI "
            "coach, free to start. Zogo and Fingo are good bite-sized "
            "alternatives.",
        },
        {
            "question": "Are there free Money Masters alternatives?",
            "answer": "Yes. Garzoni is free to start, and Zogo is typically free "
            "(often through a bank). Check current pricing for each.",
        },
    ],
    ["beliefs-that-shape-financial-behavior", "learning-from-financial-mistakes"],
    [
        {
            "name": "Garzoni",
            "url": GARZONI_URL,
            "description": "Structured, lasting money-learning path with spaced "
            "repetition and an AI coach. Best Money Masters alternative for "
            "depth.",
        },
        {
            "name": "Zogo",
            "description": "Reward-points, bite-sized financial-literacy modules, "
            "often via a bank.",
        },
        {
            "name": "Fingo",
            "description": "Gamified, streak-driven bite-sized finance lessons.",
        },
    ],
)


FINGO_ALTS = _alternatives_page(
    "Fingo",
    "fingo-alternatives",
    "The best Fingo alternatives in 2026: Duolingo-style money apps with more "
    "depth, an AI coach, and UK-relevant content.",
    "Best Fingo alternatives — money-learning apps with the same daily-habit "
    "feel but more depth.",
    "Fingo is a gamified, Duolingo-style app for learning money in bite-sized "
    "reps. If you want an alternative with more depth, a clearer learning path, "
    "or an AI coach — while keeping that daily-habit feel — these are the best "
    "options.",
    [
        (
            "Garzoni — best for depth without losing the habit",
            "<p>Garzoni keeps the daily-habit mechanics you like about Fingo — "
            "streaks, short lessons, quizzes — but builds them into a structured "
            "path with spaced repetition and an AI coach, so you come away "
            "actually understanding budgeting, saving, credit, and investing. "
            "UK-relevant and free to start. Best if you want reps <em>and</em> "
            "real understanding.</p>",
        ),
        (
            "Zogo",
            "<p>Zogo is a free, bite-sized, reward-driven alternative, often "
            "available through banks. A close match if you want short modules and "
            "points.</p>",
        ),
        (
            "Money Masters",
            "<p>Money Masters offers approachable, game-like financial education "
            "— another like-for-like option in the gamified space. Verify current "
            "content and cost.</p>",
        ),
    ],
    "If Fingo's daily reps worked but you want the learning to go deeper, "
    "Garzoni is the natural step up. If you want to stay in the same "
    "reward-driven, bite-sized lane, Zogo and Money Masters are the closest "
    "alternatives.",
    [
        {
            "question": "What is the best Fingo alternative?",
            "answer": "Garzoni is the strongest alternative for depth while "
            "keeping a daily habit — structured lessons, spaced repetition, and "
            "an AI coach, free to start. Zogo and Money Masters are close "
            "bite-sized alternatives.",
        },
        {
            "question": "Is there a Fingo alternative with UK content?",
            "answer": "Yes. Garzoni is built for UK users with content in pounds "
            "and UK-specific topics like ISAs, credit scores, and National "
            "Insurance.",
        },
    ],
    ["how-compound-interest-works", "tracking-income-and-expenses"],
    [
        {
            "name": "Garzoni",
            "url": GARZONI_URL,
            "description": "Daily-habit money learning with real depth — spaced "
            "repetition and an AI coach, UK-relevant. Best Fingo alternative.",
        },
        {
            "name": "Zogo",
            "description": "Free, reward-driven bite-sized financial-literacy "
            "modules, often via a bank.",
        },
        {
            "name": "Money Masters",
            "description": "Approachable, game-like financial-education app.",
        },
    ],
)


# ---------------------------------------------------------------------------
# G4 — Segmented landing content ("for students")
# ---------------------------------------------------------------------------

FOR_STUDENTS = _guide(
    "The Best Money App for Students (and How to Actually Learn Finance at Uni)",
    "best-money-app-for-students",
    "The best money app for students in 2026: learn budgeting, student loans, "
    "and saving on a tight budget — free, jargon-free, built for 16+ and young "
    "adults.",
    "Skint, busy, and never taught money at school? Here's how students can "
    "actually learn personal finance — and the free app built for it.",
    """
<p><strong>The best money app for a student is one that teaches you the skills
cheaply and quickly — budgeting on an irregular income, understanding student
loans, and saving small amounts — without needing a payment card to start.</strong>
Garzoni is built for exactly this: free, jargon-free, ten-minute lessons made
for 16+ and young adults who were never taught money at school.</p>
<h2>Why students need learning, not just a tracker</h2>
<p>Student life is the hardest budgeting situation there is: lumpy income
(loan drops, part-time shifts, the odd bit from family), tight months, and
decisions — overdrafts, credit cards, first loans — that follow you for years.
A tracker shows the damage after the fact. Learning the skill first means you
avoid the expensive mistakes in the first place.</p>
<h2>What to learn first as a student</h2>
<ul>
<li><strong>Budgeting an irregular income</strong> — average your income across
the term and set a weekly spend, so a loan drop doesn't vanish in week two.</li>
<li><strong>Student loans</strong> — how repayment actually works (you repay a
share of income above a threshold, not a fixed bill), so you don't panic or
overpay unnecessarily.</li>
<li><strong>Overdrafts and credit</strong> — the difference between a 0%
student overdraft and expensive credit, and how your first borrowing shapes
your credit score.</li>
<li><strong>Saving tiny amounts</strong> — why £10 a week and an emergency
buffer beat waiting until you "earn properly".</li>
</ul>
<h2>What makes Garzoni suited to students</h2>
<p>It's free to start with no payment card, lessons take about ten minutes so
they fit between seminars, and the content is UK-relevant (student loans, ISAs,
credit scores) and written for young adults — plain English, no finance-bro
jargon. Streaks and an AI coach keep it going when deadlines don't.</p>
<h2>A note on age</h2>
<p>Garzoni is built for 16+ and young adults managing real money decisions —
university, first jobs, first accounts. It's not a kids' app; it's for the point
where the decisions start to count.</p>
<h2>Start free</h2>
<p>Read the free lessons at /learn, or create a free account for the full path,
quizzes, streaks, and AI coach. No card required for the Starter plan.</p>
""",
    [
        {
            "question": "What is the best money app for students?",
            "answer": "One that teaches the skills for free and fits a busy "
            "schedule. Garzoni is built for students and young adults — free to "
            "start with no payment card, ten-minute UK-relevant lessons on "
            "budgeting, student loans, and saving.",
        },
        {
            "question": "Is Garzoni free for students?",
            "answer": "Yes. The Starter plan is free with no payment card, and "
            "the lessons and guides are free to read on the web without an "
            "account.",
        },
        {
            "question": "How do student loan repayments work?",
            "answer": "In the UK you typically repay a percentage of income above "
            "a threshold, not a fixed monthly bill, and the balance can be "
            "written off after a set period — which is why understanding it "
            "beats panicking about the headline number. Garzoni's lessons cover "
            "the basics.",
        },
    ],
    ["current-vs-savings-accounts", "tracking-income-and-expenses"],
    category="guide",
)


ARTICLES = [
    DUOLINGO_FOR_MONEY,
    BEST_FINLIT_APPS,
    BEST_BUDGETING_BEGINNERS,
    ZOGO_ALTS,
    MONEY_MASTERS_ALTS,
    FINGO_ALTS,
    FOR_STUDENTS,
]


class Command(BaseCommand):
    help = "Seed Phase 5 growth content (roundups, alternatives, student guide)."

    def add_arguments(self, parser):
        parser.add_argument("--dry-run", action="store_true")
        parser.add_argument(
            "--draft",
            action="store_true",
            help="Create/update articles as unpublished drafts instead of publishing.",
        )

    def handle(self, *args, **options):
        dry_run = options["dry_run"]
        publish = not options["draft"]

        created = 0
        updated = 0

        with transaction.atomic():
            for spec in ARTICLES:
                related_slugs = spec.pop("related", [])
                defaults = {
                    "title": spec["title"],
                    "category": spec["category"],
                    "meta_description": spec["meta_description"],
                    "excerpt": spec["excerpt"],
                    "content": spec["content"],
                    "author": AUTHOR,
                    "faq": spec["faq"],
                    "item_list": spec["item_list"],
                    "is_published": publish,
                }
                if publish:
                    defaults["published_at"] = timezone.now()

                obj = Article.objects.filter(slug=spec["slug"]).first()
                if obj:
                    for k, v in defaults.items():
                        # Don't stomp an existing publish timestamp.
                        if k == "published_at" and obj.published_at:
                            continue
                        setattr(obj, k, v)
                    if not dry_run:
                        obj.save()
                    updated += 1
                    action = "update"
                else:
                    obj = Article(slug=spec["slug"], **defaults)
                    if not dry_run:
                        obj.save()
                    created += 1
                    action = "create"

                if not dry_run and related_slugs:
                    lessons = Lesson.objects.filter(slug__in=related_slugs, is_public=True)
                    obj.related_lessons.set(lessons)

                self.stdout.write(f"  [{action}] {spec['category']}: {spec['slug']}")

            if dry_run:
                transaction.set_rollback(True)

        state = "draft" if options["draft"] else "published"
        self.stdout.write(
            self.style.SUCCESS(
                f"{'Would seed' if dry_run else 'Seeded'} {len(ARTICLES)} growth "
                f"articles ({created} new, {updated} updated) as {state}."
            )
        )

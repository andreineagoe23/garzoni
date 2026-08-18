# ASO copy pack — 1.1.5 (paste-ready)

> **NOTE 2026-08-18:** written for 1.1.5; `mobile/app.json` is now on **1.1.8** and the newest
> runbook is `docs/release/1.1.7-runbook.md`. Copy is still the most current of the three store-copy
> packs, but re-check version-specific claims before pasting.

Single source of truth for store metadata at the 1.1.5 release. Everything here
is pasted into **App Store Connect** and **Play Console** (manual — not in the
repo). Character counts verified against store limits.

Status when written:

- iOS 1.1.5 (build 5) uploaded, processing / in review.
- Play production release submitted; **listing still returns 404** (Google review
  pending). Do NOT publish Play links on the web until it returns 200.
- **No "first month free" offer** — pulled for now. Copy below is offer-free.

---

## 1. Canonical name (make both stores match)

| Surface                | Value                        | Notes                                                     |
| ---------------------- | ---------------------------- | --------------------------------------------------------- |
| iOS store title        | `Garzoni - Personal Finance` | 26/30 — already live, keep                                |
| Play store title       | `Garzoni - Personal Finance` | 26/30 — align to iOS (was "Master Your Money")            |
| Home-screen icon label | `Garzoni`                    | `mobile/app.json` `name` — keep short, NOT the store name |

> Keyword-forward Play alternative (breaks cross-store consistency, +Play search):
> `Garzoni: Learn Money & Finance` (30). Test later via a Play Store Listing
> Experiment; ship matched names first.

**Where to change (no rebuild needed):**

- iOS: App Store Connect → app → **App Information** (name) + version localization
  (subtitle / description / promo text).
- Play: Play Console → **Grow → Store presence → Main store listing**.

---

## 2. English copy (both stores)

**iOS subtitle** (30): `Budget, Invest & Build Wealth` (29) — live, keep.

**Play short description** (80, indexed):

```
Learn budgeting, investing & money skills in 5-min lessons. Build real wealth.
```

**Full description** (offer-free; Play indexes this, iOS does not):

```
Master your money in just 5 minutes a day. Garzoni turns budgeting, investing, real estate, and crypto into 500+ bite-sized lessons you'll actually finish. No jargon, no overwhelm — just clear steps that build real financial confidence.

WHY GARZONI
• 500+ short lessons — from your first budget to your first stock
• The Climb — a personalised, step-by-step finance journey built around your goals
• Learn by doing — interactive exercises and budget simulations
• 24/7 AI tutor — ask anything, get a plain-English answer instantly
• Stay motivated — XP, coins, missions, streaks and a global leaderboard

REAL TOOLS, NOT JUST THEORY
• Portfolio Analyzer — see how your investments really perform
• Savings Simulator — watch small habits grow over time
• Market Explorer — understand stocks, funds and crypto at a glance

BUILD THE HABIT
Daily reminders and streak alerts keep your 5-minute lesson on track. Refer a friend and you both get rewarded.

Start free today. Master your money, one lesson at a time.
```

**iOS promotional text** (170, editable anytime with no review — no offer):

```
New in 1.1.5 — daily Missions turn learning into a game and keep your streak alive. Master budgeting, investing and saving in just 5 minutes a day.
```

(146 chars)

**English keyword field** (iOS, 100 bytes, hidden, comma no-space, no title/subtitle repeats):

```
financialliteracy,money,budgeting,invest,savings,debt,credit,wealth,learn,finance
```

---

## 3. "What's New" — 1.1.5 (both stores)

```
New in 1.1.5:
• Missions — fresh daily and weekly challenges that turn learning into a game and keep your streak alive.
• Smoother AI Voice Tutor with more reliable playback.
• Sharper Personal CFO and Next Steps recommendations.
• Faster lessons, refined visuals, and bug fixes across the app.

Thanks for learning with Garzoni. Keep climbing!
```

Verified against commit history `1567b93d..HEAD` (release 1.1.4 → 1.1.5):
Missions UI + backend, voice-chat/audioPlayback fixes, CFO/Next-Steps polish,
in-app review prompt, Customer.io push nudges, analytics + lesson-flow polish.

---

## 4. Market focus — UK / English (en-GB)

Focus on the UK market for now. **Romanian localization is deferred** (RO copy
was drafted but is out of scope until UK is dialled in — revisit later).

UK hygiene:

- Use **UK spelling** across all copy: "personalised", "favourite", "optimise".
  (Applied above — e.g. "personalised" in the full description.)
- Primary storefront: **United Kingdom**; App Store localization = **English (UK)**.
- Optional UK-relevant keyword swap in the iOS keyword field (100 bytes) — trade a
  generic term for a UK finance term if you want UK-search lift:
  `isa` or `pension` (e.g. drop `learn` → add `isa`). Test, don't assume.

---

## 5. Score-raising priorities (55/100 → target 75+)

Ordered by impact. Code levers are few — most gains are metadata + assets.

1. **Ratings volume (3/10, 20% weight)** — #1 blocker. NOT a copy fix; needs time
   - prompts landing. Keep `MIN_POSITIVE_EVENTS = 1` (raising it cuts volume; the
     sentiment gate already protects the 5.0★). Known leak: tapping "positive" marks
     the user reviewed forever even if Apple's sheet never showed — product call
     whether to re-prompt. `reviewPrompt.ts`.
2. **Screenshots + preview video (Visual 4/10, 25% weight)** — biggest single
   score lever. First 3 screenshots do 90% of the work; captions must be
   high-contrast (current dark-on-dark serif is illegible at thumbnail). Add a
   15–30s iOS preview video (+20–40% conversion). Design work, not code.
3. **UK keyword field tune** (§4) — cheap, editable anytime.
4. **Declare Accessibility** features (App Store Connect — currently "Not yet
   indicated").
5. **Custom Product Pages** (up to 70, in organic search) — one per persona
   ("learn investing", "budgeting for beginners", "duolingo for finance").

---

## 6. Do NOT do until Play listing returns 200

- Play badge on web (`/`, `/marketing`), Play URL in schema, re-enable Play link
  in `404.html`.
- Watch Android Vitals (crash < 1.09%, ANR < 0.47%) in Sentry `garzoni-android`.

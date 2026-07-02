# Phase 2 — ready-to-paste ASO copy pack

Companion to [phase-2-app-stores-aso.md](./phase-2-app-stores-aso.md). Everything
here is copy/metadata to paste into **App Store Connect** and **Play Console** —
these can't be done from the repo. Character counts verified against store limits.

Status of the in-repo Phase 2 items (already shipped):
- Website hero stat `4.9★` → `5.0★` (matches the real App Store rating of 5.0).
- Website `Beta users` → `Learners`; testimonial `Beta user, Paris` → `Early user, Paris`.
- No user-facing Google Play links exist in the web app yet (nothing to gate); the
  static 404 page links only the App Store until Android is public.
- Review prompt now hard-capped at **3 prompts / rolling 365 days** (Apple parity).

---

## Google Play listing (A1) — paste when the closed-testing track clears

> Personal Google Play dev accounts need 12+ testers opted in for **14 continuous
> days** before production. You're at ~13/14 — keep testers opted in; do not remove
> anyone or the clock may reset.

**App title** (30 char max) — pick one:
- `Garzoni: Learn Money & Finance` (30) ✅ recommended — keyword-forward
- `Garzoni - Learn Finance` (23)

**Short description** (80 char max, indexed):
```
Learn budgeting, investing & money skills in 5-min lessons. Build real wealth.
```
(78 chars)

**Full description** (4,000 char max — Google indexes this, unlike Apple; ~2–3%
natural density on: personal finance, budgeting, financial literacy, investing,
money management, saving — no stuffing):
```
Garzoni is the fun way to learn personal finance. Short, interactive lessons turn
budgeting, saving, investing, credit, and debt into a daily habit — like a game,
not a textbook.

WHY GARZONI
• 5-minute lessons you'll actually finish
• Learn by doing: quizzes, real-world tools, and instant feedback
• A personalised path that adapts to what you already know
• An AI money coach that answers your questions in plain English
• Streaks, rewards, and progress tracking to keep you going

WHAT YOU'LL LEARN
• Budgeting that fits your real life
• How to start saving — and keep it up
• Investing basics for beginners, explained simply
• How credit scores and debt actually work
• Taxes, insurance, and big-purchase planning without the jargon

WHO IT'S FOR
Young adults and anyone who was never taught money at school. No finance
background needed — start from zero and build genuine financial literacy and
confidence.

Master money management one lesson at a time. Download Garzoni and start today.
```
(Adjust to taste; keep the keyword themes.)

**Assets to upload:**
- Feature graphic 1024×500 (required for featuring)
- Phone screenshots: min 2, max 8 — put a benefit caption on the first 3
- No emojis / ALL CAPS / "best" / "free" in the title (policy)

**Post-launch (do NOT do until the listing is live and returns 200):**
- Add Play badge beside the App Store badge above the fold on `/` and `/marketing`
- Add the Play URL to schema (Phase 3) and re-enable the Play link in `404.html`
- Android Vitals gate ranking: crash rate < 1.09%, ANR < 0.47% (watch Sentry
  garzoni-android)

---

## iOS App Store (A2)

### Romanian localization (biggest free win — product already ships RO)
Add a **Romanian (Romania)** localization in App Store Connect:

- **Title** (30): `Garzoni - Finanțe Personale` (27)
- **Subtitle** (30): `Buget, investiții și economii` (29)
- **Keywords** (100 bytes, comma no-space, no title/subtitle repeats):
  `educatie,financiara,bani,economisire,investitii,credit,datorii,avere,invata`
- **Promotional text** (170): `Învață să-ți gestionezi banii cu lecții scurte și interactive. Primul tău pas spre libertate financiară.`
- **Description** (RO): translate the EN description; the product already has RO
  copy in `packages/core/src/locales/ro/*` to reuse tone/terms.

### English keyword field (100 bytes, hidden) — audit in App Store Connect
Apple indexes title + subtitle words once each, so do NOT repeat them here.
Comma-separated, no spaces:
```
financialliteracy,money,budgeting,invest,savings,debt,credit,wealth,learn,finance
```

### Other App Store Connect actions (impact order)
1. **Ratings volume** — 4 ratings is the #1 conversion blocker. The in-app prompt
   (`mobile/src/bootstrap/reviewPrompt.ts`) now caps at 3/365d and fires only on
   delight events (lesson complete / quiz pass / streak milestone). Consider
   raising `MIN_POSITIVE_EVENTS` from 1 → 3 so it fires after demonstrated
   engagement rather than the first lesson (left at 1 for now — product call; a
   test asserts the current behavior).
2. **Screenshot legibility** — first 3 screenshots do 90% of the work. Current
   dark-on-dark small italic serif captions are illegible at thumbnail size.
   Bigger, high-contrast captions; keep the hooks.
3. **In-app events** (up to 10, indexed, shown in search): "The Climb" launch,
   streak challenges.
4. **Custom Product Pages** (up to 70, in organic search since Jul 2025, +5.9%
   avg conversion): one per persona — "learn investing", "budgeting for
   beginners", "duolingo for finance".
5. **Declare Accessibility** features (new App Store section, currently "Not yet
   indicated").
6. Consider testing **Education** as primary category (less competitive than
   Finance).

---

## Store ↔ web consistency (A3) — remaining
- ✅ Website rating now `5.0★` (was `4.9`), matching the store.
- ✅ `Beta users` → `Learners`.
- iOS Smart App Banner (`app-id=6761790801`) present on all routes — keep.
- When Play is live: badge + URL into schema + `/marketing`.

## Leading indicators to watch
- Play Console: track status → production; installs trend
- App Store Connect: ratings count (baseline 4); impressions → product-page-view conversion
- GSC: brand impressions for "garzoni app" / "garzoni android"

# Phase 2 — App Stores / ASO

## A1. CRITICAL: Android app not publicly on Google Play

`https://play.google.com/store/apps/details?id=app.garzoni.mobile` → **404 in GB, RO, US** (verified 2026-07-01). App is unpublished or stuck in a closed-testing track. Store pages are ~30–45% of download-intent SERP results ("financial literacy app" SERP is dominated by Play/App Store listings) — half the mobile market is unreachable and the SERP surface is forfeited.

**Plan:**

1. Check Play Console track status. Personal developer accounts (created after Nov 2023) require **12+ testers opted in for 14 continuous days** before production access — if that's the blocker, recruit testers now (community, friends, CIO email list).
2. Prepare listing assets in parallel (don't wait for track clearance):
   - Title (30 chars): `Garzoni: Learn Personal Finance` is 31 — use `Garzoni - Learn Finance` or `Garzoni: Money & Finance` — include a keyword, title is Play's strongest signal
   - Short description (80 chars, indexed): e.g. `Learn budgeting, investing & money skills in 5-min daily lessons. Build wealth.` (80)
   - Full description (4,000 chars, **indexed** — unlike Apple): target 2–3% natural density on: personal finance, budgeting, financial literacy, learn investing, money management, savings; no keyword stuffing (Google NLP penalizes)
   - Feature graphic 1024×500 (required for featuring)
   - Screenshots: min 2, max 8; put messaging captions on first 3
   - No emojis/ALL CAPS/"best"/"free" in title (policy)
3. Android Vitals gate ranking: crash rate must stay <1.09%, ANR <0.47% (Sentry garzoni-android project already split — monitor there).
4. Until listing is live: website must not link the Play URL (404 = broken UX + wasted schema); add "Android: use the web app" CTA instead (see SXO findings).

## A2. iOS App Store — current listing audit

**Listing (GB storefront, v1.1.4, 2026-06-18):**

| Field            | Value                                                                                                                       | Verdict                                                                                                           |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Title            | `Garzoni - Personal Finance` (26/30)                                                                                        | OK; 4 chars spare                                                                                                 |
| Subtitle         | `Budget, Invest & Build Wealth` (29/30)                                                                                     | Good keyword coverage, no title duplication                                                                       |
| Category         | Finance (primary), Education (secondary)                                                                                    | Sensible; consider testing Education primary — less competitive                                                   |
| Rating           | 5.0 × **4 ratings**                                                                                                         | Volume is the #1 conversion blocker                                                                               |
| Preview video    | Present ("School taught you everything" hook)                                                                               | ✓                                                                                                                 |
| Screenshots      | Video + captioned screenshots ("Your money journey starts here", "Tools for real decisions", "Learn by doing, not reading") | Captions present ✓ (indexed since June 2025) but dark art + small serif text — illegible at search-thumbnail size |
| Promotional text | "Limited time: get your first month free…"                                                                                  | ✓ good use (updatable without release)                                                                            |
| Languages        | **EN only**                                                                                                                 | RO locale fully exists in product — free win                                                                      |
| In-app events    | None                                                                                                                        | Gap                                                                                                               |
| Accessibility    | "Not yet indicated"                                                                                                         | Gap (new App Store section)                                                                                       |

**Priority actions (impact order):**

1. **Ratings volume.** 4 ratings = no social proof; every competitor (Money Masters, Zogo, Fingo) has thousands. `SKStoreReviewController` prompt already exists in `mobile/src/bootstrap/reviewPrompt.ts` — audit its trigger timing (fire after streak milestone / lesson completion high, not app open; max 3 prompts/365 days).
2. **Add Romanian localization** (title/subtitle/description/screenshots for RO storefront). Product already ships RO — listing localization is metadata-only work and opens an entire keyword surface where competition is thin.
3. **Keyword field (hidden, 100 bytes)** — not externally auditable. Check App Store Connect: no words repeated from title/subtitle (Apple indexes each word once); commas without spaces; candidates: `financial literacy,money,budgeting,invest,savings,debt,credit,wealth,learn`.
4. **Screenshot legibility pass:** first 3 screenshots do 90% of the work; current dark-on-dark + small italic serif captions don't read at thumbnail size. Bigger, high-contrast captions; keep the strong hooks.
5. **In-app events** (up to 10, 31 days each, indexed + shown in search): "The Climb" launch, streak challenges — free search surface.
6. **Custom Product Pages** (up to 70, in organic search since July 2025, +5.9% avg conversion): one per persona — "learn investing", "budgeting for beginners", "duolingo for finance".
7. Declare **accessibility** features in App Store Connect.

## A3. Store ↔ web consistency

- Website shows "4.9★ App Store" but the store shows 5.0 × 4 ratings — align the claim or drop the decimal ("5★-rated").
- Website shows "12k+ beta users" — "beta" undermines trust (SXO finding); use "12k+ learners".
- iOS Smart App Banner (`app-id=6761790801`) present on all routes ✓ — keep.
- Once Play is live: Play badge beside App Store badge above the fold + Play URL into schema (Phase 3) + `/marketing` page.

## Leading indicators

- Play Console: track status → production; installs trend
- App Store Connect: ratings count (baseline 4), impressions → product page views conversion
- GSC: brand query impressions for "garzoni app" / "garzoni android"

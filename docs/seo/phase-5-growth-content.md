# Phase 5 — Growth Content & SERP Surface Expansion

Depends on: Phase 4 E1 (named author needed to compete with NerdWallet-class listicles), Phase 1 C1.

## Shipped in code (this phase)

Content + schema plumbing for the missing SERP surfaces is live. Companion
manual/editorial work in [phase-5-growth-todo.md](./phase-5-growth-todo.md).

- **Model + schema:** `Article` gained a `roundup` and `alternatives` category
  and an `item_list` JSONField (migration `0046`). New `SeoHead.itemList` prop
  emits **ItemList JSON-LD** (each entry a `SoftwareApplication`, ranked) so
  roundup/alternatives pages read as app comparisons to Google + AI crawlers.
  `ArticlePage` passes it through; the public article API exposes `item_list`.
- **G1** — `/guides/duolingo-for-money-best-apps` roundup (Fingo / Zogo / Money
  Masters / Seed / Garzoni), Garzoni framed as best for depth + habit. Homepage
  "What's inside" H2 reworked to question form and now says **"the Duolingo for
  finance"**.
- **G2** — two roundup listicles: `/guides/best-financial-literacy-apps` and
  `/guides/best-budgeting-apps-for-beginners`, each with a "How we picked"
  methodology, criteria table, and ItemList schema.
- **G3** — three alternatives pages: `/guides/zogo-alternatives`,
  `/guides/money-masters-alternatives`, `/guides/fingo-alternatives`.
- **G4** — `/guides/best-money-app-for-students` (segmented, "built for 16+")
  guide.
- All seven ship via `python manage.py seed_growth_guides` (idempotent;
  `--dry-run` / `--draft`). New slugs auto-flow into sitemap, prerender, and
  `llms-full.txt` — no infra change.

**Honesty guard rails baked in:** competitor descriptions are general + hedged
(no invented pricing/features/URLs), every roundup dates itself and pushes
verification to the app's own site, and Garzoni is only claimed to win the
category it actually competes in (learning), never banking/brokerage/budgeting
execution. Author is still `Garzoni Team` — **swap in a real byline once Phase 4
E1 lands** (roundups compete far better with a credentialed author).

---


## SERP reality (SXO analysis, 5 download-intent queries)

Composition across queries: **listicles ~40%, app-store pages ~30%, product landing pages ~25%.** Garzoni fields only a landing page — competing on 1 of 3 surfaces.

| Query | Dominant type | Garzoni fit |
|---|---|---|
| personal finance learning app | listicle 45% / landing 33% / store 22% | Type-aligned, absent from every listicle (MEDIUM) |
| app to learn about money | listicle 55%, kids/teens skew | Partial intent mismatch (HIGH) |
| budgeting app for beginners | listicle 55% (NerdWallet, CNBC, Forbes) | Tool-vs-course mismatch (HIGH) |
| financial literacy app | **store pages ~45%** | No Play presence = surface forfeited (HIGH) |
| **duolingo for finance** | weak SERP: Fingo + thin blog | **Garzoni's literal positioning, zero presence — CRITICAL opportunity** |

**Wrong competitor cohort:** existing `/guides/garzoni-vs-{monzo,ynab,monarch,acorns,cleo,zogo}` target budgeting *tools*; education-query SERPs are dominated by **Money Masters, Fingo, Zogo, Seed** — only Zogo covered.

## G1. Own "duolingo for finance" (highest intent-fit, lowest competition)

- Publish `/guides/duolingo-for-money-best-apps`: honest matrix Fingo vs Seed vs Money Masters vs Garzoni, verdict framing.
- Work the phrase into a homepage H2.
- Fingo owns the query today with thin coverage.

## G2. Roundup listicles (the missing dominant page type)

Under /guides, NerdWallet-style with criteria tables + ItemList schema + named author + methodology:
1. "Best financial literacy apps 2026"
2. "Best budgeting apps for beginners"
Garzoni positioned honestly ("best for building the habit").

## G3. Alternatives pages (decision-stage capture, correct cohort)

- Zogo alternatives · Money Masters alternatives · Fingo alternatives

## G4. Segmented landing content

"for beginners"/"for students" qualifiers recur across SERPs; homepage is one-size-fits-all. Consider `/for-students` or beginner-angle guide. Parent/teen persona (scored 38/100) = deliberate non-target — add "built for 16+/young adults" microcopy to exclude clearly, don't chase kids SERPs.

## G5. Listicle outreach (authority gap)

Zero presence in ~12 listicles ranking across the 5 queries. Pitch inclusion to: The Money Couple, Qonto blog, KidVestors, Finaciti. This gap is why Zogo's homepage ranks and Garzoni's doesn't.

## G6. Homepage persona fixes (from SXO scores)

| Persona | Score | Blocker |
|---|---|---|
| Duolingo-style learner | 80 | None major — best fit |
| Broke student | 71 | Price anxiety — surface free tier harder |
| Budget-fixer | 51 | Budget-builder buried in 3rd feature card |
| Parent/teen | 38 | Non-target, exclude explicitly |

Cross-persona: Trust weakest dimension (avg 13.5/25) — replace "12k+ **beta** users" with "12k+ learners"; add real `<img>` screenshot strip above fold (page has 2 imgs total: logo + coffee button); testimonials.

**Android dead end:** zero `play.google.com` occurrences in DOM. Until Play live: explicit "Android: use the web app" CTA. After: Play badge above fold (Phase 2).

## Leading indicators

- GSC impressions: "duolingo for finance", "financial literacy app", "zogo alternatives"
- Referring domains from pitched listicles
- Searchable visibility on download-intent prompts

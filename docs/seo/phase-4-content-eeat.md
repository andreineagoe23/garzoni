# Phase 4 — Content & E-E-A-T

Depends on: Phase 1 C1 (content must be crawlable). Finance = YMYL — Sept 2025 QRG caps anonymous money content at Low quality regardless of accuracy.

**Scores:** Content 42/100 · E-E-A-T 38/100 (Experience 35, Expertise 40, **Authoritativeness 20**, Trust 55) · AI-citation readiness 40/100 (→ ~65 once crawlable).

## E1. HIGH — Zero author attribution on YMYL content

No byline, credentials, reviewer, or editorial policy anywhere. API-level `author: "Garzoni Team"` on guides — not a named person.

**Plan:**
1. Named author/reviewer per lesson + bio page (credentials, photo, LinkedIn).
2. `author`/`reviewedBy` in schema (ties into Phase 3 S4).
3. Editorial-standards page linked from footer ("how we research, review cadence, sources policy").

## E2. HIGH — No sources/citations in lessons

Zero external references despite UK-specific claims (ISAs, pensions, tax). Authoritativeness 20/100 largely from this.
**Plan:** cite FCA, MoneyHelper, gov.uk, HMRC, Bank of England per lesson — 2–3 authoritative links each. Template-level change (add Sources block).

## E3. HIGH — No visible dates

No published/updated dates on page, none in schema (API has timestamps — surface them).
**Plan:** render `published_at`/`updated_at` visibly + `datePublished`/`dateModified` in schema. One template change with E2.

## E4. HIGH — Thin lessons vs quality gates

| Page | Words | Target |
|---|---|---|
| APR vs AER | 391 | 800–1,200 |
| Good vs Bad Debt | 378 | 800–1,200 |
| Compound Interest | 576 | 800–1,200 |

Expand with: per-lesson unique FAQ block, worked table/example, cited sources. Don't pad — the writing quality is good (FRE 71–72, FKGL ~7, ideal for the audience); depth is what's missing.

## E5. MEDIUM — About page thin + anonymous (363 words)

Raters check About first on YMYL. Add founder/team names, photos, credentials, company details, mission. Target 500+ words.

## E6. MEDIUM — Template fingerprint = "scaled content" risk

Identical 6-section structure across all lessons + no authorship + no dates pattern-matches QRG scaled-content markers. E1–E4 fixes break the fingerprint; also vary examples/data per lesson.

## E7. MEDIUM — Humanization pass on older-pipeline lessons

Compound-interest lesson is AI-generic ("powerful tool for building long-term wealth", "significant" ×6, restated opener). APR/AER and Debt lessons read tighter — match their register.

## E8. LOW / cleanups

- Store badge next to "Create a free account" CTA in lesson footer block (only homepage links the App Store today).
- Homepage og:description ≠ meta description — align.
- buymeacoffee.com footer link on a paid-subscription product — trust dissonance; consider removing.
- llms-full.txt currently serves the SPA shell (garbage if ingested) — generate real concatenated-Markdown corpus from the public APIs, or remove the route (GEO finding; pairs with Phase 1).

## What's already good (keep)

- Readability ideal for young adults (FRE 71.7/72.2 lessons, FKGL ~7)
- Definition-first openers ("Interest is the price of borrowing money") — textbook AI-citable
- Atomic quotable facts ("2%/month ≈ 27% APR"; "£1,000 at 5% AER → ~£1,050")
- Trust plumbing: sitewide educational disclaimer, /financial-disclaimer, full legal set
- Clean single-H1 + semantic H2 hierarchy; well-formed llms.txt
- 5 store-CTA touchpoints on homepage

## GEO additions (from AI-search audit)

- Convert marketing H2s to question form ("What's inside" → "What does Garzoni actually teach?") — matches natural-language AI queries.
- Wikidata entity: "Garzoni" collides with the Venetian family + painter Giovanna Garzoni; zero disambiguation for the app. Create/claim a distinct Wikidata entity.
- Reddit presence: seed authentic mentions (r/personalfinance, r/UKPersonalFinance) — second-highest correlation signal for AI citation after Wikipedia.
- Realistic near-term ceiling: Perplexity/ChatGPT citation from own pages (once crawlable), not AI Overviews — entity graph too young.

## Priority order

C1 (Phase 1) → E1 authorship → E2+E3 (one template change) → E4/E5 expansion → E6/E7 → GEO extras.

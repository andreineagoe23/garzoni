# Garzoni SEO / ASO / GEO Audit — Phased Implementation Plan

**Audit date:** 2026-07-01
**Scope:** garzoni.app (web), iOS App Store listing, Google Play, AI search (GEO), Core Web Vitals.
**Method:** 6 parallel audit agents (technical, content/E-E-A-T, schema, SXO, GEO, performance) + ASO audit of both store listings + Searchable/GA4 data pull. Audit only — nothing implemented yet.

## Scores at a glance

| Area                       | Score      | Verdict                                           |
| -------------------------- | ---------- | ------------------------------------------------- |
| Technical SEO              | 58/100     | Strong foundations, one critical indexation break |
| Content quality            | 42/100     | Well-written but thin, anonymous, uncited         |
| E-E-A-T                    | 38/100     | YMYL finance content with zero authorship         |
| SXO gap score              | 55/100     | Landing page competes on 1 of 3 SERP surfaces     |
| Performance (mobile lab)   | 48/100     | LCP + CLS + TBT all fail on mobile; desktop fine  |
| AI visibility (Searchable) | 6.7/100    | "Very Low" — brand invisible to AI platforms      |
| iOS ASO                    | ~B− (est.) | Good metadata, 4 ratings, EN-only                 |
| Android ASO                | n/a        | **App not publicly on Google Play (404)**         |

## The one-sentence diagnosis

The entire lesson/guide content moat (56 of 68 sitemap URLs) returns **HTTP 404 to Googlebot, GPTBot, ClaudeBot and PerplexityBot**, the hero demo video is **CSP-blocked for every visitor**, and **half the mobile market (Android) has no store listing and no path from the website** — fix distribution before optimizing anything else.

## Phases

| Phase | File                                                                   | Theme                                                    | Effort |
| ----- | ---------------------------------------------------------------------- | -------------------------------------------------------- | ------ |
| 1     | [phase-1-critical-fixes.md](phase-1-critical-fixes.md)                 | Indexation + conversion breakage (do first)              | Hours  |
| 2     | [phase-2-app-stores-aso.md](phase-2-app-stores-aso.md)                 | Google Play publish + iOS ASO                            | Days   |
| 3     | [phase-3-schema-entities.md](phase-3-schema-entities.md)               | Structured data / entity graph                           | Hours  |
| 4     | [phase-4-content-eeat.md](phase-4-content-eeat.md)                     | Authorship, sources, dates, expansion                    | Weeks  |
| 5     | [phase-5-growth-content.md](phase-5-growth-content.md)                 | Roundups, "duolingo for finance", alternatives, outreach | Weeks  |
| 6     | [phase-6-performance-monitoring.md](phase-6-performance-monitoring.md) | CWV, caching, IndexNow, analytics gaps                   | Days   |

## Dependency order

```
Phase 1 (C1 prerender fix) ──► Phase 3 (lesson-page schema)
Phase 1 (C1)               ──► Phase 4 (content changes must be crawlable to matter)
Phase 2 (Play listing live)──► Phase 3 (Play links in JSON-LD)
Phase 2 (Play listing live)──► Phase 1.5 (Play badge on homepage)
Phase 4 (authorship)       ──► Phase 5 (roundups need named author to compete)
```

## Leading indicators to watch (no re-audit needed)

- GSC Coverage: `/learn/*` URLs move from "Not found (404)" to "Indexed"
- GSC Impressions for "duolingo for finance", "financial literacy app"
- Searchable AI visibility score (baseline 6.7, +1.4 last 30d)
- App Store ratings count (baseline: 4)
- Play Store console: listing live + install trend

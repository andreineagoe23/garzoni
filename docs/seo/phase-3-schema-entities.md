# Phase 3 — Schema / Entity Graph

Depends on: Phase 1 C1 (lesson pages must be crawlable before their schema matters), Phase 2 A1 (Play links go into JSON-LD only once the listing is live).

## Current state (verified via Googlebot-UA fetch)

| Type | Home | /subscriptions | /learn | Lesson/guide detail | Status |
|---|---|---|---|---|---|
| Organization | ✅ | ✅ | ✅ | blocked by C1 | Valid (name, url, logo, 6 sameAs, contactPoint) |
| WebApplication | ✅ | ✅ | ✅ | — | Valid but duplicates SoftwareApplication |
| SoftwareApplication | ✅ | ✅ | ✅ | — | **No `aggregateRating`; no Android; App Store URL only** |
| FAQPage | ✅ (6 Q) | ❌ | ✅ (3 Q) | — | Keep — AI-citation value only (Google retired FAQ rich results May 2026; no SERP feature) |
| BreadcrumbList | ❌ | ❌ | ✅ | — | Add to detail pages post-C1 |
| WebSite | ❌ | ❌ | ❌ | ❌ | Missing everywhere |
| MobileApplication | ❌ | ❌ | ❌ | ❌ | **Missing — highest-impact gap** |
| Course/LearningResource | — | — | — | ❌ | Missing (current Course markup minimal: name/description/provider only — rich-result ineligible) |
| Article/BlogPosting (guides) | — | — | — | ❌ | Missing |

All blocks: JSON-LD ✓, HTTPS @context ✓, absolute URLs ✓, no deprecated types ✓ (no HowTo).

## Fixes (priority order)

### S1. Add MobileApplication node (replace generic SoftwareApplication)

Ready-to-paste (homepage + /subscriptions). **Gates:**
- Play Store `offers`/`downloadUrl`/`installUrl` entries only AFTER the Play listing is live (currently 404 — linking a dead store page is worse than omitting it). Until then ship iOS-only version.
- `aggregateRating` only with REAL values from App Store Connect (currently 5.0 × 4). Fabricated ratings violate Google guidelines. Note: 4 ratings is thin — acceptable to publish real numbers, but expect no star rich-result gravitas until volume grows (Phase 2 A2.1).

```json
{
  "@context": "https://schema.org",
  "@type": "MobileApplication",
  "@id": "https://www.garzoni.app/#mobileapp",
  "name": "Garzoni - Personal Finance",
  "operatingSystem": "IOS",
  "applicationCategory": "FinanceApplication",
  "description": "Garzoni is a personal finance education app for young adults. Learn budgeting, saving, investing, credit, and debt through short interactive lessons, quizzes, and an AI coach.",
  "url": "https://www.garzoni.app",
  "publisher": { "@id": "https://www.garzoni.app/#organization" },
  "offers": {
    "@type": "Offer",
    "price": "0",
    "priceCurrency": "GBP",
    "url": "https://apps.apple.com/gb/app/garzoni-master-your-money/id6761790801"
  },
  "downloadUrl": "https://apps.apple.com/gb/app/garzoni-master-your-money/id6761790801",
  "installUrl": "https://apps.apple.com/gb/app/garzoni-master-your-money/id6761790801",
  "aggregateRating": {
    "@type": "AggregateRating",
    "ratingValue": "5.0",
    "ratingCount": "4"
  }
}
```

When Play goes live: `operatingSystem: "IOS, ANDROID"`, add the Play URL to offers/downloadUrl/installUrl arrays.

### S2. Consolidate the three overlapping "Garzoni" app nodes

WebApplication + SoftwareApplication currently describe one entity with inconsistent values (`"Web, iOS"` vs `"iOS, Web"`), no `@id` linking — ambiguous for Knowledge Graph + LLM entity resolution.

Target shape: `Organization#organization` ← publisher of → `WebSite#website`, `WebApplication#webapp` (web experience), `MobileApplication#mobileapp` (stores). Drop the generic SoftwareApplication.

### S3. Add WebSite node (entity clarity / sitelinks eligibility)

```json
{
  "@context": "https://schema.org",
  "@type": "WebSite",
  "@id": "https://www.garzoni.app/#website",
  "name": "Garzoni",
  "url": "https://www.garzoni.app",
  "publisher": { "@id": "https://www.garzoni.app/#organization" }
}
```
(No SearchAction — site has no on-site search.)

### S4. Post-C1: detail-page schema

- Lessons: upgrade Course → `LearningResource` or `Article` with `author` (named person, see Phase 4), `datePublished`/`dateModified`, `isAccessibleForFree`; or enrich Course with `hasCourseInstance` + `offers`.
- Guides: `Article`/`BlogPosting` with author + dates.
- BreadcrumbList on every detail page: `Home › Lessons › {Title}`.

### S5. Low priority

- Offer/Service schema for Plus/Pro tiers on /subscriptions (AI pricing answers; no rich-result benefit).
- Align schema `operatingSystem` casing/order everywhere.

## Verification

- Google Rich Results Test on homepage + one lesson post-deploy.
- `curl -A "Googlebot/2.1" <url> | grep -o 'application/ld+json'` count per page — expect one consolidated graph, no duplicate app entities.

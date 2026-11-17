# Garzoni docs index

Garzoni teaches personal finance in short gamified lessons (paths, quizzes, streaks, an AI tutor that knows your progress, plus money tools). An **education** product, not financial advice. UK first (GBP, ISAs, NI), Romanian second (full app and site translation). Trust check before reading any plan: [`.claude/context/docs-map.md`](../.claude/context/docs-map.md). Built vs flagged vs stubbed: [`feature-status.md`](../.claude/context/feature-status.md) · on both platforms? [`parity-matrix.md`](../.claude/context/parity-matrix.md).

- **Surfaces (2026-11-17):** iOS and Android 1.2.2 live (`app.garzoni.mobile`); web at www.garzoni.app (app + public lessons, guides, 3 calculators in en/ro); one Django API.
- **Plans:** Starter free · Plus £6.99/mo or £59.99/yr · Pro £7.99/mo or £69.99/yr, yearly has a 7-day trial; RevenueCat everywhere, Stripe-backed on web. Source of truth: `prod/subscription-matrix.md`.
- **Known gaps:** some public UK lessons have outdated figures and 7 RO tax/banking lessons describe UK rules ([`content-drafts/eeat-drafts-2026-10.md`](../content-drafts/eeat-drafts-2026-10.md)); open banking is disabled (manual entry + statement import); some features are built but flagged off; AI answers in English even for RO users (except Smart Resume); web and mobile are not at parity; the Starter daily-learning and hint limits in the subscription matrix were not built (2026-10-08).

## Start here (task → doc)

- **Understand the system:** [`dev/architecture.md`](dev/architecture.md) · module pages: [learning](dev/learning.md), [AI](dev/ai.md), [tools](dev/tools.md), [accounts](dev/accounts.md), [engagement](ux/engagement.md), [plans and billing](prod/plans-and-billing.md), [notifications](notifications/overview.md), [website](seo/website.md)
- **Growth plan (current):** [`audit/growth-audit-2026-11.md`](audit/growth-audit-2026-11.md) — live bugs, retention, stores, web, operating cadence, carried-over open items
- **Repo, docs and Claude Code cleanup (in progress):** [`audit/cleanup-plan-2026-11.md`](audit/cleanup-plan-2026-11.md)
- **What's broken or owed:** [`audit/platform-audit-2026-08.md`](audit/platform-audit-2026-08.md) → `.claude/context/debt-register.md` · security/latency: [`audit/security-latency-2026-08.md`](audit/security-latency-2026-08.md)
- **Superseded, do not use:** [`archive/`](archive/) (14 docs moved 2026-11-17; denied to Claude)

## dev/ — standing guides

- **Run locally / env:** [`setup-docker`](dev/setup-docker.md) · [`setup-local`](dev/setup-local.md) · [`environment`](dev/environment.md) (every env var, per host) · [`railway-test-service`](dev/railway-test-service.md) · [`DEV_NOTES`](dev/DEV_NOTES.md) (mobile LAN-IP)
- **API shape:** [`api-docs`](dev/api-docs.md) (pointer to live `/api/docs/`)
- **Spacing/radius (read before any layout):** [`spacing-contract`](dev/spacing-contract.md) · mobile parity: [`mobile-ui-token-contract`](dev/mobile-ui-token-contract.md)
- **Styling / dark mode:** [`frontend-styling`](dev/frontend-styling.md) · a11y: [`frontend-accessibility`](dev/frontend-accessibility.md)
- **Tools pages:** [`tools-principles`](dev/tools-principles.md) · statement import, categorization, Plaid stub: [`budgeting-and-open-banking`](dev/budgeting-and-open-banking.md) · [`banking/open-banking-plan`](banking/open-banking-plan.md) (PLAN)
- **Errors / Sentry:** [`error-reporting`](dev/error-reporting.md) · mojibake rule: [`encoding-and-user-display`](dev/encoding-and-user-display.md)
- **Lesson content rewrites and every local→Railway content push (RO re-translation owed after any rewrite):** [`exercise-answer-integrity`](dev/exercise-answer-integrity.md)
- **TS strictness (it's OFF):** [`typescript-strictness`](dev/typescript-strictness.md) (PLAN, not started) · deferred mobile bets: [`mobile-simplification-roadmap`](dev/mobile-simplification-roadmap.md) · QA template: [`mobile-user-testing-qa`](dev/mobile-user-testing-qa.md)
- **Customer.io dashboard config:** [`customer-io-journeys-setup`](dev/customer-io-journeys-setup.md) (PLAN) · [`notifications/audit-2026-07-22`](notifications/audit-2026-07-22.md) (PLAN, needs a live account)

## prod/ — running it

- **Release:** [`pre-release-checklist`](prod/pre-release-checklist.md) · backend: [`railway-production-runbook`](prod/railway-production-runbook.md) · [`railway-database-connection`](prod/railway-database-connection.md) · [`monitoring-red-flags`](prod/monitoring-red-flags.md)
- **Billing:** [`subscription-matrix`](prod/subscription-matrix.md) (prices and gating) · [`billing-parity-runbook`](prod/billing-parity-runbook.md) (RevenueCat-first) · [`plans-and-billing`](prod/plans-and-billing.md)
- **reCAPTCHA / legal:** [`production-recaptcha`](prod/production-recaptcha.md) · [`recaptcha-enterprise-config`](prod/recaptcha-enterprise-config.md) · [`cookie-consent-legal`](prod/cookie-consent-legal.md)
- **Edge:** [`cloudflare-public-api-cache`](prod/cloudflare-public-api-cache.md) (applied 2026-08-19)
- **Stores (PLAN):** [`android-credentials-checklist`](prod/android-credentials-checklist.md) (54/64) · [`ios-platforms-expansion-runbook`](prod/ios-platforms-expansion-runbook.md) (untouched). No per-release runbook exists since the archived 1.1.7 one.

## ux/, seo/, aso/, promo/, analytics/ — product and growth

- **Missions / gamification:** [`ux/missions-audit-2026-08`](ux/missions-audit-2026-08.md) (PLAN, partial) · paywall placement: [`ux/UX_ONBOARDING_MONETIZATION_PLAN`](ux/UX_ONBOARDING_MONETIZATION_PLAN.md) (PLAN, partial)
- **Store copy (canonical, en + ro):** [`aso/store-listing`](aso/store-listing.md) · [`aso/aso-audit-2026-07-07`](aso/aso-audit-2026-07-07.md) (PLAN) · [`aso/play-listing-assets-2026-07`](aso/play-listing-assets-2026-07.md) (screenshot spec only)
- **SEO:** [`seo/README`](seo/README.md) (phase index; phases 1-2 archived) · [`phase-3`](seo/phase-3-schema-entities.md) · [`phase-4`](seo/phase-4-content-eeat.md)/[`-5`](seo/phase-5-growth-content.md)/[`-6`](seo/phase-6-performance-monitoring.md) + `*-todo` (PLAN, editorial open) · [`ai-visibility-2026-10`](seo/ai-visibility-2026-10.md) · [`geo-offsite-kit`](geo-offsite-kit.md)
- **Outreach and events (drafts):** [`promo/outreach-and-events-2026-10`](promo/outreach-and-events-2026-10.md) · **funnel events:** [`analytics/skill-intent-funnels`](analytics/skill-intent-funnels.md)
- [`audit/growth-audit-2026-10`](audit/growth-audit-2026-10.md): superseded for priorities by the 2026-11 audit; still the SEO/ASO detail reference.

## Conventions

`dev/` = standing guide · `prod/` = operations · everything else is a dated audit or plan. Date every plan; when work lands, add a status banner rather than deleting; add the doc here and in `.claude/context/docs-map.md`; superseded docs go to `archive/<same subfolder>/`.

# Garzoni docs index

## What Garzoni is

Garzoni teaches personal finance in short, gamified lessons. People work through learning paths
(budgeting, saving, investing, credit, debt, taxes and more), answer questions as they go, keep a
daily streak, and can ask an AI tutor that knows their progress. Alongside the lessons sit practical
money tools — a budget planner, savings goals, a portfolio analyser — so what they learn can be
tried on their own numbers.

This folder describes **what Garzoni is and does today**, module by module. It is written for anyone
new to the product: a contributor, a partner, or a future you. Every module page follows the same
shape — what it is, how it works for the user, which plan and platform it is on, where it lives in
the code, and what is unfinished.

_Last reviewed: 2026-10-08._

### Who it is for

- **Young adults getting started with money** — students, graduates and early-career people who
  were never taught budgeting, credit or investing at school. Lessons assume no prior knowledge.
- **UK first.** Examples, amounts and tax/banking lessons are written for the UK (pounds, ISAs,
  National Insurance, the FSCS). Prices are in GBP.
- **Romania second.** The app and website are fully available in Romanian, and most lessons are
  translated. Some UK-specific lessons still describe UK rules in Romanian — see
  [Known gaps](#known-gaps-across-the-product).

It is an **education** product, not financial advice: no regulated advice, no account aggregation
in production, no money movement.

### Where it runs

| Surface            | What                                                                           | Status                                     |
| ------------------ | ------------------------------------------------------------------------------ | ------------------------------------------ |
| **iOS app**        | "Garzoni: Learn Money & Finance" on the App Store (iOS 15.1+)                  | Live, 1.2.0; 1.2.1 built, not yet released |
| **Android app**    | Same app on Google Play (`app.garzoni.mobile`)                                 | Live, 1.2.0                                |
| **Web app**        | Full learning app in the browser at [www.garzoni.app](https://www.garzoni.app) | Live                                       |
| **Public website** | Landing page, free lessons, guides and calculators, in English and Romanian    | Live                                       |

One Django API serves all of them, and accounts, progress and subscriptions are shared across
devices. Web and mobile are built separately, so some features exist on one platform only — each
module page says which.

### Plans

| Plan        | Price                      | What it adds                                                                                                                                     |
| ----------- | -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Starter** | Free                       | Free learning paths (limited by hearts), a preview of the Personalized Path, 5 AI tutor messages a day, 3 AI explanations of wrong answers a day |
| **Plus**    | £6.99/month or £59.99/year | All paths, 50 AI messages a day, the full Personalized Path and AI coach brief, analytics, the Plus tools                                        |
| **Pro**     | £7.99/month or £69.99/year | Everything in Plus, 200 AI messages a day, voice tutor and receipt scan on mobile                                                                |

Yearly plans have a 7-day free trial. Subscriptions run through RevenueCat everywhere (App Store
and Google Play on mobile, Stripe-backed Web Billing on the web), so a plan bought on one platform
works on the others. Full detail: [Plans and billing](prod/plans-and-billing.md).

### Modules

| Module                                         | What it covers                                                                                                                                                               |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Learning](dev/learning.md)                    | Learning paths, courses and lessons, quizzes, exercises, review and mastery, onboarding and the Personalized Path                                                            |
| [AI features](dev/ai.md)                       | The AI tutor, explanations of wrong answers, coach brief, smart resume, voice tutor, receipt scan, AI nudges, lesson search                                                  |
| [Engagement](ux/engagement.md)                 | XP, streaks, daily and weekly missions, leagues and leaderboards, friends, duels, badges, coins and the rewards shop, referrals                                              |
| [Tools](dev/tools.md)                          | In-app money tools (budget planner, savings goals, portfolio analyser, reality check, calendars and market tools, Personal CFO, statement import) and the public calculators |
| [Plans and billing](prod/plans-and-billing.md) | Plans, prices, what each unlocks, how buying works on each platform                                                                                                          |
| [Notifications](notifications/overview.md)     | Push, email and in-app messages: what is sent, when, and how people control it                                                                                               |
| [Website](seo/website.md)                      | The public site: pages, how visitors become users, SEO and AI-search infrastructure, analytics                                                                               |
| [Accounts and support](dev/accounts.md)        | Sign-up and login, onboarding, profile and settings, language, deletion, support and feedback, admin tools                                                                   |
| [Platform](dev/architecture.md)                | Architecture, services, hosting, environments, translations and content operations                                                                                           |

### The product in numbers

Figures from the live API and stores on 2026-10-08; they change daily.

|                               |                                           |
| ----------------------------- | ----------------------------------------- |
| Registered learners           | 113                                       |
| Learning content              | 7 paths, 35 courses, 175 lessons          |
| App Store rating              | 5.0 (4 ratings)                           |
| Public lessons on the website | 73 (English), most also in Romanian       |
| Public guides                 | 20 (English), 7 in Romanian               |
| Public calculators            | 3, each in English (£) and Romanian (lei) |
| Languages                     | English, Romanian                         |

### Known gaps across the product

The module pages list their own gaps. The ones that cut across everything:

- **Some public lessons contain outdated or wrong UK figures** (for example the FSCS limit and a
  National Insurance example). A full list with sources is in
  [`docs/content/eeat-drafts-2026-10.md`](content/eeat-drafts-2026-10.md).
- **Romanian versions of the UK tax and banking lessons describe UK rules**, not Romanian ones.
- **Open banking is not live.** The bank-connection UI exists but the provider is disabled; budgets
  come from manual entry and statement import.
- **Some features are built but switched off in production** by feature flags (parts of the
  retention system and Customer.io tracking). Code existing does not mean users see it.
- **Some documented limits aren't enforced.** The Starter daily learning limit and hint limit in
  `docs/prod/subscription-matrix.md` are not built; free users are limited by locked paths and hearts.
- **AI features answer in English** even for Romanian users (only Smart Resume is language-aware).
- **Web and mobile are not at parity.** Some Pro features are mobile-only; some screens exist on one
  platform only. Each module page has a web/mobile column.

### Related documentation

- [`docs/dev/architecture.md`](dev/architecture.md) — deeper architecture notes.
- [`docs/prod/subscription-matrix.md`](prod/subscription-matrix.md) — the plan-gating source of truth.
- [`docs/audit/growth-audit-2026-10.md`](audit/growth-audit-2026-10.md) — current growth plan.

---

Every doc in this tree, grouped by what you're trying to do. Status verdicts (CURRENT / PLAN /
STALE / ARCHIVED) come from the 2026-08-18 docs audit and are mirrored in
[`../.claude/context/docs-map.md`](../.claude/context/docs-map.md).

**Before reading a plan or checklist, check its status here.** Several docs describe work that has
since shipped, and a few describe a stack we no longer run.

## Start here

| I want to…                  | Read                                                                                                                                          |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| understand the system       | [`dev/architecture.md`](dev/architecture.md)                                                                                                  |
| know what's actually built  | [`../.claude/context/feature-status.md`](../.claude/context/feature-status.md)                                                                |
| know what's broken or owed  | [`audit/platform-audit-2026-08.md`](audit/platform-audit-2026-08.md)                                                                          |
| security or latency posture | [`audit/security-latency-2026-08.md`](audit/security-latency-2026-08.md)                                                                      |
| grow traffic, rank, signups | [`audit/growth-audit-2026-10.md`](audit/growth-audit-2026-10.md)                                                                              |
| run it locally              | [`dev/setup-docker.md`](dev/setup-docker.md) · [`dev/setup-local.md`](dev/setup-local.md)                                                     |
| set env vars                | [`dev/environment.md`](dev/environment.md)                                                                                                    |
| ship a release              | [`prod/pre-release-checklist.md`](prod/pre-release-checklist.md) · [`prod/railway-production-runbook.md`](prod/railway-production-runbook.md) |

## dev/ — standing engineering guides

| Doc                                                                                  | Covers                                                                                                                      |
| ------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------- |
| [`architecture.md`](dev/architecture.md)                                             | system shape, app tree, AI tutor design, reading order                                                                      |
| [`api-docs.md`](dev/api-docs.md)                                                     | pointer to the live OpenAPI at `/api/docs/`                                                                                 |
| [`environment.md`](dev/environment.md)                                               | every env var, per host                                                                                                     |
| [`setup-docker.md`](dev/setup-docker.md) · [`setup-local.md`](dev/setup-local.md)    | local dev                                                                                                                   |
| [`spacing-contract.md`](dev/spacing-contract.md)                                     | **the** spacing/radius scale — read before any layout work                                                                  |
| [`frontend-styling.md`](dev/frontend-styling.md)                                     | web Tailwind/SCSS, semantic colour tokens, dark mode                                                                        |
| [`mobile-ui-token-contract.md`](dev/mobile-ui-token-contract.md)                     | mobile theme ↔ web token parity                                                                                             |
| [`frontend-accessibility.md`](dev/frontend-accessibility.md)                         | a11y checklist                                                                                                              |
| [`tools-principles.md`](dev/tools-principles.md)                                     | what belongs on a tools page                                                                                                |
| [`budgeting-and-open-banking.md`](dev/budgeting-and-open-banking.md)                 | statement import, categorization, the Plaid stub                                                                            |
| [`error-reporting.md`](dev/error-reporting.md)                                       | Sentry setup and sampling                                                                                                   |
| [`encoding-and-user-display.md`](dev/encoding-and-user-display.md)                   | mojibake normalization — a real correctness rule                                                                            |
| [`exercise-answer-integrity.md`](dev/exercise-answer-integrity.md)                   | answer-position and option-length tells, the rewrite pipeline's gates, and the **RO re-translation owed after any rewrite** |
| [`DEV_NOTES.md`](dev/DEV_NOTES.md)                                                   | mobile LAN-IP dev tip                                                                                                       |
| [`railway-test-service.md`](dev/railway-test-service.md)                             | the separate Railway test service                                                                                           |
| [`typescript-strictness.md`](dev/typescript-strictness.md)                           | **PLAN, not started** — `strict` is off                                                                                     |
| [`mobile-simplification-roadmap.md`](dev/mobile-simplification-roadmap.md)           | PLAN — deferred mobile bets                                                                                                 |
| [`mobile-user-testing-qa.md`](dev/mobile-user-testing-qa.md)                         | evergreen manual QA template                                                                                                |
| [`ios-yearly-trial-sandbox-checklist.md`](dev/ios-yearly-trial-sandbox-checklist.md) | evergreen sandbox trial template                                                                                            |
| [`customer-io-journeys-setup.md`](dev/customer-io-journeys-setup.md)                 | PLAN — CIO dashboard config                                                                                                 |
| [`missions-pool-and-randomization.md`](dev/missions-pool-and-randomization.md)       | **SUPERSEDED** by `ux/missions-audit-2026-08.md`                                                                            |

## audit/, banking/, ux/, notifications/ — active workstreams

| Doc                                                                              | Status                                                                                                                                                   |
| -------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`audit/platform-audit-2026-08.md`](audit/platform-audit-2026-08.md)             | **CURRENT.** Sprint 1 shipped (Django 5.2, pins, health gate); §1–§5 open                                                                                |
| [`audit/security-latency-2026-08.md`](audit/security-latency-2026-08.md)         | **CURRENT.** Access-control sweep + latency audit, 2026-08-19. Phase 1 shipped; Phase 2 proposed. Verdict: no IDOR, cache proven safe, 4 real fixes made |
| [`audit/growth-audit-2026-10.md`](audit/growth-audit-2026-10.md)                 | **CURRENT PLAN.** SEO + ASO + AI search + signup funnel, 2026-10-02. Supersedes the priority order of `seo/README.md` and `aso/aso-audit-2026-07-07.md`  |
| [`banking/open-banking-plan.md`](banking/open-banking-plan.md)                   | PLAN — abstraction built, Plaid is a stub, default disabled                                                                                              |
| [`ux/missions-audit-2026-08.md`](ux/missions-audit-2026-08.md)                   | PLAN — partial; open items listed in the doc                                                                                                             |
| [`ux/UX_ONBOARDING_MONETIZATION_PLAN.md`](ux/UX_ONBOARDING_MONETIZATION_PLAN.md) | PLAN — paywall-placement lever built, default unchanged                                                                                                  |
| [`notifications/audit-2026-07-22.md`](notifications/audit-2026-07-22.md)         | PLAN — needs a live account to verify                                                                                                                    |
| [`analytics/skill-intent-funnels.md`](analytics/skill-intent-funnels.md)         | CURRENT — funnel event reference                                                                                                                         |

## prod/ — running it

| Doc                                                                                                                                                                         | Status                                                   |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| [`prod/railway-production-runbook.md`](prod/railway-production-runbook.md)                                                                                                  | CURRENT — backend release procedure                      |
| [`prod/subscription-matrix.md`](prod/subscription-matrix.md)                                                                                                                | CURRENT — **source of truth for plan gating and prices** |
| [`prod/billing-parity-runbook.md`](prod/billing-parity-runbook.md)                                                                                                          | CURRENT — RevenueCat-first model                         |
| [`prod/pre-release-checklist.md`](prod/pre-release-checklist.md)                                                                                                            | evergreen per-deploy gate                                |
| [`prod/monitoring-red-flags.md`](prod/monitoring-red-flags.md)                                                                                                              | CURRENT — metric thresholds                              |
| [`prod/cloudflare-public-api-cache.md`](prod/cloudflare-public-api-cache.md)                                                                                                | PLAN — **not applied**, ~2 min of dashboard work         |
| [`prod/railway-database-connection.md`](prod/railway-database-connection.md)                                                                                                | CURRENT                                                  |
| [`prod/production-recaptcha.md`](prod/production-recaptcha.md)                                                                                                              | CURRENT (rewritten 2026-08-18 for Vite)                  |
| [`prod/recaptcha-enterprise-config.md`](prod/recaptcha-enterprise-config.md)                                                                                                | CURRENT                                                  |
| [`prod/cookie-consent-legal.md`](prod/cookie-consent-legal.md)                                                                                                              | CURRENT                                                  |
| [`prod/android-credentials-checklist.md`](prod/android-credentials-checklist.md)                                                                                            | PLAN — 54/64 done                                        |
| [`prod/ios-platforms-expansion-runbook.md`](prod/ios-platforms-expansion-runbook.md)                                                                                        | PLAN — untouched                                         |
| [`prod/deployment-docker.md`](prod/deployment-docker.md)                                                                                                                    | STALE — prod is Railway; still valid for self-hosting    |
| [`prod/aso-1.1.5.md`](prod/aso-1.1.5.md)                                                                                                                                    | STALE version, but the current store-copy pack           |
| [`prod/google-oauth-consent-screen.md`](prod/google-oauth-consent-screen.md)                                                                                                | Current                                                  |
| [`prod/stripe-statement-descriptor.md`](prod/stripe-statement-descriptor.md) · [`prod/stripe-plan-descriptions-and-assets.md`](prod/stripe-plan-descriptions-and-assets.md) | STALE — predate RevenueCat-first                         |

## seo/, aso/, promo/, release/ — growth and shipping

| Doc                                                                        | Status                                              |
| -------------------------------------------------------------------------- | --------------------------------------------------- |
| [`seo/README.md`](seo/README.md)                                           | phase index 1–6                                     |
| [`seo/phase-1-critical-fixes.md`](seo/phase-1-critical-fixes.md)           | **ARCHIVED — done**                                 |
| [`seo/phase-2-app-stores-aso.md`](seo/phase-2-app-stores-aso.md)           | **ARCHIVED — A1 resolved**                          |
| [`seo/android-launch-checklist.md`](seo/android-launch-checklist.md)       | **ARCHIVED — obsolete**                             |
| [`seo/phase-2-aso-copy.md`](seo/phase-2-aso-copy.md)                       | SUPERSEDED by `prod/aso-1.1.5.md`                   |
| [`seo/phase-3-schema-entities.md`](seo/phase-3-schema-entities.md)         | PLAN — needs live-URL check                         |
| `seo/phase-4/-5/-6` (+ `*-todo.md`)                                        | PLAN — code plumbing shipped, editorial open        |
| [`aso/aso-audit-2026-07-07.md`](aso/aso-audit-2026-07-07.md)               | PLAN — store-side, 55/100                           |
| [`aso/play-listing-assets-2026-07.md`](aso/play-listing-assets-2026-07.md) | SUPERSEDED                                          |
| [`promo/60-off-launch-checklist.md`](promo/60-off-launch-checklist.md)     | CURRENT — `summer60` to 2026-08-31, **yearly only** |
| [`release/1.1.7-runbook.md`](release/1.1.7-runbook.md)                     | PLAN — per-release. No 1.1.8 runbook exists yet     |
| [`geo-offsite-kit.md`](geo-offsite-kit.md)                                 | PLAN — off-repo assets                              |
| [`customer-io-overhaul.md`](customer-io-overhaul.md)                       | SUPERSEDED by `notifications/audit-2026-07-22.md`   |

## Known duplication

Three store-copy packs, three Customer.io docs, four billing docs, four setup paths, four release
checklists. Merge candidates are listed in
[`../.claude/context/docs-map.md`](../.claude/context/docs-map.md).

## Conventions for new docs

- Put it in the right directory: `dev/` = standing guide · `prod/` = operations · everything else
  is a dated audit or plan.
- Date every plan and audit in the filename or the first line.
- Add a row here and in `.claude/context/docs-map.md`.
- When the work lands, add a status banner at the top rather than deleting the doc — the reasoning
  is usually worth keeping, the open-work framing is not.

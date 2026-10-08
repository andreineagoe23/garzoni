# Garzoni — product documentation

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

## Who it is for

- **Young adults getting started with money** — students, graduates and early-career people who
  were never taught budgeting, credit or investing at school. Lessons assume no prior knowledge.
- **UK first.** Examples, amounts and tax/banking lessons are written for the UK (pounds, ISAs,
  National Insurance, the FSCS). Prices are in GBP.
- **Romania second.** The app and website are fully available in Romanian, and most lessons are
  translated. Some UK-specific lessons still describe UK rules in Romanian — see
  [Known gaps](#known-gaps-across-the-product).

It is an **education** product, not financial advice: no regulated advice, no account aggregation
in production, no money movement.

## Where it runs

| Surface            | What                                                                           | Status                                     |
| ------------------ | ------------------------------------------------------------------------------ | ------------------------------------------ |
| **iOS app**        | "Garzoni: Learn Money & Finance" on the App Store (iOS 15.1+)                  | Live, 1.2.0; 1.2.1 built, not yet released |
| **Android app**    | Same app on Google Play (`app.garzoni.mobile`)                                 | Live, 1.2.0                                |
| **Web app**        | Full learning app in the browser at [www.garzoni.app](https://www.garzoni.app) | Live                                       |
| **Public website** | Landing page, free lessons, guides and calculators, in English and Romanian    | Live                                       |

One Django API serves all of them, and accounts, progress and subscriptions are shared across
devices. Web and mobile are built separately, so some features exist on one platform only — each
module page says which.

## Plans

| Plan        | Price                      | What it adds                                                                                                                                     |
| ----------- | -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Starter** | Free                       | Free learning paths (limited by hearts), a preview of the Personalized Path, 5 AI tutor messages a day, 3 AI explanations of wrong answers a day |
| **Plus**    | £6.99/month or £59.99/year | All paths, 50 AI messages a day, the full Personalized Path and AI coach brief, analytics, the Plus tools                                        |
| **Pro**     | £7.99/month or £69.99/year | Everything in Plus, 200 AI messages a day, voice tutor and receipt scan on mobile                                                                |

Yearly plans have a 7-day free trial. Subscriptions run through RevenueCat everywhere (App Store
and Google Play on mobile, Stripe-backed Web Billing on the web), so a plan bought on one platform
works on the others. Full detail: [Plans and billing](plans-and-billing.md).

## Modules

| Module                                    | What it covers                                                                                                                                                               |
| ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Learning](learning.md)                   | Learning paths, courses and lessons, quizzes, exercises, review and mastery, onboarding and the Personalized Path                                                            |
| [AI features](ai.md)                      | The AI tutor, explanations of wrong answers, coach brief, smart resume, voice tutor, receipt scan, AI nudges, lesson search                                                  |
| [Engagement](engagement.md)               | XP, streaks, daily and weekly missions, leagues and leaderboards, friends, duels, badges, coins and the rewards shop, referrals                                              |
| [Tools](tools.md)                         | In-app money tools (budget planner, savings goals, portfolio analyser, reality check, calendars and market tools, Personal CFO, statement import) and the public calculators |
| [Plans and billing](plans-and-billing.md) | Plans, prices, what each unlocks, how buying works on each platform                                                                                                          |
| [Notifications](notifications.md)         | Push, email and in-app messages: what is sent, when, and how people control it                                                                                               |
| [Website](website.md)                     | The public site: pages, how visitors become users, SEO and AI-search infrastructure, analytics                                                                               |
| [Accounts and support](accounts.md)       | Sign-up and login, onboarding, profile and settings, language, deletion, support and feedback, admin tools                                                                   |
| [Platform](platform.md)                   | Architecture, services, hosting, environments, translations and content operations                                                                                           |

## The product in numbers

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

## Known gaps across the product

The module pages list their own gaps. The ones that cut across everything:

- **Some public lessons contain outdated or wrong UK figures** (for example the FSCS limit and a
  National Insurance example). A full list with sources is in
  [`docs/content/eeat-drafts-2026-10.md`](../content/eeat-drafts-2026-10.md).
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

## Related documentation

- [`docs/README.md`](../README.md) — index of all docs (developer guides, audits, runbooks).
- [`docs/dev/architecture.md`](../dev/architecture.md) — deeper architecture notes.
- [`docs/prod/subscription-matrix.md`](../prod/subscription-matrix.md) — the plan-gating source of truth.
- [`docs/audit/growth-audit-2026-10.md`](../audit/growth-audit-2026-10.md) — current growth plan.

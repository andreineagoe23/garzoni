# Architecture overview

Garzoni is a pnpm-monorepo SPA + native app + API + workers, with an AI tutor layer powered by OpenAI and pgvector.

## Components

- **Web (`frontend/`)** — React 19 + Vite + Tailwind, served by Vercel.
- **Mobile (`mobile/`)** — Expo SDK 54 (React Native), distributed via App Store / Play Store. RevenueCat for IAP.
- **Shared core (`packages/core/`)** — TypeScript: API client (axios), services (auth, AI tutor, entitlements), hooks, types, i18n locales (EN + RO). Imported by both `frontend` and `mobile`.
- **Backend (`backend/`)** — Django 5.2 LTS + DRF, Gunicorn, hosted on Railway. JSON API + Django admin.
- **PostgreSQL** — Primary datastore; **pgvector** extension for AI semantic search.
- **Redis** — Celery broker + Django cache (entitlement counters, conversation summary triggers, AI nudge rate limits).
- **Celery worker + beat** — Background jobs: weekly digests, streak resets, transactional emails, AI nudge generation, embedding backfill, daily personalized-path re-eval.

## Diagram

```mermaid
flowchart LR
  U[User Browser] -->|HTTP| FE[Web SPA - Vercel]
  M[Mobile App - Expo] -->|HTTP| BE
  FE -->|/api| BE[Django + Gunicorn - Railway]

  BE -->|SQL| DB[(PostgreSQL + pgvector)]
  BE -->|enqueue| R[(Redis)]
  CW[Celery Worker] -->|consume| R
  CW -->|SQL| DB
  CB[Celery Beat] -->|schedule| R

  BE -->|chat, embeddings, Whisper, TTS, vision| OAI[OpenAI API]
  BE -->|payments, webhooks| STRIPE[Stripe]
  M -->|IAP entitlements| RC[RevenueCat]
  RC -->|webhooks| BE
  BE -->|push, email, CDP events| CIO[Customer.io]
  M -->|push| EXPO[Expo Push]
  BE -->|errors| SENTRY[Sentry]
  FE -->|events| AMP[Amplitude]
```

## Tech stack

| Layer          | Tech                                                                                                                        |
| -------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Web            | React 19, TypeScript, Vite 6, Tailwind 3.4 + SCSS, React Router v7                                                          |
| Mobile         | Expo SDK 54, React Native 0.81, Expo Router, expo-av (voice), expo-image-picker (scan), react-native-purchases (RevenueCat) |
| Shared         | TypeScript core package (axios client, React Query helpers, i18next)                                                        |
| State          | Zustand (client), React Query (server), React Context (theme, auth)                                                         |
| UI system      | Custom glass morphism: GlassCard, GlassContainer, GlassButton                                                               |
| Animation      | Framer Motion, Three.js (landing globe), Lottie, Canvas Confetti                                                            |
| Rich text      | CKEditor 5 (lessons), react-native-render-html (mobile)                                                                     |
| i18n           | i18next (EN + RO); locale source-of-truth in `packages/core/src/locales/`                                                   |
| Backend        | Django 5.2 LTS, DRF 3.17, Celery 5.4, Redis 5, PostgreSQL 17, pgvector (pinned, not yet adopted)                            |
| AI             | OpenAI Python SDK (gpt-4o-mini, gpt-4o, text-embedding-3-small, whisper-1, tts-1, gpt-4o vision)                            |
| Auth           | JWT (simplejwt), Google OAuth (web + mobile), Sign in with Apple (mobile), reCAPTCHA Enterprise on sensitive endpoints      |
| Payments       | Stripe (web), RevenueCat → Apple/Google IAP (mobile)                                                                        |
| Comms          | Customer.io (CDP + transactional + push), Resend (email), Expo Push                                                         |
| Observability  | Sentry (web + Django), Amplitude (web analytics)                                                                            |
| Deploy         | Vercel (web), Railway (backend, Postgres, Redis), App Store / Play Store (mobile)                                           |
| Static / media | WhiteNoise (Django statics); Cloudinary (lesson images, avatars)                                                            |

## Key directories

```
garzoni/
  frontend/src/
    components/    # 141+ React components
    contexts/      # ThemeContext, AuthContext, AdminContext
    hooks/         # Web-specific hooks
    routes/        # AppShell, AppRoutes
  mobile/
    app/           # Expo Router screens (chat, voice-chat, scan, lessons, dashboard)
    src/
      components/  # RN components
      theme/       # ThemeContext (mirrors web tokens)
  packages/core/src/
    services/      # httpClient, aiTutor, authService, entitlementsService, userService, analytics*
    hooks/         # Shared React Query hooks
    stores/        # Zustand (progress, hearts) + platform-agnostic storage adapter
    lib/           # reactQuery keys, personalizedPath, courseProgress, primaryCtaSelector
    types/         # API types
    locales/{en,ro}/  # i18n source-of-truth (common.json, shared.json, courses.json)
  packages/tokens/src/  # Spacing/radius/type scale (the only strict-mode package)
  backend/
    authentication/  # User, UserProfile, JWT, Apple/Google OAuth, entitlements, hearts, friends, RevenueCat
    education/       # Paths, courses, lessons, exercises, Mastery + SRS, translations, ContentEmbedding (RAG)
    gamification/    # XP, missions, badges, streaks, duels, wagers, leagues
    finance/         # Stripe billing, portfolio, paper trading, FunnelEvent, market-data proxies
    budgeting/       # Personal CFO: statement import, categorization, envelopes, open-banking abstraction
    support/         # AI conversation persistence, OpenAI service with tools, voice + scan endpoints, smart resume
    onboarding/      # QuestionnaireProgress (financial profile capture)
    notifications/   # Customer.io, Expo push, transactional email, Celery senders
    core/            # Health check, robots/AASA, middleware, logging (no models — slated for removal)
    settings/        # Project settings, root urls, Celery app
    tests/           # Cross-app tests
  docs/              # This directory
  .claude/context/   # Verified state of each surface + per-feature status tracker
```

> There is no `reports/` app — it was removed. `budgeting/` is the newest and most active app;
> see [`budgeting-and-open-banking.md`](budgeting-and-open-banking.md).

## AI tutor architecture

The AI tutor is a stateful agent layer wrapping OpenAI:

```mermaid
flowchart TD
  U[User] -->|prompt| API[/api/proxy/openai/]
  API -->|load| MEM[Conversation + Message<br/>Postgres]
  API -->|build system prompt| SYS[Education context:<br/>mastery, course, goals]
  API -->|chat.completions w/ tools| OAI[OpenAI]
  OAI -->|tool_calls| TOOLS[Tool dispatcher]
  TOOLS -->|get_user_progress| DB[(Postgres)]
  TOOLS -->|get_weak_skills| DB
  TOOLS -->|get_financial_profile| DB
  TOOLS -->|recommend_next_lesson| DB
  TOOLS -->|generate_practice_question| OAI2[OpenAI]
  TOOLS -->|lookup_lesson| RAG[pgvector cosine sim]
  RAG -->|results| OAI
  OAI -->|final answer| API
  API -->|persist| MEM
  API -->|response| U
```

- **Tools**: `support/services/tools.py` defines 6 function-calling tools.
- **System prompts**: centralised in `support/prompts/tutor.py` with a `PROMPT_VERSION` for cache-busting.
- **Persistent memory**: `support.Conversation` + `support.Message` (one conversation per user × source); rolling summary above 3k tokens.
- **Quotas**: per-plan daily cap (5 / 50 / 200) + per-user daily token budget (Redis).
- **Model tiering**: `gpt-4o-mini` for Free/Plus, `gpt-4o` for Pro.
- **RAG**: lesson + course content embedded with `text-embedding-3-small`, stored in `education.ContentEmbedding` (**JSONField + Python cosine loop** — `pgvector==0.5.0` is
  pinned but no `VectorField` exists anywhere; the migration was never done).

## Reading order for new contributors

1. Top-level [`README.md`](../../README.md)
2. This file
3. [`.claude/context/00-overview.md`](../../.claude/context/00-overview.md) — orientation + the facts that surprise people
4. [`environment.md`](environment.md) — env vars
5. [`setup-local.md`](setup-local.md) or [`setup-docker.md`](setup-docker.md) — local dev
6. [`../prod/subscription-matrix.md`](../prod/subscription-matrix.md) — entitlements and prices
7. [`spacing-contract.md`](spacing-contract.md) + [`frontend-styling.md`](frontend-styling.md) — before touching any UI
8. [`.claude/context/feature-status.md`](../../.claude/context/feature-status.md) — what is actually built
9. [`../audit/platform-audit-2026-08.md`](../audit/platform-audit-2026-08.md) — open debt

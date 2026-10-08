# Garzoni: Gamified Financial Learning Platform

Garzoni teaches personal finance in short, gamified lessons — budgeting, saving, investing, credit,
debt and taxes — with a daily streak, missions and leagues, an AI tutor that knows each learner's
progress, and practical money tools. It is built for young adults, UK first, with a full Romanian
version. It runs on iOS, Android and the web ([www.garzoni.app](https://www.garzoni.app)), on one
Django API.

**Plans:** Starter (free) · Plus £6.99/month or £59.99/year · Pro £7.99/month or £69.99/year, with a
7-day trial on yearly plans. Subscriptions run through RevenueCat on every platform.

## Product documentation

What Garzoni does today, module by module — what it is, how it works, which plan and platform, where
it lives in the code, and what is unfinished — is in **[`docs/`](docs/README.md)**:

| Module                                              |                                                                            |
| --------------------------------------------------- | -------------------------------------------------------------------------- |
| [Overview](docs/README.md)                          | What Garzoni is, who it's for, plans, numbers, cross-cutting gaps          |
| [Learning](docs/dev/learning.md)                    | Paths, courses, lessons, quizzes, exercises, review, Personalized Path     |
| [AI features](docs/dev/ai.md)                       | Tutor, explanations, coach brief, voice, receipt scan, lesson search       |
| [Engagement](docs/ux/engagement.md)                 | XP, streaks, missions, leagues, friends, duels, badges, rewards, referrals |
| [Tools](docs/dev/tools.md)                          | In-app money tools and the public calculators                              |
| [Plans and billing](docs/prod/plans-and-billing.md) | Plans, prices, entitlements, purchasing per platform                       |
| [Notifications](docs/notifications/overview.md)     | Push, email and in-app messaging                                           |
| [Website](docs/seo/website.md)                      | Public site, SEO and AI-search infrastructure, attribution                 |
| [Accounts and support](docs/dev/accounts.md)        | Sign-up, onboarding, settings, support, admin                              |
| [Platform](docs/dev/architecture.md)                | Architecture, hosting, deploys, translations, content operations           |

Developer guides, runbooks and audits are indexed in [`docs/README.md`](docs/README.md).

## Tech Stack

- **Monorepo**: pnpm workspaces. Packages: `frontend` (web), `mobile` (Expo), `packages/core` (shared TypeScript: API client, services, hooks, i18n).
- **Frontend (web)**: React + Vite + Tailwind. Tested with Vitest.
- **Mobile**: Expo (SDK 54), React Native, Expo Router. RevenueCat for IAP. expo-av (voice), expo-image-picker (receipt scan).
- **Backend**: Django 5.2 LTS + DRF, PostgreSQL 17, Redis, Celery (Celery Beat for scheduled jobs; in production Beat reads the `PeriodicTask` table, not the static schedule).
- **AI / RAG**: OpenAI Python SDK (chat, embeddings, Whisper, TTS, GPT-4o vision). `pgvector` for semantic search over lesson content.
- **Auth**: JWT via djangorestframework-simplejwt; Google OAuth; Sign in with Apple.
- **Payments**: RevenueCat across all platforms — RevenueCat Web Billing (Stripe-backed) on web, App Store / Play Store IAP on mobile. The web RC SDK is enabled by `VITE_REVENUECAT_API_KEY`; if unset, web falls back to the legacy direct-Stripe checkout. See [docs/prod/billing-parity-runbook.md](docs/prod/billing-parity-runbook.md).
- **Comms**: Customer.io (CDP + transactional email + push), Resend (email transport), Expo Push.
- **Observability**: Sentry (web + Django), Amplitude (web analytics).
- **Hosting**: Vercel (web), Railway (backend), Cloudinary (media).

## Getting Started

### Clone

```bash
git clone https://github.com/andreineagoe23/garzoni.git
cd garzoni
pnpm install
```

### Docker (recommended for backend)

See [docs/dev/setup-docker.md](docs/dev/setup-docker.md).

### Backend (API)

```bash
cd backend
python -m venv venv
source venv/bin/activate    # Windows: venv\Scripts\activate
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver
```

- Set `DATABASE_URL` (PostgreSQL) for local and production. CI uses a Postgres service container for backend tests.
- Celery/Redis are optional in local dev; enable when running scheduled tasks (path re-eval, AI nudges, embedding backfill).
- **For RAG / AI tutor**: set `OPENAI_API_KEY` and run `CREATE EXTENSION IF NOT EXISTS vector;` on your Postgres DB. Then trigger an embedding backfill via the `backfill_embeddings_async` Celery task or a management command.
- Environment variables: see [docs/dev/environment.md](docs/dev/environment.md) (Railway, Vercel, local).

#### Backend tests

- When using Docker (recommended), run backend tests via:

  ```bash
  make backend-test      # runs Django tests inside the backend container
  make test-all          # backend lint + backend tests + frontend tests (requires dev stack up)
  ```

> **Backend tests only run inside the container.** Start the stack with `make dev` first.
> Running `python manage.py test` on the host is not supported — the test settings expect the
> container's Postgres and Redis. Single test:
> `docker compose exec backend python manage.py test education.tests.TestX`

### Web (Vite)

```bash
pnpm --filter @garzoni/web dev
# or, equivalently:
pnpm dev:web
```

- Set `VITE_BACKEND_URL` (or legacy `REACT_APP_BACKEND_URL`) to your API base if it is not same-origin (must end with `/api` or be the site origin without `/api`; it is normalized).
- Build for production with `pnpm --filter @garzoni/web build`.

### Mobile (Expo)

```bash
pnpm --filter @garzoni/mobile start
# or:
pnpm dev:mobile
```

- Configure `app.json` / `app.config` for your bundle ID and OAuth schemes.
- Set `RevenueCat` API keys (iOS + Android) and bind product IDs that match your App Store / Play Store offerings.
- For Google OAuth native flows, register the redirect URI (e.g. `com.garzoni.app:/oauth2redirect/google`) in Google Cloud.
- Voice tutor needs `expo-av`; receipt scan needs `expo-image-picker` (both already in `package.json`).

### Pre-commit checks

`pnpm precommit` runs (and is wired into the husky pre-commit hook):

1. `pnpm typecheck` — TypeScript across `core`, `web`, and `mobile`.
2. `pnpm lint` — ESLint on the web app.
3. `pnpm --filter @garzoni/web format:check` — Prettier.
4. `pnpm --filter @garzoni/web test` — Vitest (includes i18n key coverage).

The husky hook also runs Black + flake8 against `backend/` if installed.

## Deployment Notes

- Docker deployment guide: [docs/prod/deployment-docker.md](docs/prod/deployment-docker.md)
- Railway production runbook: [docs/prod/railway-production-runbook.md](docs/prod/railway-production-runbook.md) (pre-deploy sync for lessons + exercises; missions: `./backend/scripts/railway_push_missions.sh`).
- **Mobile (Expo):** For Google OAuth native flows, add your app's authorised redirect URI in Google Cloud (e.g. `com.garzoni.app:/oauth2redirect/google` or the value from `app.json` / `app.config` `scheme`). Keep web callback URLs (`https://www…/api/auth/google/callback`) as well.

- Frontend on **Vercel**: `frontend/vercel.json` (and root `vercel.json` if you deploy from the monorepo root) includes a **CDN rewrite** as the first rule: `/api/:path*` → your Django host (see the `destination` URL). Order matters: API proxy first, then the SPA fallback that excludes `/api`. Change the Railway URL in both files when you use a different backend. Omit `VITE_BACKEND_URL` / `REACT_APP_BACKEND_URL` in Vercel if you want the browser to call same-origin `/api` (proxied). For **Google OAuth (redirect flow)**, add every callback URL you use to **Authorised redirect URIs** in Google Cloud — e.g. both `https://www.<your-domain>/api/auth/google/callback` (via the proxy) and `https://<your-railway-host>/api/auth/google/callback` if Django ever issues that host, so you avoid `redirect_uri_mismatch`.
- Frontend: Vercel-friendly static build (`pnpm --filter @garzoni/web build`).
- Backend: WSGI-compatible (Railway / any Docker host). Configure `ALLOWED_HOSTS`, CORS/CSRF origins, `SECRET_KEY`, DB credentials, Stripe keys, OpenAI key, Customer.io keys, reCAPTCHA, and email settings via environment variables.
- Static files served by WhiteNoise; media served from Cloudinary in production.

## Security & Operations

- Keep secrets in environment variables; do not commit credentials. Rotate any previously committed keys.
- For production backups: use `backend/scripts/backup_postgres.sh` (see the script for usage and restore instructions).
- Use HTTPS and restrict `CORS_ALLOWED_ORIGINS` / `CSRF_TRUSTED_ORIGINS` to trusted domains.
- JWTs: access tokens via Authorization header; configure lifetimes in `SIMPLE_JWT`.
- AI tutor has per-plan daily quotas + per-user daily token budget (Redis-backed) to bound OpenAI spend.
- Run dependency checks regularly (pip-audit, `pnpm audit`) and keep `requirements.txt` / `pnpm-lock.yaml` updated.
- Every backend requirement is `==`-pinned and CI fails the build on any unpinned line; `pip-audit` and `pnpm audit` run in CI (`.github/workflows/ci.yml`).

## Architecture overview

```
backend/
  authentication/        # User, UserProfile, JWT, Apple/Google OAuth, entitlements, hearts, friends, RevenueCat webhook
  education/             # Paths, courses, lessons, exercises, Mastery + SRS, translations, ContentEmbedding (RAG)
  gamification/          # XP, missions, badges, streaks, duels, wagers, leagues
  finance/               # Stripe billing, portfolio, paper trading, FunnelEvent, market-data proxies
  budgeting/             # Personal CFO: statement import, categorization, envelopes, open-banking abstraction
  support/               # AI conversation persistence, OpenAI service with tools, voice + scan endpoints, smart resume
  onboarding/            # Versioned questionnaire, plan summary
  notifications/         # Customer.io, Expo push, transactional email, Celery senders
  core/                  # Health check, robots/AASA, middleware, logging (no models — slated for removal)
  settings/              # Project settings, root urls, Celery app
  tests/                 # Cross-app tests

frontend/src/            # React web app (Vite + Tailwind)
mobile/app/              # Expo Router app (iOS + Android) — chat, voice-chat, scan, lessons, dashboard, tools
packages/core/           # Shared TypeScript: API client, services, hooks, stores, types, i18n locales
packages/tokens/         # Spacing/radius/type scale — single source for web + mobile
docs/                    # Dev guides + audits (see docs/README.md)
.claude/                 # Agent context pack, subagents, slash commands
```

> Backend app detail, feature flags and Celery schedule: [.claude/context/backend.md](.claude/context/backend.md).
> Per-feature status across web + mobile: [.claude/context/feature-status.md](.claude/context/feature-status.md).

## Contributing

Pull requests are welcome. Please open an issue for major changes first to discuss what you would like to modify. Ensure lint/tests pass before submitting (run `pnpm precommit` locally — the husky hook will block bad commits anyway).

### Pre-commit hooks (run on every `git commit`)

To run Black (backend), pre-commit-hooks, and detect-secrets automatically on each commit:

```bash
# From repo root, once per clone:
python3 -m venv .venv
source .venv/bin/activate   # or .venv\Scripts\activate on Windows
pip install -r backend/requirements-dev.txt
pre-commit install
```

After that, every `git commit` will run these checks; if Black reformats files, the commit will fail until you `git add` the changes and commit again. The JS/TS side of the hook is already wired via husky and runs `pnpm precommit` (typecheck + lint + format + Vitest).

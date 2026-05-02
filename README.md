# Garzoni: Gamified Financial Learning Platform

Garzoni delivers interactive personal finance education with gamified progression and an AI-powered finance tutor. Users complete learning paths, earn badges, compete on leaderboards, and explore finance tools across budgeting, investing, and trading — on web and mobile.

## What you can do in the app

### Account and settings

- **Register and log in** (email/password, Google OAuth, Sign in with Apple on iOS), reset password, and sign out.
- **Profile**: View username, avatar, points, streak, earned coins, activity calendar, goals (daily/weekly), badges, recent activity, and entitlement usage. Update avatar and jump to Personalized Path or Subscriptions.
- **Settings**: Update profile (name, username, email), preferences (email reminders, lesson sounds, animations), change password, manage privacy links (cookie policy, privacy policy, financial disclaimer), and delete account.
- **Billing**: Manage subscription (Starter / Plus £7.99–£69 / Pro £11.99–£79), 7-day trial on yearly plans, view trial end, and access payment history (Stripe on web, RevenueCat for in-app purchases on mobile).

### Learning

- **Dashboard (All Topics)**: Browse learning paths and topics, see daily goal and status (courses completed, progress, reviews due, missions). Get a primary CTA (e.g. continue lesson, do reviews, start mission). View weak skills and onboarding questionnaire reminder. Mobile shows a daily AI **Smart Resume** nudge with the single most valuable thing to do next.
- **Personalized Path 2.0**: A living, AI-ranked plan based on your onboarding, mastery scores, and recent activity. Re-evaluated daily (with hash-based short-circuit to avoid wasted LLM calls). Plus/Pro users see per-course AI reasoning and a **Weekly Coach Brief** — a written 3-paragraph note covering what they accomplished, what to focus on, and a micro-goal for the week.
- **Courses and lessons**: Open a path (e.g. Basic Finance, Forex, Crypto, Real Estate, Budgeting), view courses and lessons, and start a lesson flow. Complete lessons with video/content and in-lesson sections.
- **Quizzes**: Take end-of-course quizzes (e.g. `/quiz/:courseId`) to reinforce learning.
- **Lesson flow**: Follow the full lesson experience (content, sections, next/back) and return to dashboard or course.

### Exercises and review

- **Exercises**: From the Exercises page, filter by type (Multiple Choice, Numeric, Drag and Drop, Budget Allocation, Fill in Table, Scenario Simulation) and category. Do standalone exercises, earn XP, and see skill feedback.
- **Inline AI explanations**: When you get an exercise wrong, Garzoni explains *why* using the Socratic method and offers a similar follow-up practice question — no leaving the lesson. Free users get 3 explanations/day; Plus/Pro: unlimited.
- **Review queue**: See due reviews and "next up" by skill; start a review session to strengthen retention.

### AI tutor

- **Chat tutor**: A persistent, context-aware assistant available across web and mobile. Conversations are stored server-side so history persists across sessions and devices. The tutor uses **OpenAI function-calling tools** to look up your real progress, weak skills, financial profile, and the lesson library — answers reference your actual data, not guesses.
- **Tiered models**: `gpt-4o-mini` for Free/Plus; `gpt-4o` for Pro.
- **Daily quotas**: Free 5 prompts/day, Plus 50/day, Pro 200/day.
- **Voice tutor (Pro, mobile)**: Hold to record → Whisper transcription → GPT answer → spoken reply via OpenAI TTS.
- **Receipt / statement scan (Pro, mobile)**: Photograph a receipt → GPT-4o vision returns category breakdown, an insight, an actionable tip, and a recommended Garzoni lesson matched via semantic search.
- **AI push nudges**: Personalised daily pushes generated from your streak, weakest skill, and plan tier (delivered via Customer.io).
- **RAG over curriculum**: All lesson and course content is embedded with `text-embedding-3-small`; the tutor uses semantic search to recommend the most relevant lesson when you ask about a topic.

### Missions and streak

- **Daily missions**: See up to 4 daily missions (e.g. complete 1 lesson, save £10 today, read finance fact). Track progress, complete missions for XP, and swap one mission per day if needed.
- **Weekly missions**: See up to 4 weekly missions (e.g. pathfinder, save £100 this week, finance fact fanatic). Complete for larger XP rewards.
- **Streak**: Track streak days and total XP today; use streak freeze/boost items from the rewards shop when available.

### Tools

- **Portfolio Analyzer**: Analyze portfolio allocation and returns; link to investing lessons; export (when entitled).
- **Goals Reality Check**: Check savings goals against reality; link to saving lessons.
- **Economic Calendar**: View macro events and dates; link to macro topics.
- **Economic Map** (Plus/Pro): Explore global economic data.
- **News & Market Context** (Plus/Pro): Get news and market context.
- **Market Explorer** (Plus/Pro): Explore stocks, ETFs, crypto, indices.
- **Next Steps Engine**: Get 1–3 recommended next steps based on recent activity and level.

### Engagement and rewards

- **Leaderboards**: Compete on leaderboards and see rankings.
- **Rewards**: View coin balance; spend coins in the **shop** (e.g. streak freeze, streak boost); **donate** a portion of coins to causes. Some actions (e.g. downloads) may require Plus/Pro.
- **Badges**: Earn badges for achievements; view earned and locked badges on Profile.

### Support and feedback

- **Support (FAQ + contact)**: Search FAQ by category, expand answers, vote helpful/not helpful, and send a message via the contact form (topic: billing, technical, account, content, feedback, other).
- **Feedback**: From Support, open the Feedback page to report bugs or send feedback (type: bug, suggestion, other; optional "where"). Submissions are for logged-in users only.

### Legal and info

- **Subscriptions**: View plans (Starter, Plus, Pro), features, and pricing; start trial or subscribe.
- **Legal pages**: Privacy policy, cookie policy, terms of service, financial disclaimer (and no-financial-advice section). See [docs/LEGAL_ANALYSIS.md](docs/LEGAL_ANALYSIS.md) for the underlying data-flow analysis used to draft these.
- **Welcome / About**: Landing and product info; footer links to dashboard, exercises, missions, tools, leaderboards, rewards, support, subscriptions.

### Elsewhere

- **Onboarding questionnaire**: Complete the short questionnaire for personalized recommendations and rewards (XP/coins). Answers feed the AI personalized-path generator and tutor context.
- **Payment success / upgrade**: Dedicated pages after checkout or when payment is required for a feature.

(Admin-only: **Pricing dashboard** for conversion analytics when admin mode is enabled.)

## Premium value matrix

| Capability | Free (Starter) | Plus £7.99/mo | Pro £11.99/mo |
|---|---|---|---|
| Tutor chat (server-persisted history) | 5/day | 50/day | 200/day |
| Inline "explain wrong answer" + practice question | 3/day | unlimited | unlimited |
| Personalized Path 2.0 + daily re-plan | — | ✔ | ✔ |
| Weekly AI Coach Brief | — | ✔ | ✔ |
| Voice tutor (mobile) | — | — | ✔ |
| Receipt / statement scan (mobile) | — | — | ✔ |
| AI push nudges | basic streak | personalised | personalised + market-aware |
| Tutor model | gpt-4o-mini | gpt-4o-mini | **gpt-4o** |

## Features (summary)

- Personalized learning paths (Basic Finance, Forex, Crypto, Real Estate, Budgeting).
- Gamification: badges, streaks, leaderboards, rewards (coins, shop, donations).
- AI tutor with **function-calling tools**, persistent memory, RAG over curriculum, voice (mobile), receipt vision (mobile).
- Finance tools: portfolio analyzer, reality check, economic calendar, economic map, news/market context, market explorer, next steps (some tools Plus/Pro).
- Exercises: multiple choice, numeric, drag-and-drop, budget allocation, fill-in table, scenario simulation; review queue with inline AI explanations on wrong answers (see `docs/exercise-experience-plan.md`).
- Missions: 4 daily + 4 weekly (randomized from pool per day/week), swap, completion XP.
- Support hub: FAQ + contact form; feedback page for bugs and suggestions.

## Tech Stack

- **Monorepo**: pnpm workspaces. Packages: `frontend` (web), `mobile` (Expo), `packages/core` (shared TypeScript: API client, services, hooks, i18n).
- **Frontend (web)**: React + Vite + Tailwind. Tested with Vitest.
- **Mobile**: Expo (SDK 54), React Native, Expo Router. RevenueCat for IAP. expo-av (voice), expo-image-picker (receipt scan).
- **Backend**: Django 4.2 + DRF, PostgreSQL, Redis, Celery (with Celery Beat for scheduled AI nudges + path re-eval).
- **AI / RAG**: OpenAI Python SDK (chat, embeddings, Whisper, TTS, GPT-4o vision). `pgvector` for semantic search over lesson content.
- **Auth**: JWT via djangorestframework-simplejwt; Google OAuth; Sign in with Apple.
- **Payments**: Stripe (web) + RevenueCat (iOS/Android IAP).
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

See `docs/setup-docker.md`.

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
- Environment variables: see [docs/environment.md](docs/environment.md) (Railway, Vercel, local).

#### Backend tests

- When using Docker (recommended), run backend tests via:

  ```bash
  make backend-test      # runs Django tests inside the backend container
  make test-all          # backend lint + backend tests + frontend tests (requires dev stack up)
  ```

- When running the backend directly on your machine (no Docker), run tests from `backend/` with a configured `DATABASE_URL` pointing at a Postgres instance:

  ```bash
  cd backend
  python manage.py test
  ```

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

- Docker deployment guide: `docs/deployment-docker.md`
- Railway production runbook: `docs/railway-production-runbook.md` (pre-deploy sync for lessons + exercises; missions: `./backend/scripts/railway_push_missions.sh`).
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
- Dependabot is configured for **monthly grouped updates** (see `.github/dependabot.yml`) — patch bumps are skipped to reduce noise.

## Architecture overview

```
backend/
  authentication/        # User, UserProfile (financial profile fields), Apple/Google OAuth, password reset, account deletion
  finance/               # Stripe, paper trading, FunnelEvent, market-data proxies (CoinGecko, Alpha Vantage, ExchangeRate-API)
  notifications/         # Customer.io integration, push, transactional email, AI nudges Celery beat
  onboarding/            # QuestionnaireProgress (financial profile capture)
  education/             # Lessons, courses, Mastery, ContentEmbedding (RAG), PathPlan, AI tutor service
  support/               # AI conversation persistence (Conversation/Message), OpenAI service with tools, voice + scan endpoints, smart resume
  gamification/          # Streaks, hearts, missions, rewards
  reports/               # Internal reporting

frontend/src/            # React web app (Vite + Tailwind)
mobile/app/              # Expo Router app (iOS + Android) — chat, voice-chat, scan, lessons, dashboard
packages/core/           # Shared TypeScript: API client, services (aiTutor, entitlements), hooks, types, i18n locales
docs/                    # LEGAL_ANALYSIS.md, environment.md, exercise-experience-plan.md, etc.
```

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

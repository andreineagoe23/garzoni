# Monevo: Gamified Financial Learning Platform

Monevo delivers interactive personal finance education with gamified progression and AI tutoring. Users complete learning paths, earn badges, compete on leaderboards, and explore finance tools across budgeting, investing, and trading.

## What you can do in the app

### Account and settings

- **Register and log in** (email/password or Google OAuth), reset password, and sign out.
- **Profile**: View username, avatar, points, streak, earned coins, activity calendar, goals (daily/weekly), badges, recent activity, and entitlement usage. Update avatar and jump to Personalized Path or Subscriptions.
- **Settings**: Update profile (name, username, email), preferences (email reminders, lesson sounds, animations), change password, manage privacy links (cookie policy, privacy policy, financial disclaimer), and delete account.
- **Billing**: Manage subscription (Starter/Plus/Pro), view trial end, and access payment history from the Subscription Manager.

### Learning

- **Dashboard (All Topics)**: Browse learning paths and topics, see daily goal and status (courses completed, progress, reviews due, missions). Get a primary CTA (e.g. continue lesson, do reviews, start mission). View weak skills and onboarding questionnaire reminder.
- **Personalized Path**: See a tailored learning path and progress; jump into courses and lessons from one place.
- **Courses and lessons**: Open a path (e.g. Basic Finance, Forex, Crypto, Real Estate, Budgeting), view courses and lessons, and start a lesson flow. Complete lessons with video/content and in-lesson sections.
- **Quizzes**: Take end-of-course quizzes (e.g. `/quiz/:courseId`) to reinforce learning.
- **Lesson flow**: Follow the full lesson experience (content, sections, next/back) and return to dashboard or course.

### Exercises and review

- **Exercises**: From the Exercises page, filter by type (Multiple Choice, Numeric, Drag and Drop, Budget Allocation, Fill in Table, Scenario Simulation) and category. Do standalone exercises, earn XP, and see skill feedback.
- **Review queue**: See due reviews and “next up” by skill; start a review session to strengthen retention.

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
- **Feedback**: From Support, open the Feedback page to report bugs or send feedback (type: bug, suggestion, other; optional “where”). Submissions are for logged-in users only.

### Legal and info

- **Subscriptions**: View plans (Starter, Plus, Pro), features, and pricing; start trial or subscribe.
- **Legal pages**: Privacy policy, cookie policy, terms of service, financial disclaimer (and no-financial-advice section).
- **Welcome / About**: Landing and product info; footer links to dashboard, exercises, missions, tools, leaderboards, rewards, support, subscriptions.

### Elsewhere

- **AI chatbot**: Ask the finance assistant (OpenRouter) about budgeting, investing, saving, crypto, retirement, etc., from the in-app chat widget.
- **Onboarding questionnaire**: Complete the short questionnaire for personalized recommendations and rewards (XP/coins).
- **Payment success / upgrade**: Dedicated pages after checkout or when payment is required for a feature.

(Admin-only: **Pricing dashboard** for conversion analytics when admin mode is enabled.)

## Features (summary)

- Personalized learning paths (Basic Finance, Forex, Crypto, Real Estate, Budgeting).
- Gamification: badges, streaks, leaderboards, rewards (coins, shop, donations).
- AI tutor via OpenRouter-powered assistant for finance Q&A.
- Finance tools: portfolio analyzer, reality check, economic calendar, economic map, news/market context, market explorer, next steps (some tools Plus/Pro).
- Exercises: multiple choice, numeric, drag-and-drop, budget allocation, fill-in table, scenario simulation; review queue (see `docs/exercise-experience-plan.md`).
- Missions: 4 daily + 4 weekly (randomized from pool per day/week), swap, completion XP.
- Support hub: FAQ + contact form; feedback page for bugs and suggestions.

## Tech Stack

- Frontend: React (CRA + CRACO), SCSS.
- Backend: Django REST Framework, Celery, Redis, PostgreSQL (dev, production, and CI tests).
- Auth: JWT via djangorestframework-simplejwt.
- Background work: Celery beat/results for scheduled tasks.

## Getting Started

### Clone

git clone https://github.com/andreineagoe23/monevo.git
cd monevo

### Docker (recommended)

See `docs/setup-docker.md`.

### Backend (API)

cd backend
python -m venv venv
venv\Scripts\activate  # on Windows; use source venv/bin/activate on macOS/Linux
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver

- Set DATABASE_URL (PostgreSQL) for local and production. CI uses a Postgres service container for backend tests.
- Celery/Redis are optional in local dev; enable when running scheduled tasks.
- Environment variables: see backend/.env.example and backend/ENV_VARIABLES.md.

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

### Frontend (Web)

cd frontend
npm install
npm start

- Set REACT_APP_BACKEND_URL to point to your API.
- Build for production with npm run build.

## Deployment Notes

- Docker deployment guide: `docs/deployment-docker.md`
- Railway production runbook: `docs/railway-production-runbook.md` (includes pushing missions: `./backend/scripts/railway_push_missions.sh`).
- Frontend: Vercel-friendly static build (npm run build).
- Backend: WSGI-compatible (e.g., PythonAnywhere). Configure ALLOWED_HOSTS, CORS/CSRF origins, SECRET_KEY, DB credentials, Stripe keys, reCAPTCHA, and email settings via environment variables.
- Static files served by WhiteNoise; media served from MEDIA_ROOT or external storage in production.

## Security & Operations

- Keep secrets in environment variables; do not commit credentials. Rotate any previously committed keys.
- For production backups: use `backend/scripts/backup_postgres.sh` (see the script for usage and restore instructions).
- Use HTTPS and restrict CORS_ALLOWED_ORIGINS/CSRF_TRUSTED_ORIGINS to trusted domains.
- JWTs: access tokens via Authorization header; configure lifetimes in SIMPLE_JWT.
- Run dependency checks regularly (pip-audit, npm audit) and keep requirements.txt/package-lock.json updated.

## Contributing

Pull requests are welcome. Please open an issue for major changes first to discuss what you would like to modify. Ensure lint/tests pass before submitting.

### Pre-commit hooks (run on every `git commit`)

To run Black (backend), pre-commit-hooks, and detect-secrets automatically on each commit:

```bash
# From repo root, once per clone:
python3 -m venv .venv
source .venv/bin/activate   # or .venv\Scripts\activate on Windows
pip install -r backend/requirements-dev.txt
pre-commit install
```

After that, every `git commit` will run these checks; if Black reformats files, the commit will fail until you `git add` the changes and commit again.

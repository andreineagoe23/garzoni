# Monevo: Gamified Financial Learning Platform

Monevo delivers interactive personal finance education with gamified progression and AI tutoring. Users complete learning paths, earn badges, compete on leaderboards, and explore finance tools across budgeting, investing, and trading.

## Features

- Personalized learning paths (Basic Finance, Forex, Crypto, Real Estate, Budgeting).
- Gamification: badges, streaks, leaderboards, rewards.
- AI tutor via OpenRouter-powered assistant for finance Q&A.
- Finance tools: converters, calculators, trackers, and portfolio helpers.
- Exercise experience plan focused on MCQ, numeric, and budget formats (see `docs/exercise-experience-plan.md`).

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
- Frontend: Vercel-friendly static build (npm run build).
- Backend: WSGI-compatible (e.g., PythonAnywhere). Configure ALLOWED_HOSTS, CORS/CSRF origins, SECRET_KEY, DB credentials, Stripe keys, reCAPTCHA, and email settings via environment variables.
- Static files served by WhiteNoise; media served from MEDIA_ROOT or external storage in production.

## Security & Operations

- Keep secrets in environment variables; do not commit credentials. Rotate any previously committed keys.
- For production backups: use `scripts/backup_postgres.sh` (see the script for usage and restore instructions).
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

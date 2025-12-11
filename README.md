# Monevo: Gamified Financial Learning Platform

Monevo delivers interactive personal finance education with gamified progression and AI tutoring. Users complete learning paths, earn badges, compete on leaderboards, and explore finance tools across budgeting, investing, and trading.

## Features

- Personalized learning paths (Basic Finance, Forex, Crypto, Real Estate, Budgeting).
- Gamification: badges, streaks, leaderboards, rewards.
- AI tutor via OpenRouter-powered assistant for finance Q&A.
- Finance tools: converters, calculators, trackers, and portfolio helpers.

## Tech Stack

- Frontend: React, SCSS, Vite (dev), Vercel (typical deploy).
- Backend: Django REST Framework, Celery, Redis, MySQL (prod) or SQLite (dev).
- Auth: JWT via djangorestframework-simplejwt.
- Background work: Celery beat/results for scheduled tasks.

## Getting Started

### Clone

git clone https://github.com/andreineagoe23/monevo.git
cd monevo

### Backend (API)

cd backend
python -m venv venv
venv\Scripts\activate  # on Windows; use source venv/bin/activate on macOS/Linux
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver

- By default uses SQLite in DEBUG. Set DATABASE_URL for MySQL/Postgres in production.
- Celery/Redis are optional in local dev; enable when running scheduled tasks.
- Environment variables are documented in backend/ENV_VARIABLES.md.

### Frontend (Web)

cd frontend
npm install
npm run dev

- Set REACT_APP_BACKEND_URL to point to your API.
- Build for production with npm run build.

## Deployment Notes

- Frontend: Vercel-friendly static build (npm run build).
- Backend: WSGI-compatible (e.g., PythonAnywhere). Configure ALLOWED_HOSTS, CORS/CSRF origins, SECRET_KEY, DB credentials, Stripe keys, reCAPTCHA, and email settings via environment variables.
- Static files served by WhiteNoise; media served from MEDIA_ROOT or external storage in production.

## Security & Operations

- Keep secrets in environment variables; do not commit credentials. Rotate any previously committed keys.
- Use HTTPS and restrict CORS_ALLOWED_ORIGINS/CSRF_TRUSTED_ORIGINS to trusted domains.
- JWTs: access tokens via Authorization header; configure lifetimes in SIMPLE_JWT.
- Run dependency checks regularly (pip-audit, npm audit) and keep requirements.txt/package-lock.json updated.

## Contributing

Pull requests are welcome. Please open an issue for major changes first to discuss what you would like to modify. Ensure lint/tests pass before submitting.


# Local setup (no Docker)

Garzoni is a pnpm monorepo with three TypeScript packages (`packages/core`, `frontend`, `mobile`) and a Django backend.

## Prerequisites

- **Node.js 20+** and **pnpm 10+** (`corepack enable` then `corepack prepare pnpm@10.15.1 --activate`)
- **Python 3.11+**
- **PostgreSQL 15+** (with `pgvector` extension if you want AI semantic search; see below)
- **Redis 5+** (only required for Celery / scheduled tasks; optional in dev)

## Repo install

```bash
git clone https://github.com/andreineagoe23/garzoni.git
cd garzoni
pnpm install
```

This installs deps for `frontend`, `mobile`, and `packages/core` in one pass and wires up husky pre-commit hooks.

## Backend (Django)

```bash
cd backend
python -m venv venv
source venv/bin/activate            # Windows: venv\Scripts\activate
pip install -r requirements.txt -r requirements-dev.txt
```

**Configure env** — copy or create `backend/.env`. Minimum:

```
SECRET_KEY=<long-random>
DEBUG=True
DATABASE_URL=postgres://user:pass@localhost:5432/garzoni
OPENAI_API_KEY=sk-...           # required for AI tutor + RAG
```

Optional (only needed when exercising those features locally):

```
STRIPE_SECRET_KEY=...
STRIPE_WEBHOOK_SECRET=...
GOOGLE_OAUTH_CLIENT_ID=...
GOOGLE_OAUTH_CLIENT_SECRET=...
CIO_SITE_ID=...
CIO_TRACK_API_KEY=...
SENTRY_DSN=...
```

See [environment.md](./environment.md) for the full list.

**pgvector** (for AI semantic search):

```bash
psql $DATABASE_URL -c "CREATE EXTENSION IF NOT EXISTS vector;"
```

**Migrate + run:**

```bash
python manage.py migrate
python manage.py runserver
```

## Web (Vite)

From repo root:

```bash
pnpm dev:web
# or: pnpm --filter @garzoni/web dev
```

Default backend URL is same-origin `/api`. To target a different host, set `VITE_BACKEND_URL` in `frontend/.env.local`.

## Mobile (Expo)

From repo root:

```bash
pnpm dev:mobile
# or: pnpm --filter @garzoni/mobile start
```

Set `EXPO_PUBLIC_BACKEND_URL` in `mobile/.env` (or whatever the project's env file is) to your backend (e.g. `http://192.168.x.x:8000` so the device can reach your Mac).

## Seeding data

```bash
cd backend

# Lessons + sections baseline
python manage.py ensure_lesson_sections

# Exercises seed (multiple choice, numeric, drag-and-drop, etc.)
python manage.py seed_exercises

# Embed lessons + courses for AI semantic search (requires OPENAI_API_KEY + pgvector)
python manage.py shell -c "from education.services.retrieval import backfill_all; print(backfill_all())"
```

## Celery (optional, for background tasks)

```bash
# In one terminal — worker
cd backend && celery -A core worker -l info

# In another — beat (for scheduled AI nudges, path re-eval)
cd backend && celery -A core beat -l info
```

If Redis isn't running, Celery defaults to eager mode (`CELERY_TASK_ALWAYS_EAGER`) so the API still works — scheduled jobs just don't fire.

## Pre-commit

```bash
pnpm precommit          # typecheck + lint + Prettier + Vitest
flake8 backend          # backend lint
black backend           # backend format
```

The husky pre-commit hook runs `pnpm precommit` automatically on `git commit`. To install Black + flake8 hooks too:

```bash
python3 -m venv .venv && source .venv/bin/activate
pip install -r backend/requirements-dev.txt
pre-commit install
```

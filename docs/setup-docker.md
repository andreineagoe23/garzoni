### Docker setup (recommended)

This repo ships with:

- **Production-style stack** (`docker-compose.yml`): PostgreSQL, Redis, Django + Gunicorn, Celery worker/beat.
- **Dev stack** (`docker-compose.dev.yml`): PostgreSQL, Redis, Django runserver (no Celery; tasks run inline). Uses **Postgres only** (same as Railway).

### Prereqs

- Docker Desktop (or Docker Engine) with Compose v2 (`docker compose`)

### Quick start (dev, recommended for local)

- **From the repo root** (`monevo/`), ensure Postgres credentials are shared between the db container and the backend. Either create a `.env` in the repo root with `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD` (used by compose for the db service and for backend’s `DATABASE_URL`), or use the defaults (monevo/monevo). If you get "password authentication failed", remove the old volume and try again:

```bash
docker compose -f docker-compose.dev.yml down -v
```

- **Boot the dev stack** (uses `backend/.env`; see also `backend/.env.dev`):

```bash
docker compose -f docker-compose.dev.yml up --build
```

- On first start, the entrypoint runs migrations then **seeds** exercises and ensures lesson sections (`SEED_AFTER_MIGRATE=1`), and prints a **verify_restore** summary (counts for users, lesson sections, exercises, etc.). Backend will be at **http://localhost:8000** (DEBUG=True, CORS allowed for http://localhost:3000). Run the frontend separately (e.g. `npm start` in `frontend/`) and set `REACT_APP_BACKEND_URL=http://localhost:8000/api` if needed.

### Quick start (production-style stack)

- Create a `.env` in the repo root with at least `POSTGRES_PASSWORD` (and `DJANGO_SECRET_KEY` if not using DEBUG).
- Run: `docker compose up -d --build`

### Railway (production)

Railway does **not** use a separate "prod Dockerfile". It uses the **same** `backend/Dockerfile`; the entrypoint runs migrations then starts Gunicorn. Production behaviour comes from **env vars** you set in the Railway dashboard (e.g. `DEBUG=False`, `DATABASE_URL` from Railway’s Postgres plugin). Point Railway at the backend service and set `DJANGO_SETTINGS_MODULE=settings.settings` and your secrets.

### Restoring a database backup locally (Postgres)

**Recommended: use the repo backup (500 lesson sections, 263 exercises)**

The file `backend/backups/backup_for_postgres_20260206_203429.json` is the canonical backup (500 lesson sections, 263 exercises, users, courses, etc.). After the dev stack is up and migrations have run:

```bash
docker compose -f docker-compose.dev.yml exec backend python manage.py loaddata backups/backup_for_postgres_20260206_203429.json
docker compose -f docker-compose.dev.yml exec backend python manage.py verify_restore
```

See `backend/backups/README.md` for details and the SQL restore option.

**Restore from Railway or another Postgres dump**

1. **Export from Railway**: In Railway dashboard, use the Postgres service → Backup/Export, or use `pg_dump` from a connected client.
2. **Stop dev stack and (optionally) remove the volume**:
   ```bash
   docker compose -f docker-compose.dev.yml down -v
   docker compose -f docker-compose.dev.yml up -d
   ```
3. **Restore** (after the db container is up):
   ```bash
   # If you have a .sql file:
   docker compose -f docker-compose.dev.yml exec -T db psql -U monevo -d monevo < backup.sql
   # If you have a custom-format dump:
   docker compose -f docker-compose.dev.yml exec -T db pg_restore -U monevo -d monevo --no-owner --no-acl < backup.dump
   ```
4. Restart the backend: `docker compose -f docker-compose.dev.yml restart backend`

### URLs

- **Frontend**: `http://localhost:3000`
- **Backend API**: `http://localhost:8000/api/`
- **API docs (Swagger)**: `http://localhost:8000/api/docs/`
- **API schema (OpenAPI JSON)**: `http://localhost:8000/api/schema/`
- **Admin**: `http://localhost:8000/admin/`

### Common tasks

Use `docker compose -f docker-compose.dev.yml` for dev, or `docker compose` for the default (production-style) stack.

- **View logs**:

```bash
docker compose -f docker-compose.dev.yml logs -f --tail=200
```

- **Create a superuser**:

```bash
docker compose -f docker-compose.dev.yml exec backend python manage.py createsuperuser
```

- **Run migrations manually** (they also run automatically on container start):

```bash
docker compose -f docker-compose.dev.yml exec backend python manage.py migrate --noinput
```

- **Seed data** (exercises + ensure every lesson has sections). Dev compose runs this automatically on first start (`SEED_AFTER_MIGRATE=1`). To run manually:

```bash
docker compose -f docker-compose.dev.yml exec backend python manage.py seed_exercises
docker compose -f docker-compose.dev.yml exec backend python manage.py ensure_lesson_sections
```

- **Verify database** (counts for users, lesson sections, exercises, courses, etc.):

```bash
docker compose -f docker-compose.dev.yml exec backend python manage.py verify_restore
```

For production-like data (e.g. hundreds of lesson sections, existing users), restore from a Railway backup (see “Restoring a database backup locally” above). Seeds only add exercises and fill sections for **existing** lessons; they do not create courses/lessons.

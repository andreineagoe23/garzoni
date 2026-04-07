### Docker setup (recommended)

This repo ships with:

- **Production-style stack** (`docker-compose.yml` + `docker-compose.prod.yml`): PostgreSQL, Redis, Django + Gunicorn. Celery worker/beat are under the `celery` profile—use `make prod` or `docker compose --profile celery up` to start them.
- **Dev stack** (`docker-compose.yml` + `docker-compose.dev.yml`): PostgreSQL, Redis, Django runserver. **No Celery by default**; tasks run inline (`CELERY_TASK_ALWAYS_EAGER=True`). To run Celery in dev (e.g. to test async tasks), use `make dev-celery` or `docker compose -f docker-compose.yml -f docker-compose.dev.yml --profile celery up`.

### Prereqs

- Docker Desktop (or Docker Engine) with Compose v2 (`docker compose`)

### Quick start (dev, recommended for local)

- **From the repo root** (`garzoni/`), ensure Postgres credentials are shared between the db container and the backend. Either create a `.env` in the **repo root** (not only `backend/.env`) with `POSTGRES_PASSWORD=yourpassword` so both the `db` service and the backend’s `DATABASE_URL` (injected by Compose) use the same value, or use the defaults (user/password `garzoni`). **If you see "password authentication failed for user garzoni"**: the backend is using a different password than the one Postgres was initialized with (stored in the volume). Fix: use the same `POSTGRES_PASSWORD` everywhere and reset the DB volume so Postgres re-initializes with that password:

```bash
docker compose down -v
docker compose up -d
```

- **Boot the dev stack** (uses `backend/.env`; see also `backend/.env.dev`). Celery does not run; tasks execute inline.

```bash
make dev
# or
docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build
```

- On first start, the entrypoint runs migrations then **seeds** exercises and ensures lesson sections (`SEED_AFTER_MIGRATE=1`), and prints a **verify_restore** summary (counts for users, lesson sections, exercises, etc.). Backend will be at **http://localhost:8000** (DEBUG=True, CORS allowed for http://localhost:3000). Run the frontend separately (e.g. `npm start` in `frontend/`) and set `REACT_APP_BACKEND_URL=http://localhost:8000/api` if needed.

### Quick start (production-style stack)

- Create a `.env` in the repo root with at least `POSTGRES_PASSWORD` (and `DJANGO_SECRET_KEY` if not using DEBUG).
- Run with Celery: `make prod` or `docker compose -f docker-compose.yml -f docker-compose.prod.yml --profile celery up -d --build`
- Run without Celery: `docker compose up -d --build` (backend, db, redis only). The backend uses the Postgres container (`DATABASE_URL` is set by Compose), so the DB persists in the `backend_db_data` volume and migrations only run when there are new ones. If your `backend/.env` has `DATABASE_URL=sqlite:///...`, it is overridden in Docker so the DB is not recreated on every rebuild.

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
   docker compose -f docker-compose.dev.yml exec -T db psql -U garzoni -d garzoni < backup.sql
   # If you have a custom-format dump:
   docker compose -f docker-compose.dev.yml exec -T db pg_restore -U garzoni -d garzoni --no-owner --no-acl < backup.dump
   ```
4. Restart the backend: `docker compose -f docker-compose.dev.yml restart backend`

### URLs

- **Frontend**: `http://localhost:3000`
- **Backend API**: `http://localhost:8000/api/`
- **API docs (Swagger)**: `http://localhost:8000/api/docs/`
- **API schema (OpenAPI JSON)**: `http://localhost:8000/api/schema/`
- **Admin**: `http://localhost:8000/admin/`

### Common tasks

Use `make dev` (or `docker compose -f docker-compose.yml -f docker-compose.dev.yml`) for dev; use `docker compose` for the default stack. Add `--profile celery` (or `make dev-celery` / `make prod`) when you need Celery worker/beat. Only the backend container runs migrations; Celery containers skip them.

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

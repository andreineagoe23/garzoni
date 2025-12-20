### Docker setup (recommended)

This repo ships with a production-like Docker Compose stack:

- **PostgreSQL** (`db`)
- **Redis** (`redis`) for Celery
- **Django + Gunicorn** (`backend`)
- **Celery worker/beat** (`celery_worker`, `celery_beat`)
- **React static build served by Nginx** (`frontend`)

### Prereqs

- Docker Desktop (or Docker Engine) with Compose v2 (`docker compose`)

### Quick start

- **Create a local env file**:
  - Create a `.env` (same directory as `docker-compose.yml`) with your existing local values
  - At minimum set `POSTGRES_PASSWORD` (required), and set `DJANGO_SECRET_KEY` when running with `DJANGO_DEBUG=False`

- **Boot the stack**:

```bash
docker compose up -d --build
```

### URLs

- **Frontend**: `http://localhost:3000`
- **Backend API**: `http://localhost:8000/api/`
- **API docs (Swagger)**: `http://localhost:8000/api/docs/`
- **API schema (OpenAPI JSON)**: `http://localhost:8000/api/schema/`
- **Admin**: `http://localhost:8000/admin/`

### Common tasks

- **View logs**:

```bash
docker compose logs -f --tail=200
```

- **Create a superuser**:

```bash
docker compose exec backend python manage.py createsuperuser
```

- **Run migrations manually** (they also run automatically on container start):

```bash
docker compose exec backend python manage.py migrate --noinput
```

- **Seed dummy data**:

```bash
docker compose exec backend python manage.py seed_exercises
docker compose exec backend python manage.py ensure_lesson_sections
```

### Architecture overview

Monevo is a classic SPA + API setup with background jobs.

### Components

- **Frontend (React)**: static SPA (served by Nginx in Docker)
- **Backend (Django REST Framework)**: JSON API + admin
- **PostgreSQL**: primary datastore
- **Redis**: Celery broker
- **Celery worker/beat**: background + scheduled tasks (emails, streak resets, etc.)

### Diagram

```mermaid
flowchart LR
  U[User Browser] -->|HTTP| FE[Frontend (React / Nginx)]
  U -->|HTTP /api| BE[Backend (Django + Gunicorn)]

  FE -->|REST calls| BE
  BE -->|SQL| DB[(PostgreSQL)]
  BE -->|enqueue tasks| R[(Redis)]
  CW[Celery Worker] -->|consume tasks| R
  CW -->|SQL results| DB
  CB[Celery Beat] -->|schedule| R
```

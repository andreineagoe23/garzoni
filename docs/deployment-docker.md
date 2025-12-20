### Deployment (Docker)

This repo’s `docker-compose.yml` is meant to be usable both locally and as a baseline for production-like deployments.

### Production checklist

- **Set real secrets**:
  - `DJANGO_SECRET_KEY`
  - Stripe + email + reCAPTCHA env vars (see `backend/ENV_VARIABLES.md`)

- **Lock down security settings**:
  - `DJANGO_ALLOWED_HOSTS_CSV`
  - `CORS_ALLOWED_ORIGINS_CSV`
  - `CSRF_TRUSTED_ORIGINS_CSV`

- **Put a reverse proxy in front**:
  - Terminate TLS and forward to `frontend`/`backend`
  - Ensure `X-Forwarded-Proto` is set (Django uses `SECURE_PROXY_SSL_HEADER`)

### Example: running on a VM

- Copy `env.example` → `.env` and edit values
- Run:

```bash
docker compose up -d --build
```

### Persistence

Docker volumes are created for:

- `postgres_data` (database)
- `backend_media` (uploaded media)
- `backend_static` (collectstatic output)



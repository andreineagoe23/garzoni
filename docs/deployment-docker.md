### Deployment (Docker)

This repo’s `docker-compose.yml` is meant to be usable both locally and as a baseline for production-like deployments.

### Production checklist

- **Set real secrets**:
  - `DJANGO_SECRET_KEY`
  - Stripe + email + reCAPTCHA env vars (see `backend/.env.example` and `backend/ENV_VARIABLES.md`)

- **Lock down security settings**:
  - `DJANGO_ALLOWED_HOSTS_CSV`
  - `CORS_ALLOWED_ORIGINS_CSV`
  - `CSRF_TRUSTED_ORIGINS_CSV`

- **Put a reverse proxy in front**:
  - Terminate TLS and forward to `frontend`/`backend`
  - Ensure `X-Forwarded-Proto` is set (Django uses `SECURE_PROXY_SSL_HEADER`)

### Example: running on a VM

- Create a `.env` file (repo root) with your deployment values
- Run:

```bash
docker compose up -d --build
```

### Persistence

Docker volumes are created for:

- `postgres_data` (database)
- `backend_media` (uploaded media)
- `backend_static` (collectstatic output)

### Railway: media (mascots, path_images, course_images)

The Dockerfile is written for **build context = repository root** (Railway’s default when Dockerfile path is `backend/Dockerfile`). It copies `backend/` into `/app`, so `/app/media` is populated and you don’t need to set a Root Directory.

1. **No Root Directory needed**
   Leave Railway’s Root Directory unset (or empty). The image copies from `backend/` into `/app`, so `/app/media`, `/app/manage.py`, etc. are correct.

2. **Persistent media volume (recommended on Railway)**
   Add a **Volume** to the backend service (e.g. `monevo-volume`), set **Mount path** to **`/app/media`**, and use the same region as the service. The entrypoint seeds the volume from the image on every startup (no-clobber, so uploads are kept). If media still 404s, set **`RAILWAY_RUN_UID=0`** in the service variables so the seed copy can write to the volume; check deploy logs for `[entrypoint] Seeding /app/media` and any permission warnings.

3. **Redeploy and clear build cache**
   After pulling the updated Dockerfile, in Railway use **Redeploy** and enable **Clear build cache** so the new image is built and media is included.

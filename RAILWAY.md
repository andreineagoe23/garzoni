# Deploying Monevo on Railway (email reminders & Celery)

## How database migrations get applied on Railway

Your **local Docker database** and **Railway’s database** are separate. Schema and one-off data changes stay in sync by running the **same migration files** on both.

- **Locally:** You run `python manage.py migrate` (or your backend container runs it via `backend/docker/entrypoint.sh`).
- **On Railway:** Every time the backend service **starts**, the entrypoint runs `python manage.py migrate --noinput` before starting Gunicorn. So any new migration files you **push to git** are applied on the next deploy.

**Workflow:**

1. Create migrations locally (e.g. `python manage.py makemigrations`) and run them locally (`python manage.py migrate`).
2. Commit and push the migration files (e.g. `backend/education/migrations/0021_*.py`).
3. Deploy to Railway (git push or Railway’s deploy from repo).
4. Railway builds the new image and starts the backend container → entrypoint runs → **migrate runs** → unapplied migrations run against Railway’s `DATABASE_URL` → Gunicorn starts.

**Checklist:**

- Backend service on Railway uses the **same Dockerfile** (`backend/Dockerfile`) and does **not** set `SKIP_MIGRATIONS=1`.
- Railway backend has `DATABASE_URL` set to your Postgres (Railway Postgres or external).
- After a deploy, check Railway logs for `[entrypoint]` and that migrate completed without errors.

**Note:** Only **schema and migration logic** (including data migrations like removing filler sections) are synced via git. **Actual data** (users, lesson content, etc.) are **not** copied from local to Railway; each environment has its own database and content.

---

## Email reminders and Celery

For **email reminders** (weekly/monthly login reminders and trial-ending "2 days left") to work on Railway, you need:

1. **Redis** (Celery broker)
2. **Celery worker** (runs tasks)
3. **Celery beat** (triggers scheduled tasks at 10:00 and 12:00 UTC)
4. **SMTP email** env vars set

---

## 1. Add Redis

- In Railway: **New → Database → Redis**, or use an external Redis (e.g. Upstash).
- Copy the **Redis URL** (e.g. `redis://redis.railway.internal:6379` or the URL Railway shows for your Redis service).

## 2. Backend service – env vars

On your **backend** service, set:

| Variable | Description |
|----------|-------------|
| `REDIS_URL` | Redis connection URL from step 1 |
| `CELERY_BROKER_URL` | Same as `REDIS_URL` (or leave unset; app uses `REDIS_URL` when `CELERY_BROKER_URL` is empty) |
| `EMAIL_HOST` | e.g. `smtp.gmail.com` or your SMTP host |
| `EMAIL_PORT` | e.g. `587` |
| `EMAIL_USE_TLS` | `True` |
| `EMAIL_HOST_USER` | Your SMTP login (e.g. Gmail address) |
| `EMAIL_HOST_PASSWORD` | SMTP password (for Gmail use an [App Password](https://support.google.com/accounts/answer/185833)) |
| `DEFAULT_FROM_EMAIL` | Sender address (e.g. same as `EMAIL_HOST_USER` or `noreply@yourdomain.com`) |

If `EMAIL_HOST_USER` or `EMAIL_HOST_PASSWORD` is missing, reminder and trial-ending emails are skipped (no crash).

## 3. Celery worker service

- **New Service** from the same repo as the backend (or same Dockerfile).
- **Build**: same as backend (e.g. `backend` directory / Dockerfile).
- **Start command**:
  `celery -A settings worker -l info`
- **Env vars**: Same as backend (include `REDIS_URL`, `CELERY_BROKER_URL`, `DATABASE_URL`, and all email vars). No need to run the web server.

## 4. Celery beat service

- **New Service** from the same repo.
- **Build**: same as backend.
- **Start command**:
  `celery -A settings beat -l info --scheduler django_celery_beat.schedulers:DatabaseScheduler`
- **Env vars**: Same as backend (same as worker).

Beat will run:

- **12:00 UTC** – weekly/monthly login reminders (`send_email_reminders`)
- **10:00 UTC** – trial ending in 2 days (`send_trial_ending_reminder`)

## 5. Checklist

- [ ] Redis added and `REDIS_URL` (and optionally `CELERY_BROKER_URL`) set on backend, worker, and beat.
- [ ] Backend has all email env vars set; worker and beat have the same so they can send mail.
- [ ] Celery worker service is running (start command: `celery -A settings worker -l info`).
- [ ] Celery beat service is running (start command with `DatabaseScheduler`).
- [ ] Migrations have been run (backend runs them; worker/beat use the same DB so `django_celery_beat` tables exist).

After deploy, reminders will run at the scheduled times. To use a different timezone for the schedule, set `TIME_ZONE` and ensure `CELERY_TIMEZONE` follows it (the app uses Django’s `TIME_ZONE` for Celery).

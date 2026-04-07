# Railway: Backend Tests service

A **separate Railway service** that only runs backend tests (and queues Celery test tasks). Use it when you don’t have a console on the main backend.

**Note:** GitHub Actions CI (`.github/workflows/ci.yml`) runs only the **Django test suite** with a Postgres service container; it does **not** run Celery or `run_celery_tests`. For full coverage including Celery task execution, use this Railway Backend Tests service (with Redis and a Celery worker available) or run `run_celery_tests` locally when Redis is up.

## Add the service in Railway

1. **New service** from the same repo (e.g. “Backend Tests” or “garzoni-backend-tests”).
2. **Root directory:** `backend`
3. **Build:** same as backend
   - Builder: Dockerfile
   - Dockerfile path: `Dockerfile` (relative to root directory, so `backend/Dockerfile`)
4. **Start command:**
   ```bash
   /bin/sh /app/docker/run_tests.sh
   ```
   Or only Django tests:
   ```bash
   python manage.py migrate --noinput && python manage.py test --no-input -v 2
   ```
5. **Variables:** same as backend (so tests and Celery can use DB and Redis):
   - `DATABASE_PUBLIC_URL` (or `DATABASE_URL`)
   - `REDIS_URL`
   - `SECRET_KEY`
   - Any other env the app needs for tests (e.g. Stripe, reCAPTCHA if tests touch them)
6. **Deploy:** no need to expose HTTP. You can leave “Public Networking” off.
7. **Restart policy:** “No Restart” or “On Failure” with **0** retries, so the service runs once and stops (exit 0 = success, non‑zero = failed tests).

## What it does

- **`run_tests.sh`** (default start command):
  1. Runs `migrate --noinput`
  2. Runs `python manage.py test --no-input -v 2`
  3. Runs `python manage.py run_celery_tests` (queues tasks; check **Celery worker** logs to confirm they run)
  4. Exits with the test run exit code

- If you use only `python manage.py test ...`, the service just runs the Django test suite and exits.

## How to “run” tests

- **Trigger a deploy** of the Backend Tests service (push to the branch Railway watches, or “Redeploy” in the UI).
- Open the service **Deployments** → latest deployment → **Logs**.
- If tests pass you’ll see the test output and “Done.”; if they fail the deploy will show a non‑zero exit.

## Optional: run only Celery test tasks

If you only want to queue Celery tasks (no Django test suite), set the start command to:

```bash
python manage.py migrate --noinput && python manage.py run_celery_tests
```

Then check the **Celery worker** logs for “Received task” / “succeeded”.

#!/usr/bin/env sh
set -eu

MIGRATE_MAX_TRIES="${MIGRATE_MAX_TRIES:-60}"
MIGRATE_SLEEP_SECONDS="${MIGRATE_SLEEP_SECONDS:-2}"

# Role-based dispatch: on Railway, the worker/beat services share this Dockerfile
# with the web service, and without a Start Command override they fall back to
# the Dockerfile default CMD (gunicorn) — silently running a second web server
# instead of the Celery worker/beat. Use SERVICE_ROLE (explicit) or fall back to
# RAILWAY_SERVICE_NAME ("worker" / "beat") so Celery services run the right
# command and skip web-only setup steps.
_service_role="${SERVICE_ROLE:-${RAILWAY_SERVICE_NAME:-}}"
case "$_service_role" in
  worker|beat) _is_web=0 ;;
  *) _is_web=1 ;;
esac

if [ "${DJANGO_ENV:-production}" = "production" ] && [ "${DEBUG:-}" != "True" ] && [ -z "${SECRET_KEY:-}" ]; then
  echo "[entrypoint] ERROR: SECRET_KEY not set in production" >&2
  exit 1
fi

if [ "${SKIP_MIGRATIONS:-0}" != "1" ]; then
  i=0
  until python manage.py migrate --noinput 2>/dev/null || python manage.py migrate --noinput --fake-initial; do
    i=$((i+1))
    if [ "$i" -ge "$MIGRATE_MAX_TRIES" ]; then
      echo "[entrypoint] migrate still failing after ${MIGRATE_MAX_TRIES} tries; trying --fake-initial..." >&2
      python manage.py migrate --fake-initial --noinput || {
        echo "[entrypoint] Migration failed. If tables already exist, you may need to fake migrations manually." >&2
        echo "[entrypoint] Continuing anyway..." >&2
      }
      break
    fi
    echo "[entrypoint] waiting for database... ($i/${MIGRATE_MAX_TRIES})" >&2
    sleep "$MIGRATE_SLEEP_SECONDS"
  done

  # Legacy compatibility: opt-in only. Never run by default because it can fake
  # framework migrations (e.g. contenttypes/auth) before schema exists.
  if [ "${RUN_LEGACY_CORE_FAKE_AFTER_MIGRATE:-0}" = "1" ]; then
    echo "[entrypoint] Opt-in: faking legacy core migrations..." >&2
    python manage.py migrate --fake core --noinput 2>/dev/null || true
  fi
fi

# Optional: seed exercises and lesson sections (dev only; set SEED_AFTER_MIGRATE=1)
if [ "${SEED_AFTER_MIGRATE:-0}" = "1" ]; then
  echo "[entrypoint] Running seed_exercises and ensure_lesson_sections..."
  python manage.py seed_exercises 2>/dev/null || true
  python manage.py ensure_lesson_sections 2>/dev/null || true
  python manage.py verify_restore 2>/dev/null || true
fi

if [ "$_is_web" = "1" ]; then
  # Static files: baked into the image at build time via collectstatic in the Dockerfile.
  # Auto-detect: if /app/staticfiles already has enough files (from the build layer), skip
  # the runtime collectstatic entirely — no env var needed.
  # Fallback: run collectstatic if files are missing (old image, local dev without build step).
  mkdir -p /app/staticfiles /app/media
  _baked_count="$(find /app/staticfiles -type f 2>/dev/null | wc -l | tr -d ' ')"
  if [ "${_baked_count}" -ge 50 ]; then
    echo "[entrypoint] staticfiles: ${_baked_count} files already baked in image — skipping collectstatic" >&2
  else
    echo "[entrypoint] staticfiles: ${_baked_count} files found — running collectstatic..." >&2
    python manage.py collectstatic --noinput --clear
    echo "[entrypoint] collectstatic done" >&2
  fi

  static_count="$(find /app/staticfiles -type f 2>/dev/null | wc -l | tr -d ' ')"
  echo "[entrypoint] staticfiles: ${static_count} files" >&2
  # Fail fast so a bad deployment never serves a broken admin UI.
  if [ "${static_count}" -lt 50 ]; then
    echo "[entrypoint] ERROR: staticfiles unexpectedly low; admin assets missing." >&2
    exit 1
  fi
  if [ ! -f /app/staticfiles/admin/js/theme.js ] || [ ! -f /app/staticfiles/admin/js/nav_sidebar.js ]; then
    echo "[entrypoint] ERROR: Django admin static assets missing after collectstatic." >&2
    exit 1
  fi

  # Cloudinary image migration: update DB ImageField paths to Cloudinary public IDs.
  # Runs only when CLOUDINARY_URL is set and the upload results JSON is present in the image.
  # Safe to run on every deploy: already-migrated rows are skipped automatically.
  if [ -n "${CLOUDINARY_URL:-}" ] && [ -f /app/cloudinary-upload-results.json ]; then
    echo "[entrypoint] Running Cloudinary image migration..." >&2
    python manage.py migrate_cloudinary_images \
      --json-path /app/cloudinary-upload-results.json 2>&1 || \
      echo "[entrypoint] WARN: migrate_cloudinary_images had errors (non-fatal)" >&2
  fi

  # Media files are served via Cloudinary — no local seeding needed.
else
  echo "[entrypoint] role=${_service_role} — skipping collectstatic, cloudinary migration, and media seeding (Celery service)." >&2
fi

# If Railway did not override the Start Command, the container falls back to
# the Dockerfile CMD (gunicorn). For worker/beat services that is wrong;
# replace with the correct Celery command so no Railway UI edit is required.
if [ "${1:-}" = "gunicorn" ]; then
  case "$_service_role" in
    worker)
      echo "[entrypoint] role=worker — replacing CMD with celery worker" >&2
      set -- celery -A settings.celery worker \
        --loglevel=info --concurrency=2 \
        -Q celery,high,default,low,reminders,emails,translations
      ;;
    beat)
      echo "[entrypoint] role=beat — replacing CMD with celery beat" >&2
      set -- celery -A settings.celery beat \
        --scheduler django_celery_beat.schedulers:DatabaseScheduler \
        --loglevel=info
      ;;
  esac
fi

# Railway (and similar) set PORT; bind gunicorn to it so no shell expansion is needed in start command
if [ "${1:-}" = "gunicorn" ] && [ -n "${PORT:-}" ]; then
  shift
  set -- gunicorn "$@" --bind "0.0.0.0:${PORT}"
fi

exec "$@"

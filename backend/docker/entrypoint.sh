#!/usr/bin/env sh
set -eu

MIGRATE_MAX_TRIES="${MIGRATE_MAX_TRIES:-60}"
MIGRATE_SLEEP_SECONDS="${MIGRATE_SLEEP_SECONDS:-2}"

if [ "${DJANGO_ENV:-production}" = "production" ] && [ "${DEBUG:-}" != "True" ] && [ -z "${SECRET_KEY:-}" ]; then
  echo "[entrypoint] ERROR: SECRET_KEY not set in production" >&2
  exit 1
fi

if [ "${SKIP_MIGRATIONS:-0}" != "1" ]; then
  i=0
  until python manage.py migrate --noinput --fake-initial 2>/dev/null || python manage.py migrate --noinput; do
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
fi

# Optional: one-time content rebuild when explicitly enabled.
# Use this only for controlled rollouts, then set RUN_CONTENT_REBUILD=0.
if [ "${RUN_CONTENT_REBUILD:-0}" = "1" ] && [ "${RUN_CONTENT_REBUILD_ON_START:-0}" = "1" ]; then
  echo "[entrypoint] RUN_CONTENT_REBUILD_ON_START=1 -> rebuilding lessons..."
  python manage.py rebuild_lessons_professional_flow || {
    echo "[entrypoint] ERROR: lesson rebuild failed" >&2
    exit 1
  }
fi

# Optional: seed exercises and lesson sections (dev only; set SEED_AFTER_MIGRATE=1)
if [ "${SEED_AFTER_MIGRATE:-0}" = "1" ]; then
  echo "[entrypoint] Running seed_exercises and ensure_lesson_sections..."
  python manage.py seed_exercises 2>/dev/null || true
  python manage.py ensure_lesson_sections 2>/dev/null || true
  python manage.py verify_restore 2>/dev/null || true
fi

if [ "${SKIP_COLLECTSTATIC:-0}" != "1" ]; then
  mkdir -p /app/staticfiles /app/media
  python manage.py collectstatic --noinput
fi
# Ensure dirs exist even when collectstatic was skipped (e.g. Railway pre-deploy only runs migrate)
mkdir -p /app/staticfiles /app/media

# Railway volume at /app/media: always seed from image so the volume has path_images, mascots, etc.
# cp -n = no-clobber so we never overwrite existing files (keeps user uploads safe).
if [ -d /app/media_seed ] && [ -n "$(ls -A /app/media_seed 2>/dev/null)" ]; then
  echo "[entrypoint] Seeding /app/media from image (monevo-volume mount)..." >&2
  if cp -rn /app/media_seed/. /app/media/; then
    echo "[entrypoint] Seed copy OK" >&2
  else
    echo "[entrypoint] WARN: seed copy had errors (check volume permissions; try RAILWAY_RUN_UID=0)" >&2
  fi
  # Verify so we see in logs whether files are present
  if [ -f /app/media/path_images/basicfinance.png ] && [ -f /app/media/mascots/monevo-bear.png ]; then
    echo "[entrypoint] /app/media verified: path_images and mascots present" >&2
  else
    echo "[entrypoint] WARN: /app/media missing expected files after seed" >&2
    ls -la /app/media/ 2>/dev/null || true
    ls -la /app/media/path_images/ 2>/dev/null || true
    ls -la /app/media/mascots/ 2>/dev/null || true
  fi
else
  # Fallback: mascots only if media_seed missing (old image)
  if [ -d /app/media_mascots_template ] && [ ! -f /app/media/mascots/monevo-bear.png ]; then
    mkdir -p /app/media/mascots
    cp -r /app/media_mascots_template/. /app/media/mascots/ 2>/dev/null || true
    echo "[entrypoint] Populated /app/media/mascots from image" >&2
  fi
fi

# Railway (and similar) set PORT; bind gunicorn to it so no shell expansion is needed in start command
if [ "$1" = "gunicorn" ] && [ -n "${PORT:-}" ]; then
  shift
  set -- gunicorn "$@" --bind "0.0.0.0:${PORT}"
fi

exec "$@"

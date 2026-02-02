#!/usr/bin/env sh
set -eu

MIGRATE_MAX_TRIES="${MIGRATE_MAX_TRIES:-60}"
MIGRATE_SLEEP_SECONDS="${MIGRATE_SLEEP_SECONDS:-2}"

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

if [ "${SKIP_COLLECTSTATIC:-0}" != "1" ]; then
  python manage.py collectstatic --noinput
fi

exec "$@"

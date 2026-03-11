#!/usr/bin/env bash
#
# Push education content (lessons, translations, exercises) from local Docker
# to Railway Postgres — without touching user data.
#
# Usage:
#   ./backend/scripts/push_content_to_railway.sh
#   ./backend/scripts/push_content_to_railway.sh backend/.env.production
#   ./backend/scripts/push_content_to_railway.sh --dry-run
#   ./backend/scripts/push_content_to_railway.sh backend/.env.production --dry-run
#
# What it does:
#   1. Exports content from your local Docker DB to a temp JSON fixture
#   2. Runs migrations on Railway
#   3. Imports the fixture into Railway (upsert by PK, no flush)
#
# What it does NOT do:
#   - Touch user accounts, progress, streaks, completions, or any non-education data
#   - Flush or drop any tables
#
set -e

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$REPO_ROOT"

ENV_FILE=""
DRY_RUN=""
for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN="--dry-run" ;;
    *) ENV_FILE="$arg" ;;
  esac
done

# Load env file if provided
if [ -n "$ENV_FILE" ]; then
  if [ "${ENV_FILE#/}" = "$ENV_FILE" ]; then
    ENV_FILE="$REPO_ROOT/$ENV_FILE"
  fi
  if [ -f "$ENV_FILE" ]; then
    while IFS= read -r line; do
      case "$line" in
        \#*|"") continue ;;
      esac
      export "$line" 2>/dev/null || true
    done < "$ENV_FILE"
    echo "[push-content] Loaded env from $ENV_FILE"
  else
    echo "[push-content] ERROR: env file not found: $ENV_FILE" >&2
    exit 1
  fi
fi

RAILWAY_DB="${DATABASE_PUBLIC_URL:-$DATABASE_URL}"
if [ -z "$RAILWAY_DB" ]; then
  echo "[push-content] ERROR: Set DATABASE_PUBLIC_URL or DATABASE_URL (Railway Postgres)." >&2
  echo "  Either export it, or pass your .env.production file as first argument." >&2
  exit 1
fi

# Ensure postgresql:// prefix
RAILWAY_DB="$(echo "$RAILWAY_DB" | sed 's|^postgres://|postgresql://|')"
echo "[push-content] Target DB: ${RAILWAY_DB#*@}"

FIXTURE="/tmp/monevo_education_content_$(date +%Y%m%d_%H%M%S).json"

# Step 1: Export from local Docker DB
echo ""
echo "[push-content] Step 1/3: Exporting education content from local Docker DB ..."
docker compose exec backend python manage.py export_education_content -o "$FIXTURE"
docker compose cp "backend:$FIXTURE" "$FIXTURE"
OBJECT_COUNT=$(python3 -c "import json; print(len(json.load(open('$FIXTURE'))))" 2>/dev/null || echo "?")
echo "[push-content] Exported $OBJECT_COUNT objects to $FIXTURE"

# Step 2: Run migrations on Railway
echo ""
echo "[push-content] Step 2/3: Running migrations on Railway ..."
docker compose -f docker-compose.yml -f docker-compose.dev.yml run --rm --no-deps \
  -e DATABASE_PUBLIC_URL="$RAILWAY_DB" \
  -e DATABASE_URL="$RAILWAY_DB" \
  backend python manage.py migrate --noinput

# Step 3: Import content into Railway
echo ""
if [ -n "$DRY_RUN" ]; then
  echo "[push-content] Step 3/3: DRY RUN — validating fixture against Railway DB ..."
else
  echo "[push-content] Step 3/3: Importing education content into Railway ..."
fi

docker compose -f docker-compose.yml -f docker-compose.dev.yml run --rm --no-deps \
  -e DATABASE_PUBLIC_URL="$RAILWAY_DB" \
  -e DATABASE_URL="$RAILWAY_DB" \
  -v "$(dirname "$FIXTURE"):/tmp/import:ro" \
  backend python manage.py import_education_content "/tmp/import/$(basename "$FIXTURE")" $DRY_RUN

# Cleanup
rm -f "$FIXTURE"

echo ""
echo "[push-content] Done. Content pushed to Railway successfully."

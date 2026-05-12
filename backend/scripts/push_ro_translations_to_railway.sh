#!/bin/bash
# Push Romanian (ro) translation rows from local Docker DB to Railway PostgreSQL.
# Upserts by (parent_id, language); does not rely on matching translation PKs.
#
# Usage (from repo root):
#   bash backend/scripts/push_ro_translations_to_railway.sh
#   bash backend/scripts/push_ro_translations_to_railway.sh --dry-run
#   bash backend/scripts/push_ro_translations_to_railway.sh --target sections
#
# Requires:
#   - Docker stack running locally
#   - English curriculum IDs aligned between Docker and Railway (same as rewrite push)
#
# Railway DB URL (first match wins):
#   1) RAILWAY_DB_URL in the environment (explicit override)
#   2) RAILWAY_DB_PUBLIC_URL or RAILWAY_DB_URL in backend/.env (gitignored; typical for local)
#   3) backend/.env.railway (optional; see backend/.env.railway.example)
#   4) railway variables get DATABASE_PUBLIC_URL
#
# Extra args are passed through to: python manage.py push_ro_translations_to_railway

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
REPO_ROOT="$(cd "$BACKEND_DIR/.." && pwd)"

# Read KEY=value from a dotenv file (first = separates key; value may contain =).
# Supports optional "export " prefix and optional single/double quotes.
_read_dotenv_url() {
  local file="$1" key="$2"
  [ -r "$file" ] || return 1
  local line val
  line=$(grep -E "^[[:space:]]*(export[[:space:]]+)?${key}=" "$file" 2>/dev/null | tail -n1) || return 1
  [ -n "$line" ] || return 1
  val="${line#*=}"
  val="${val%"${val##*[![:space:]]}"}"
  val="${val#"${val%%[![:space:]]*}"}"
  val="${val//$'\r'/}"
  if [[ "$val" == \"*\" ]]; then val="${val#\"}"; val="${val%\"}"; fi
  if [[ "$val" == \'*\' ]]; then val="${val#\'}"; val="${val%\'}"; fi
  printf '%s' "$val"
}

if [ -n "${RAILWAY_DB_URL:-}" ]; then
  echo "Using RAILWAY_DB_URL from environment."
elif [ -f "$BACKEND_DIR/.env" ]; then
  _v=""
  _v=$(_read_dotenv_url "$BACKEND_DIR/.env" "RAILWAY_DB_PUBLIC_URL" 2>/dev/null) || true
  if [ -n "${_v:-}" ]; then
    RAILWAY_DB_URL="$_v"
    echo "Using RAILWAY_DB_PUBLIC_URL from backend/.env."
  else
    _v=$(_read_dotenv_url "$BACKEND_DIR/.env" "RAILWAY_DB_URL" 2>/dev/null) || true
    if [ -n "${_v:-}" ]; then
      RAILWAY_DB_URL="$_v"
      echo "Using RAILWAY_DB_URL from backend/.env."
    fi
  fi
fi

if [ -z "${RAILWAY_DB_URL:-}" ] && [ -f "$BACKEND_DIR/.env.railway" ]; then
  echo "Loading RAILWAY_DB_URL from backend/.env.railway ..."
  set -a
  # shellcheck disable=SC1091
  . "$BACKEND_DIR/.env.railway"
  set +a
fi

if [ -z "${RAILWAY_DB_URL:-}" ]; then
  echo "Fetching Railway DATABASE_PUBLIC_URL (Railway CLI)..."
  RAILWAY_DB_URL=$(railway variables get DATABASE_PUBLIC_URL 2>/dev/null || true)
fi

if [ -z "$RAILWAY_DB_URL" ]; then
  echo ""
  echo "No RAILWAY_DB_URL yet. Set one of:"
  echo "  • RAILWAY_DB_PUBLIC_URL=postgresql://... in backend/.env"
  echo "  • export RAILWAY_DB_URL='postgresql://...'"
  echo "  • backend/.env.railway (see backend/.env.railway.example)"
  echo "  • Or paste DATABASE_PUBLIC_URL from Railway → PostgreSQL → Variables:"
  read -r -p "DATABASE_PUBLIC_URL: " RAILWAY_DB_URL
fi

if [ -z "$RAILWAY_DB_URL" ]; then
  echo "No URL provided. Aborting."
  exit 1
fi

echo ""
echo "Pushing Romanian translations to Railway..."
cd "$REPO_ROOT"
docker compose exec -e RAILWAY_DB_URL="$RAILWAY_DB_URL" backend \
  python manage.py push_ro_translations_to_railway "$@"

echo ""
echo "Done."

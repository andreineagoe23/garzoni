#!/usr/bin/env bash
# Dump Railway Postgres to backend/backups/ using pg_dump in a throwaway container.
# Reads the same URL as push_ro_translations_to_railway.sh:
#   RAILWAY_DB_URL (env) → RAILWAY_DB_PUBLIC_URL / RAILWAY_DB_URL in backend/.env → backend/.env.railway
#
# Usage (repo root):
#   bash backend/scripts/backup_railway_postgres.sh
#   bash backend/scripts/backup_railway_postgres.sh /path/to/dir
#
# Requires: Docker. Does not require a local pg_dump install.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
PROJECT_ROOT="$(cd "$BACKEND_DIR/.." && pwd)"
OUTPUT_DIR="${1:-$BACKEND_DIR/backups}"
TIMESTAMP="$(date +%Y-%m-%d_%H%M%S)"
OUTFILE="railway_postgres_${TIMESTAMP}.dump"

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

RAILWAY_DB_URL="${RAILWAY_DB_URL:-}"
if [ -z "$RAILWAY_DB_URL" ] && [ -f "$BACKEND_DIR/.env" ]; then
  _v=$(_read_dotenv_url "$BACKEND_DIR/.env" "RAILWAY_DB_PUBLIC_URL" 2>/dev/null) || true
  if [ -n "${_v:-}" ]; then RAILWAY_DB_URL="$_v"; fi
fi
if [ -z "$RAILWAY_DB_URL" ] && [ -f "$BACKEND_DIR/.env" ]; then
  _v=$(_read_dotenv_url "$BACKEND_DIR/.env" "RAILWAY_DB_URL" 2>/dev/null) || true
  if [ -n "${_v:-}" ]; then RAILWAY_DB_URL="$_v"; fi
fi
if [ -z "$RAILWAY_DB_URL" ] && [ -f "$BACKEND_DIR/.env.railway" ]; then
  set -a
  # shellcheck disable=SC1091
  . "$BACKEND_DIR/.env.railway"
  set +a
fi

if [ -z "${RAILWAY_DB_URL:-}" ]; then
  echo "Set RAILWAY_DB_PUBLIC_URL or RAILWAY_DB_URL in backend/.env (or export RAILWAY_DB_URL)." >&2
  exit 1
fi

mkdir -p "$OUTPUT_DIR"
echo "Backing up Railway Postgres to $OUTPUT_DIR/$OUTFILE (custom format) ..."

docker run --rm \
  -v "$OUTPUT_DIR:/out" \
  -e DATABASE_URL="$RAILWAY_DB_URL" \
  -e OUTFILE="$OUTFILE" \
  postgres:17-alpine \
  sh -c 'pg_dump "$DATABASE_URL" -Fc --no-owner --no-acl -f "/out/$OUTFILE"'

echo "Backup written to $OUTPUT_DIR/$OUTFILE"
echo "Restore (example): pg_restore --clean --if-exists -d \"\$TARGET_URL\" \"$OUTPUT_DIR/$OUTFILE\""

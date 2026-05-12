#!/usr/bin/env bash
# Run local Docker DB backup, then Railway backup (same defaults as sibling scripts).
# Usage (repo root): bash backend/scripts/backup_all_postgres.sh [output_dir]
#
# Local:  plain SQL via docker compose exec db pg_dump
# Railway: custom-format .dump via postgres:17-alpine + RAILWAY_DB_PUBLIC_URL in backend/.env

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OUT="${1:-}"

echo "=== Local Docker Postgres ==="
if [ -n "$OUT" ]; then
  bash "$SCRIPT_DIR/backup_postgres.sh" "$OUT"
else
  bash "$SCRIPT_DIR/backup_postgres.sh"
fi

echo ""
echo "=== Railway Postgres ==="
if [ -n "$OUT" ]; then
  bash "$SCRIPT_DIR/backup_railway_postgres.sh" "$OUT"
else
  bash "$SCRIPT_DIR/backup_railway_postgres.sh"
fi

echo ""
echo "All backups finished."

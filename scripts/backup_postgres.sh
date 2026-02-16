#!/usr/bin/env sh
# Backup Postgres database (monevo) via Docker.
# Usage: ./scripts/backup_postgres.sh [output_dir]
# Default output_dir: ./backups
# Requires: docker compose, db service must be running (docker compose up -d db).

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
OUTPUT_DIR="${1:-$PROJECT_ROOT/backups}"
TIMESTAMP="$(date +%Y-%m-%d_%H%M%S)"
BACKUP_FILE="monevo_postgres_${TIMESTAMP}.sql"

mkdir -p "$OUTPUT_DIR"
cd "$PROJECT_ROOT"

echo "Backing up Postgres (monevo) to $OUTPUT_DIR/$BACKUP_FILE ..."
docker compose exec -T db pg_dump -U "${POSTGRES_USER:-monevo}" "${POSTGRES_DB:-monevo}" --no-owner --no-acl -Fp > "$OUTPUT_DIR/$BACKUP_FILE"

echo "Backup written to $OUTPUT_DIR/$BACKUP_FILE"
echo "To restore: docker compose exec -T db psql -U ${POSTGRES_USER:-monevo} ${POSTGRES_DB:-monevo} < $OUTPUT_DIR/$BACKUP_FILE"

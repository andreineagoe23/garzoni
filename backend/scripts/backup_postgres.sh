#!/usr/bin/env bash
# Backup local Docker Compose Postgres (`db` service) to backend/backups.
# Uses POSTGRES_USER / POSTGRES_DB from inside the db container (matches your compose env).
#
# Usage (repo root):
#   bash backend/scripts/backup_postgres.sh
#   bash backend/scripts/backup_postgres.sh /path/to/dir
#
# Requires: docker compose, db service running.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
OUTPUT_DIR="${1:-$PROJECT_ROOT/backend/backups}"
TIMESTAMP="$(date +%Y-%m-%d_%H%M%S)"
BACKUP_FILE="local_postgres_${TIMESTAMP}.sql"

mkdir -p "$OUTPUT_DIR"
cd "$PROJECT_ROOT"

echo "Backing up local Docker Postgres to $OUTPUT_DIR/$BACKUP_FILE ..."
docker compose exec -T db sh -c 'pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" --no-owner --no-acl -Fp' > "$OUTPUT_DIR/$BACKUP_FILE"

echo "Backup written to $OUTPUT_DIR/$BACKUP_FILE"
echo "Restore (destructive; test on a copy): docker compose exec -T db psql -U \"\$POSTGRES_USER\" \"\$POSTGRES_DB\" < \"$OUTPUT_DIR/$BACKUP_FILE\""

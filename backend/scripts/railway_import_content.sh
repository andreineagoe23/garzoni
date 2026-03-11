#!/usr/bin/env bash
#
# Push education content to Railway: clear then import fixture via railway ssh.
#
# Prereqs: fixture committed and deployed (see backend/backups/README.md),
# Railway CLI linked to backend service.
#
# Usage (from repo root):  ./backend/scripts/railway_import_content.sh
#
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$BACKEND_DIR"

FIXTURE="/app/backups/railway_education_content.json"

# Clear then import. Requires clear_education_content on the server (deploy once to get it).
echo "[railway-import] Clearing education content, then loading fixture ..."
railway ssh -- python manage.py clear_education_content
railway ssh -- python manage.py import_education_content "$FIXTURE"

echo "[railway-import] Done."

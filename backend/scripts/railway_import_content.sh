#!/usr/bin/env bash
#
# Push education content to Railway **without** deploying new code.
# Clears education content on Railway via a Django shell one-liner (uses existing
# models), then runs import_education_content (no --replace flag needed on server).
#
# Prereqs: fixture in repo and deployed (git add -f backend/backups/railway_education_content.json, push),
# and Railway CLI linked to the backend service.
#
# Usage (from repo root):
#   ./backend/scripts/railway_import_content.sh
# Or from backend/:
#   ./scripts/railway_import_content.sh
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

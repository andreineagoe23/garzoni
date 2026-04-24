#!/bin/bash
# Push AI-rewritten lesson sections from local Docker DB to Railway production.
#
# Usage:
#   bash backend/scripts/push_rewrites_to_railway.sh
#
# Requires:
#   - Railway CLI installed and logged in (npm install -g @railway/cli)
#   - Docker stack running locally
#
# The script fetches DATABASE_PUBLIC_URL from Railway automatically.
# Run from the repo root.

set -euo pipefail

echo "Fetching Railway DATABASE_PUBLIC_URL..."
RAILWAY_DB_URL=$(railway variables get DATABASE_PUBLIC_URL 2>/dev/null)

if [ -z "$RAILWAY_DB_URL" ]; then
  echo ""
  echo "Could not auto-fetch from Railway CLI."
  echo "Paste your DATABASE_PUBLIC_URL from Railway dashboard → PostgreSQL → Variables:"
  read -r -p "DATABASE_PUBLIC_URL: " RAILWAY_DB_URL
fi

if [ -z "$RAILWAY_DB_URL" ]; then
  echo "No URL provided. Aborting."
  exit 1
fi

echo ""
echo "Pushing rewrites to Railway..."
docker compose exec -e RAILWAY_DB_URL="$RAILWAY_DB_URL" backend \
  python manage.py push_rewrites_to_railway

echo ""
echo "Done."

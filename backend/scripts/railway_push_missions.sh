#!/usr/bin/env bash
#
# Push mission pool to Railway: load from fixture then backfill MissionCompletion for existing users.
#
# Prereqs: mission_pool.json committed (backend/gamification/fixtures/mission_pool.json),
# Railway CLI linked to backend service. Deploy at least once so the backend image includes the fixture.
#
# Usage (from repo root):  ./backend/scripts/railway_push_missions.sh
#
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$BACKEND_DIR"

# Run inside Railway backend container (fixture at /app/gamification/fixtures/mission_pool.json)
echo "[railway-missions] Loading mission pool from fixture ..."
railway ssh -- python manage.py load_mission_pool

echo "[railway-missions] Backfilling MissionCompletion for existing users ..."
railway ssh -- python manage.py backfill_mission_completions

echo "[railway-missions] Done."

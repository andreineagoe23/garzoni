#!/usr/bin/env bash
#
# Regenerate education/content/exercises_release.json from the current DB (e.g. local Docker).
# Then bump exercises_version in education/content/release_manifest.json and commit both.
#
# Usage (from repo root):
#   ./backend/scripts/export_exercises_release.sh
#
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$BACKEND_DIR"

if docker compose ps backend 2>/dev/null | grep -q "Up"; then
  echo "[export-exercises] Using docker compose backend ..."
  docker compose exec -T backend python manage.py export_exercises_release
else
  echo "[export-exercises] Running manage.py locally ..."
  python manage.py export_exercises_release || python3 manage.py export_exercises_release
fi

echo "[export-exercises] Done. Remember to bump exercises_version in education/content/release_manifest.json if content changed."

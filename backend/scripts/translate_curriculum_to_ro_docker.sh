#!/bin/bash
# Fill Romanian (ro) translation tables in the local Docker Postgres using OpenAI.
# Run after `docker compose up`; requires OPENAI_API_KEY for the backend service.
#
# Usage (from repo root):
#   bash backend/scripts/translate_curriculum_to_ro_docker.sh
#   bash backend/scripts/translate_curriculum_to_ro_docker.sh --limit 5
#   bash backend/scripts/translate_curriculum_to_ro_docker.sh --course-id 12 --only-missing
#   bash backend/scripts/translate_curriculum_to_ro_docker.sh --sections-only --section-types text --only-missing
#
# With no arguments, runs: translate_lessons_to_ro --only-missing (idempotent backfill).
# Otherwise passes your args through (see: python manage.py translate_lessons_to_ro --help).
# This script then runs audit_ro_translations with no extra args.

set -euo pipefail

if [ "$#" -eq 0 ]; then
  TRANSLATE_ARGS=(--only-missing)
else
  TRANSLATE_ARGS=("$@")
fi

echo "=== translate_lessons_to_ro ${TRANSLATE_ARGS[*]} ==="
docker compose exec backend python manage.py translate_lessons_to_ro "${TRANSLATE_ARGS[@]}"

echo ""
echo "=== audit_ro_translations ==="
docker compose exec backend python manage.py audit_ro_translations

echo ""
echo "Done. When satisfied, push to Railway: bash backend/scripts/push_ro_translations_to_railway.sh --dry-run"

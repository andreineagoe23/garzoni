#!/usr/bin/env sh
set -eu

echo "[railway-predeploy] Starting pre-deploy checks and content gates..."

# 1) Schema first.
python manage.py migrate --noinput

# 2) Deterministic in-place content sync (versioned/idempotent).
python manage.py sync_content --only lessons,exercises --noinput

# 3) Validate and remediate lesson videos before release.
python manage.py verify_lesson_video_embeds --check-live --fix

# 4) Hard quality gate: fail deploy if lesson structure/content checks fail.
python manage.py validate_lesson_quality_gates

# 5) Static assets.
python manage.py collectstatic --noinput

echo "[railway-predeploy] Completed successfully."

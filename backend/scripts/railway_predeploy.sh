#!/usr/bin/env sh
set -eu

echo "[railway-predeploy] Starting pre-deploy checks and content gates..."

# 1) Schema first.
python manage.py migrate --noinput

# 2) Optional one-time lesson rebuild.
#    Enable only when needed:
#      RUN_CONTENT_REBUILD=1
#    Then disable it again after the first successful deploy.
if [ "${RUN_CONTENT_REBUILD:-0}" = "1" ]; then
  echo "[railway-predeploy] RUN_CONTENT_REBUILD=1 -> rebuilding lesson flow..."
  python manage.py rebuild_lessons_professional_flow
else
  echo "[railway-predeploy] Lesson rebuild skipped (RUN_CONTENT_REBUILD!=1)."
fi

# 3) Validate and remediate lesson videos before release.
python manage.py verify_lesson_video_embeds --check-live --fix

# 4) Hard quality gate: fail deploy if lesson structure/content checks fail.
python manage.py validate_lesson_quality_gates

# 5) Static assets.
python manage.py collectstatic --noinput

echo "[railway-predeploy] Completed successfully."

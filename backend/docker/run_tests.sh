#!/usr/bin/env sh
# Run Django tests and optionally queue Celery test tasks.
# Used by the Railway "Backend Tests" service. Exit code = test result (0 = pass).
set -eu

echo "[run_tests] Running migrations..."
python manage.py migrate --noinput

echo "[run_tests] Running Django test suite..."
python manage.py test --no-input -v 2

echo "[run_tests] Queuing Celery test tasks (check worker logs)..."
python manage.py run_celery_tests

echo "[run_tests] Done."
exit 0

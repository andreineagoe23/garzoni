# Railway Production Runbook

## Scope

Use this runbook for backend releases when Railway shell access is unavailable.

## Release Preparation

1. Confirm working tree is clean and release commit SHA is known.
2. Set Railway backend **Pre-deploy Command** to:

```bash
sh /app/scripts/railway_predeploy.sh
```

3. Keep Railway backend **Start Command** unchanged:

```bash
/bin/sh /app/docker/entrypoint.sh gunicorn settings.wsgi:application --workers 2 --timeout 300
```

## Content Sync Model

- Lesson and video updates are applied in-place by `sync_content_release`.
- **Exercise catalog** (questions, categories, `exercise_data`, multiple-choice rows, translations) is applied in-place by `sync_exercises_release` from `education/content/exercises_release.json`, gated by `exercises_version` in `education/content/release_manifest.json`.
- Sync is versioned and idempotent using DB state (`education_content_release_state` — keys `education_content` and `education_exercises`).
- No Railway shell or manual DB push is required for normal lesson + exercise releases.

### Shipping exercise changes (no console)

1. Update exercises in local Docker (or your canonical environment).
2. From repo root:
   ```bash
   ./backend/scripts/export_exercises_release.sh
   ```
   Or: `docker compose exec backend python manage.py export_exercises_release`
3. **Bump** `exercises_version` in `backend/education/content/release_manifest.json` (e.g. `2026.03.21.2`) whenever the JSON fixture changes.
4. Commit `exercises_release.json` + `release_manifest.json` and deploy. Pre-deploy runs `sync_exercises_release` automatically.

Use `--force` locally to re-apply the same version: `python manage.py sync_exercises_release --force`.

### Full education wipe + import (optional, destructive)

The fixture in `backend/backups/` plus `railway_import_content.sh` still clears **all** education tables (including exercises). Prefer the versioned exercise sync above for routine updates so user progress stays aligned with stable exercise primary keys.

## Pushing missions to Railway

After deploying backend code that includes `gamification/fixtures/mission_pool.json` and the `load_mission_pool` / `backfill_mission_completions` commands:

1. From repo root, with [Railway CLI](https://docs.railway.app/develop/cli) installed and linked to the backend service (`railway link`):
   ```bash
   ./backend/scripts/railway_push_missions.sh
   ```
2. The script runs inside the Railway backend container:
   - `load_mission_pool` — loads or updates missions from `/app/gamification/fixtures/mission_pool.json`.
   - `backfill_mission_completions` — creates missing `MissionCompletion` rows so all existing users see the full pool.

Run this whenever you add or change missions in the fixture and want production to match.

## Backup Policy

- Minimum cadence: **every 3 days**.
- Before each production deployment:
  1. create a manual DB backup/snapshot
  2. record release SHA + backup timestamp

Track this in release notes or your internal deployment log.

### Optional automated backup

Configure a scheduled GitHub Action (every 3 days) with secret `RAILWAY_DB_URL`.
The workflow stores encrypted DB dumps as build artifacts for recovery.

## Post-deploy Smoke Checks

1. API is up and authenticated flows work.
2. Lessons load for multiple paths and courses.
3. Section 4 video plays in representative lessons.
4. Exercises render and submit.
5. Dashboard progress and continue-learning cards work.

## Rollback Procedure

1. Redeploy previous known-good commit SHA.
2. If data integrity issue exists, restore the latest known-good DB backup.
3. Re-run smoke checks.

## Failure Handling

If pre-deploy fails:

- inspect deploy logs for the failing step
- fix the issue in code or env vars
- redeploy from the same release branch

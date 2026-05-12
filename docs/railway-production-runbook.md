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

## Romanian translations (local Docker, then push)

Use this when you generate **Romanian (`ro`) rows** in local Docker (`education_*_translation` tables) and want Railway production to match. This is separate from **AI lesson rewrites** ([`backend/scripts/push_rewrites_to_railway.sh`](../backend/scripts/push_rewrites_to_railway.sh)), which syncs English body copy via `EducationAuditLog`.

### Prerequisites

- **Same English curriculum IDs** on Docker and Railway (paths, courses, lessons, sections). If primary keys diverge between environments, upserts cannot be applied safely.
- **`OPENAI_API_KEY`** available to the backend container for translation.
- Take a **Railway DB backup** before the first push.

### 1. Translate locally

From repo root with Docker up:

```bash
# Idempotent backfill (default): missing `ro` rows only
bash backend/scripts/translate_curriculum_to_ro_docker.sh

# Or pass flags through to the management command, e.g. cost trial or scoped run:
bash backend/scripts/translate_curriculum_to_ro_docker.sh --limit 5
bash backend/scripts/translate_curriculum_to_ro_docker.sh --course-id 12 --force-refresh
```

Equivalent without the glue script:

```bash
docker compose exec backend python manage.py translate_lessons_to_ro --only-missing
docker compose exec backend python manage.py audit_ro_translations
```

Fix any issues reported by `audit_ro_translations`, then re-run translate with appropriate `--path-id`, `--course-id`, `--force-refresh`, etc.

### 2. Push `ro` rows to Railway

The push command upserts by **`(parent_id, language)`**, not by translation row primary key, so local and Railway translation `id` values do not need to match.

```bash
# Preview (no writes)
bash backend/scripts/push_ro_translations_to_railway.sh --dry-run

# Full push (paths → courses → lessons → sections)
bash backend/scripts/push_ro_translations_to_railway.sh

# Push only standalone practice catalog translations
bash backend/scripts/push_ro_translations_to_railway.sh --target standalone_exercises
```

Requires [Railway CLI](https://docs.railway.app/develop/cli) linked like the rewrite script; the shell wrapper sets `RAILWAY_DB_URL` from `DATABASE_PUBLIC_URL`.

**Standalone practice exercises** (`Exercise` / `ExerciseTranslation`, Exercises tab) are not covered by `translate_lessons_to_ro`. After curriculum translate + audit, run:

```bash
docker compose exec backend python manage.py translate_standalone_exercises_to_ro --only-missing
```

Then include them in the Railway push (`--target standalone_exercises` or full `all`). **`QuizTranslation`** (course quizzes) is still not automated here; extend similarly if needed.

### 3. Smoke-check

Switch the app locale to Romanian and spot-check paths, a few lessons, text sections, and in-lesson exercises.

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
6. Notification scheduler checks:
   - `django_celery_beat` rows exist and are enabled for `send-ai-nudges-daily` and `send-portfolio-push`.
   - Beat logs show periodic dispatch at expected windows.
7. Customer.io checks:
   - `/api/notifications/cio-ping/` returns `identify_ok=true` when called with `X-Garzoni-Cio-Ping`.
   - `CIO_TRANSACTIONAL_TRIGGERS_JSON` contains mapped IDs for `ai-nudge` and `portfolio-update`.

## Rollback Procedure

1. Redeploy previous known-good commit SHA.
2. If data integrity issue exists, restore the latest known-good DB backup.
3. Re-run smoke checks.

## Failure Handling

If pre-deploy fails:

- inspect deploy logs for the failing step
- fix the issue in code or env vars
- redeploy from the same release branch

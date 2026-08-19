# Railway Production Runbook

## Scope

Use this runbook for backend releases when Railway shell access is unavailable.

## Release Preparation

1. Confirm working tree is clean and release commit SHA is known.
2. Set Railway backend **Pre-deploy Command** to:

```bash
sh /app/scripts/railway_predeploy.sh
```

This one stays in the dashboard on purpose — see "Why preDeployCommand is not in
`railway.json`" below.

3. The **Start Command** and **healthcheck** now come from
   [`backend/railway.json`](../../backend/railway.json), not the dashboard. Do not
   re-add them in the UI; config-as-code overrides dashboard values for the fields
   it defines, so a stale dashboard entry is just confusing.

## Deploy config (`backend/railway.json`)

Railway reads `railway.json` from the service root directory (`/backend`). The file
sets:

| Field | Value | Why |
|---|---|---|
| `startCommand` | `/bin/sh /app/docker/entrypoint.sh gunicorn settings.wsgi:application` | No tuning flags — `docker/entrypoint.sh` appends `-c gunicorn.conf.py --workers $WEB_CONCURRENCY --threads $GUNICORN_THREADS --timeout $GUNICORN_TIMEOUT` **after** whatever the start command passes, and gunicorn lets the later flag win. The old command's `--worker-class gthread --workers 2 --threads 4 --timeout 300` was therefore dead: the deploy log has always shown `workers=3 threads=8 timeout=90s`. It read as though production allowed 300s requests. |
| `healthcheckPath` | `/health/` | Railway polls this until it returns 200 and only then makes the new deployment active and the old one inactive. Without it the old container stopped before the new one served: production HTTP logs on 2026-08-03 21:50 UTC show 8× `502` on `/api/public/lessons/<slug>/` — the exact paths the Vercel bot-prerender reads to build SEO snapshots. |
| `healthcheckTimeout` | `300` | Railway's default. The pre-deploy command (migrations + content sync + quality gates) runs before the container starts, so it does not eat this budget. |
| `restartPolicyType` / `MaxRetries` | `ON_FAILURE` / `3` | Unchanged behaviour, now version-controlled. |

**Celery services must NOT use this file.** Railway applies a config file to every service
whose root directory is `/backend`, and `healthcheckPath` is meaningless for a process that
serves no HTTP. The worker and beat services will poll `/health/` for the full
`healthcheckTimeout` and then fail the deploy — observed 2026-08-19 as
`Network › Healthcheck (04:53)`, i.e. ~293s against the 300s budget.

Point those two services at [`railway.celery.json`](../../backend/railway.celery.json) instead
(Railway service → Settings → Config-as-code → `/backend/railway.celery.json`; the path is
absolute from the repo root, not the service root). That file is this one minus
`healthcheckPath` and `healthcheckTimeout` — omitting them disables the check.

The `startCommand` is deliberately identical in both files. `docker/entrypoint.sh:16-20` reads
`SERVICE_ROLE` (falling back to `RAILWAY_SERVICE_NAME`) and, when the command is `gunicorn`,
swaps in `celery worker` or `celery beat` for those roles — so one start command covers all
three services and no Railway UI edit is needed for it. **The service must be named exactly
`worker` or `beat`**, or `SERVICE_ROLE` must be set explicitly; otherwise the role check misses,
gunicorn starts, the healthcheck passes, and you get a web server where you wanted a worker —
a failure that looks like success.

**No `build` block — deliberate.** `railway.json` originally carried
`"build": {"builder": "RAILPACK"}`. That was never verified against the service and it
contradicts the rest of the repo: CI builds `backend/Dockerfile`
(`.github/workflows/ci.yml`), docker-compose builds the same image, and the
`startCommand` above points at `/app/docker/entrypoint.sh` — a path that only exists in
that image. RAILPACK ignores the Dockerfile and auto-detects instead, so the start command
would reference a file the built image does not contain. Removed 2026-08-18 so Railway
keeps using whatever builder the service is already configured with. If you want the build
config in git, set it to the Dockerfile builder and verify a deploy before relying on it.

**`ALLOWED_HOSTS` dependency.** Railway sends healthcheck requests with
`Host: healthcheck.railway.app`. Django answers `DisallowedHost` 400 for unknown
hosts, so without that entry the healthcheck would never see a 200 and **every deploy
would fail** after the timeout — the gate meant to prevent downtime would cause it.
`settings.py` appends it unconditionally (next to the canonical-host block); do not
remove it.

**`/health/` returns 503 if Postgres or Redis is unreachable** (Celery broker only
warns — see `core/views.py`). That is correct for a readiness gate, but it means a
Redis outage will block deploys as well as traffic. If you need to ship during a
Redis incident, clear `healthcheckPath` in the dashboard for that one deploy.

### Why `preDeployCommand` is not in `railway.json`

The schema supports it (as an array), but the dashboard value is the live source of
truth and was not readable at the time this was written. Rather than guess and risk a
mismatch, it stays in the UI. If you move it into the file, use:

```json
"preDeployCommand": ["sh /app/scripts/railway_predeploy.sh"]
```

and delete the dashboard entry in the same change.

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

Use this when you generate **Romanian (`ro`) rows** in local Docker (`education_*_translation` tables) and want Railway production to match. This is separate from **AI lesson rewrites** ([`backend/scripts/push_rewrites_to_railway.sh`](../../backend/scripts/push_rewrites_to_railway.sh)), which syncs English body copy via `EducationAuditLog`.

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

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
- Sync is versioned and idempotent using DB state (`education_content_release_state`).
- No manual DB push or deploy-time env toggles are required for normal releases.

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

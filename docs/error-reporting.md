# Error reporting (Sentry)

We use Sentry so **you see errors before users complain**. Environment-based sampling: higher in production.

## What we track (minimum)

### Frontend

- **Tool render failures** – React errors in tools (ErrorBoundary + optional `reportToolError` with tool name).
- **Widget load errors** – Calendar or news embed fails (`reportWidgetLoadError` in EconomicCalendar, NewsMarketContext).
- **News fetch failures** – When the app calls the news API and it fails, use `reportNewsFetchError`.

### Backend

- **RSS ingestion failures** – All news feeds failed and no last-good cache (logged as warning in NewsFeedView).
- **Profile update errors** – Exceptions in profile/settings PATCH (UserProfileView, UserSettingsView).
- **Cache** – No automatic “cache corruption” event; if you add cache.set/get guards and detect corruption, report there.

## What we do NOT track

- Every click.
- Every render.
- Personal data (email, name, password, tokens). `beforeSend` scrubs these.

## Context sent with errors (safe only)

- **Tool name** (e.g. `calendar`, `news-context`).
- **User context**: anonymous (no PII).
- **Profile snapshot**: safe fields only (`has_goal`, `questionnaire_completed`, `dark_mode`), set when calling `reportToolError`.

## Environment variables

| Variable | Where | Value | Required |
|----------|--------|--------|----------|
| `REACT_APP_SENTRY_DSN` | Frontend (e.g. `frontend/.env`, Vercel/Railway env) | Sentry **DSN URL** for your **frontend** project | No – if missing, Sentry is disabled |
| `SENTRY_DSN` | Backend (e.g. `backend/.env`, Railway env) | Sentry **DSN URL** for your **backend** project | No – if missing, Sentry is disabled |

### What the value should be

- **Format**: a URL like `https://<key>@<org>.ingest.sentry.io/<project_id>`.
- **Where to get it**: [Sentry](https://sentry.io) → your org → **Projects** → create or open a project → **Settings → Client Keys (DSN)**. Copy the DSN.
- **Use two projects**: create one project for the **React** frontend and one for **Django** backend, so you get separate issues and release health per app. Each project has its own DSN.
- **Leave empty to disable**: if you don’t set the variable (or set it to empty), no events are sent and the app works normally.

### Example (do not commit real DSNs to git; use `.env` or platform env)

```bash
# Frontend (.env or Vercel env)
REACT_APP_SENTRY_DSN=https://abc123@o123456.ingest.sentry.io/1234567

# Backend (.env or Railway env)
SENTRY_DSN=https://def456@o123456.ingest.sentry.io/7654321
```

## Setup (code)

- **Frontend**: init in `frontend/src/sentry.ts`; helpers (`reportToolError`, `reportWidgetLoadError`, `reportNewsFetchError`) in same file.
- **Backend**: init in `backend/settings/settings.py`; capture in finance/views (news) and authentication/views_profile (profile update).

## Definition of done

- You see errors before users complain.
- Errors include: tool name, user context (anonymous), profile snapshot (safe fields only).

---

## Anything else? (optional)

- **Release tracking**: You can set `release` in Sentry.init (e.g. from `process.env.REACT_APP_VERCEL_GIT_COMMIT_SHA` or your build version) so errors are grouped by deploy. Not required for the minimum bar.
- **Backend release**: Similarly, set `release` in `sentry_sdk.init()` from your deploy tag or commit. Optional.
- **One project vs two**: Using one Sentry project for both frontend and backend is possible (same DSN for both) but not recommended; two projects keep issues and rate limits clearer.
- **Alerts**: In Sentry, configure alerts (e.g. email/Slack when new issues appear or spike) so you’re notified before users complain.
- **Implementation status**: The current implementation is complete for the minimum bar (tool/widget/news errors, RSS and profile failures, env-based sampling, PII scrubbing). No code changes required beyond setting the env vars.

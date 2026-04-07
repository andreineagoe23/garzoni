# Where environment variables live

Use the **same variable names** on the host (Railway, Vercel) and in local files. Do not commit real secrets.

## 1. Railway — Django API service

Set these on the **backend** service (the names below are what Django reads).

**Core**

| Variable |
|----------|
| `SECRET_KEY` |
| `DATABASE_URL` (or `DATABASE_PUBLIC_URL`) |
| `DJANGO_ENV` |
| `DEBUG` |
| `ALLOWED_HOSTS_CSV` |
| `FRONTEND_URL` |
| `BACKEND_URL` (optional; default is localhost API) |

**CORS / CSRF**

| Variable |
|----------|
| `CORS_ALLOWED_ORIGINS_CSV` |
| `CSRF_TRUSTED_ORIGINS_CSV` |

**Media (Cloudinary)**

| Variable |
|----------|
| `CLOUDINARY_URL` **or** `CLOUDINARY_CLOUD_NAME` + `CLOUDINARY_API_KEY` + `CLOUDINARY_API_SECRET` |
| `DJANGO_MEDIA_STORAGE_BACKEND` (if you override storage) |

**Course / badge / reward images (paths, Cloudinary, local Docker)**

1. **Local filesystem (Docker default):** Files must exist under `backend/media/` with the same relative paths the DB expects (e.g. `path_images/basicfinance.png`). The API normalizes bogus legacy `*/backend/media/` prefixes in URLs, but if the DB still points at random upload names (e.g. `ew8l….png`), images 404. Run **`python manage.py fix_local_media_image_paths`** inside the backend container (use `--dry-run` first) to remap Path/Course/Badge/Reward rows to seed filenames that exist on disk.
2. **Serve from Cloudinary in production:** Set `DJANGO_MEDIA_STORAGE_BACKEND` to your Cloudinary storage backend (see Django `django-cloudinary-storage`), set `CLOUDINARY_URL`, then upload and align DB:
   - From repo root: `node scripts/upload-cloudinary-images.js` (needs `CLOUDINARY_*` or `CLOUDINARY_URL`).
   - Then in `backend/`: `python manage.py migrate_cloudinary_images` (uses `scripts/cloudinary-upload-results.json`; see the command module for flags).
3. **Marketing-only assets** (login backgrounds, topic fallbacks): configured in `packages/core/src/images.ts` via `VITE_CLOUDINARY_CLOUD_NAME` / `EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME` and the `garzoni/…` public IDs from the upload script.

**Google (web redirect + ID tokens)**

| Variable |
|----------|
| `GOOGLE_OAUTH_CLIENT_ID` |
| `GOOGLE_OAUTH_CLIENT_SECRET` |
| `GOOGLE_OAUTH_IOS_CLIENT_ID` (native iOS Sign-In `aud`) |
| `GOOGLE_OAUTH_ANDROID_CLIENT_ID` (native Android, if used) |
| `GOOGLE_OAUTH_CLIENT_IDS_CSV` (optional extra client IDs, comma-separated) |
| `GOOGLE_OAUTH_REDIRECT_BASE` (optional; public origin for OAuth callback only, e.g. `https://www.garzoni.app` — must match **Authorized redirect URIs** in Google Cloud) |
| `GOOGLE_OAUTH_REDIRECT_FROM_REQUEST` (`1` / `true` — use request `Host` for redirect_uri; defaults **on when `DEBUG`** so LAN hits like `http://192.168.x.x:8000` match Google; set `0` to force `FRONTEND_URL` only) |

**Sign in with Apple (native)**

| Variable |
|----------|
| `APPLE_SIGNIN_BUNDLE_ID` (e.g. same as iOS bundle id) |
| `APPLE_SIGNIN_AUDIENCES_CSV` (optional; comma-separated JWT `aud` values) |

**Stripe**

| Variable |
|----------|
| `STRIPE_SECRET_KEY` |
| `STRIPE_PUBLISHABLE_KEY` |
| `STRIPE_WEBHOOK_SECRET` |
| `STRIPE_PRICE_PLUS_MONTHLY` |
| `STRIPE_PRICE_PRO_MONTHLY` |
| `STRIPE_PRICE_PLUS_ANNUAL` or `STRIPE_PRICE_PLUS_YEARLY` |
| `STRIPE_PRICE_PRO_ANNUAL` or `STRIPE_PRICE_PRO_YEARLY` |
| `STRIPE_DEFAULT_PROMOTION_CODE` (optional) |

**reCAPTCHA**

| Variable |
|----------|
| `RECAPTCHA_SITE_KEY` |
| `RECAPTCHA_ENTERPRISE_PROJECT_ID` (Google Cloud **project ID**, e.g. `my-project-123` — not a key string; wrong id → API 403 `PERMISSION_DENIED`) |
| `RECAPTCHA_ENTERPRISE_API_KEY` |
| `RECAPTCHA_REQUIRED_SCORE` (optional) |
| `RECAPTCHA_DISABLED` (`1` / `true` — **local only**; skips token check on login/register) |

**Email**

| Variable |
|----------|
| `EMAIL_HOST` |
| `EMAIL_PORT` |
| `EMAIL_USE_TLS` |
| `EMAIL_HOST_USER` |
| `EMAIL_HOST_PASSWORD` |
| `DEFAULT_FROM_EMAIL` |
| `CONTACT_EMAIL` |

**Other (optional)**

| Variable |
|----------|
| `REDIS_URL` / `CELERY_BROKER_URL` |
| `OPENAI_API_KEY` |
| `SENTRY_DSN` |
| `ALPHA_VANTAGE_API_KEY` |
| `HF_API_KEY`, `OPENROUTER_API_KEY` (only if something in your deploy consumes them) |

Railway may inject `RAILWAY_GIT_COMMIT_SHA`, `RAILWAY_RUN_UID`, etc. automatically.

---

## 2. Vercel (or any Vite frontend host)

The Vite config exposes **`VITE_*`** and **`REACT_APP_*`** to the browser bundle (`envPrefix` in `frontend/vite.config.ts`). You do **not** have to rename existing Vercel vars.

| Variable | Purpose |
|----------|---------|
| `VITE_BACKEND_URL` or `REACT_APP_BACKEND_URL` | API base; normalized to `…/api` in `@garzoni/core` |
| `VITE_CLOUDINARY_CLOUD_NAME` or `REACT_APP_CLOUDINARY_CLOUD_NAME` | Cloudinary cloud name for `Images.*` (login/register backgrounds) |
| `VITE_GOOGLE_OAUTH_CLIENT_ID` or `REACT_APP_GOOGLE_OAUTH_CLIENT_ID` | Web Google One Tap / button (same value as `GOOGLE_OAUTH_CLIENT_ID` on Railway) |
| `VITE_RECAPTCHA_SITE_KEY` or `REACT_APP_RECAPTCHA_SITE_KEY` | Must match backend `RECAPTCHA_SITE_KEY` |
| `VITE_SENTRY_DSN` or `REACT_APP_SENTRY_DSN` | Frontend Sentry DSN |

CKEditor: `REACT_APP_CKEDITOR_LICENSE_KEY_*` continue to work with the prefix above.

---

## 3. Local development

| File | Used by |
|------|---------|
| `backend/.env` | `python manage.py runserver`, Docker backend (same names as Railway) |
| `frontend/.env` or `frontend/.env.development.local` | Vite (`VITE_*` only). **Do not** set `VITE_RECAPTCHA_SITE_KEY` / `REACT_APP_RECAPTCHA_SITE_KEY` to an empty string in `.env.development.local` — it overrides `frontend/.env` and causes `recaptcha_missing` while the backend still expects a token. |
| `mobile/.env` | Expo / Metro (`EXPO_PUBLIC_*` + optional `CLOUDINARY_*` for scripts) |
| Repo root `.env` | **Docker Compose only** (`POSTGRES_*` for the db container) — not read by Django |

**Mobile (`mobile/.env`)**

| Variable |
|----------|
| `EXPO_PUBLIC_BACKEND_URL` |
| `EXPO_PUBLIC_WEB_APP_URL` (optional; web app origin for Tools / Legal WebViews, e.g. `https://app.example.com`) |
| `EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME` |
| `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` |
| `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` |
| `EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME` (optional; if omitted, derived from `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` as `com.googleusercontent.apps.{id-prefix}`) |

**Formatting:** no space after `=` in `.env` (e.g. `EXPO_PUBLIC_BACKEND_URL=https://…`, not `= https://…`). Use **`https://`** for production Railway/Vercel, not `http://`.

**API URL:** You may set `EXPO_PUBLIC_BACKEND_URL` to either `https://your-api.up.railway.app` or `https://your-api.up.railway.app/api` — the client normalizes to a single `/api` base.

`app.config.js` copies `EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME` into `extra.cloudinaryCloudName` and `EXPO_PUBLIC_WEB_APP_URL` into `extra.webAppUrl` for native. The Google Sign-In plugin’s iOS URL scheme is set from `EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME` or derived from the iOS client id; **after changing these, run a fresh native build** (`npx expo prebuild --clean` or EAS build), not only `expo start`.

**EAS builds:** define the same `EXPO_PUBLIC_*` values as EAS secrets.

---

## 4. Quick “what am I missing?”

| Symptom | Add / fix |
|---------|-----------|
| Web login backgrounds empty | `VITE_CLOUDINARY_CLOUD_NAME` on **Vercel** + images uploaded to Cloudinary under `garzoni/…` |
| `Not Found: /media/.../path_images` or doubled legacy `*/backend/media` in URL | Backend serializers normalize paths; ensure files exist under `backend/media/path_images/` (Docker seed) or migrate to Cloudinary + `migrate_cloudinary_images` |
| Mobile Google “not configured” / invalid token | `GOOGLE_OAUTH_IOS_CLIENT_ID` (and/or Android / CSV) on **Railway** |
| Mobile Google “missing URL scheme com.googleusercontent.apps.…” | Set `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` (or explicit `EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME`), then **rebuild the iOS app** (scheme is baked into `Info.plist` at prebuild). |
| Vercel `REACT_APP_BACKEND_URL` | Use **`https://`** for production API origin (match Railway’s public URL). |
| Mobile Apple fails after token | `APPLE_SIGNIN_BUNDLE_ID` or `APPLE_SIGNIN_AUDIENCES_CSV` on **Railway** |
| Frontend Sentry never reports | `VITE_SENTRY_DSN` on **Vercel** |
| CORS errors from production web | `CORS_ALLOWED_ORIGINS_CSV` on **Railway** includes your exact site origin |
| Google **redirect_uri_mismatch** (web) | In Google Cloud → Credentials → Web client, add **Authorized redirect URI** exactly `{FRONTEND_URL}/api/auth/google/callback` (same scheme/host as users’ browser, e.g. `https://www.garzoni.app/api/auth/google/callback`). Ensure Railway `FRONTEND_URL` matches that origin, or set `GOOGLE_OAUTH_REDIRECT_BASE` to that origin. Backend logs `Google OAuth redirect_uri=…` on each sign-in attempt. |
| **recaptcha_missing** (local dev) | Remove empty recaptcha keys from `frontend/.env.development.local`, or set `RECAPTCHA_DISABLED=1` in `backend/.env` (never in production). |

---

## 5. No `.env.example` files

Templates were removed to avoid drift. This file is the checklist; copy variable **names** into Railway / Vercel / local `.env` yourself.

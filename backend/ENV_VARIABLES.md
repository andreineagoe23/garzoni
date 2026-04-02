# Backend environment variables

This document lists environment variables used by the Monevo Django backend. For a copy-paste template with commented placeholders, use **`backend/.env.example`**.

Variables are loaded from `backend/.env` (via `python-dotenv` in `backend/settings/settings.py`). Never commit `.env` or real secrets.

## Required (production)

| Variable | Description |
|----------|-------------|
| `SECRET_KEY` or `DJANGO_SECRET_KEY` | Django secret key. Generate with: `python -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())"` |
| `DATABASE_URL` or `DATABASE_PUBLIC_URL` | PostgreSQL connection URL (e.g. `postgresql://user:pass@host:5432/dbname`). On Railway, `DATABASE_PUBLIC_URL` is preferred when the private host is unreachable at deploy time. <!-- pragma: allowlist secret --> |

## Optional (with defaults)

### Django / app

| Variable | Default | Description |
|----------|---------|-------------|
| `DJANGO_ENV` | `production` | Environment name (e.g. `production`, `staging`). |
| `DEBUG` | `True` when `DJANGO_ENV != "production"` | Enable debug mode. Must be `False` in production. |
| `ALLOWED_HOSTS_CSV` / `ALLOWED_HOSTS` | See settings | Comma-separated list of allowed hosts. |
| `TIME_ZONE` | `UTC` | Django time zone. |
| `FRONTEND_URL` | `http://localhost:3000` (DEBUG) / `https://www.monevo.tech` | Frontend origin for redirects and links. |
| `FRONTEND_BUILD_DIR` | `../frontend/dist` | Path to built SPA (Vite output) when serving from Django/WhiteNoise. |

### CORS / CSRF

| Variable | Default | Description |
|----------|---------|-------------|
| `CORS_ALLOWED_ORIGINS_CSV` / `CORS_ALLOWED_ORIGINS` | In DEBUG: localhost:3000, etc. | Comma-separated origins allowed for CORS. |
| `CSRF_TRUSTED_ORIGINS_CSV` / `CSRF_TRUSTED_ORIGINS` | `[]` | Comma-separated origins trusted for CSRF. |
| `CSRF_COOKIE_DOMAIN` | (none) | Optional cookie domain for CSRF. |
| `CORS_ALLOW_CREDENTIALS` | `True` | Allow credentials in CORS. |

**Production (e.g. Railway) checklist:** Set `CORS_ALLOWED_ORIGINS_CSV` to your real web app origin(s), such as `https://www.monevo.tech` (no trailing slash). Django raises at startup if this is empty when `DEBUG=False`. Native mobile apps do not send an `Origin` header for typical API calls, so they are not affected by CORS.

### Email (SMTP)

| Variable | Default | Description |
|----------|---------|-------------|
| `EMAIL_HOST` | `smtp.gmail.com` | SMTP host. |
| `EMAIL_PORT` | `587` | SMTP port. |
| `EMAIL_USE_TLS` | `True` | Use TLS. |
| `EMAIL_USE_SSL` | `False` | Use SSL (e.g. port 465). |
| `EMAIL_HOST_USER` | `""` | SMTP user. |
| `EMAIL_HOST_PASSWORD` | `""` | SMTP password. |
| `DEFAULT_FROM_EMAIL` | `EMAIL_HOST_USER` or `webmaster@localhost` | From address. |
| `CONTACT_EMAIL` | (none) | Contact form recipient; falls back to `DEFAULT_FROM_EMAIL`. |

### Stripe

| Variable | Default | Description |
|----------|---------|-------------|
| `STRIPE_SECRET_KEY` | `""` | Stripe secret key. |
| `STRIPE_WEBHOOK_SECRET` | `""` | Webhook signing secret. |
| `STRIPE_PUBLISHABLE_KEY` | `""` | Publishable key (for frontend). |
| `STRIPE_PRICE_PLUS_YEARLY` / `STRIPE_PRICE_PLUS_ANNUAL` | (none) | Price ID for Plus yearly. |
| `STRIPE_PRICE_PRO_YEARLY` / `STRIPE_PRICE_PRO_ANNUAL` | (none) | Price ID for Pro yearly. |
| `STRIPE_PRICE_PLUS_MONTHLY` | (none) | Price ID for Plus monthly. |
| `STRIPE_PRICE_PRO_MONTHLY` | (none) | Price ID for Pro monthly. |
| `STRIPE_DEFAULT_PRICE_ID` | (none) | Fallback price ID. |
| `STRIPE_DEFAULT_PROMOTION_CODE` | (none) | Optional promotion code at checkout. |

**Apple IAP (iOS subscriptions, not implemented yet):** Digital subscriptions offered inside the iOS app must use Apple In-App Purchase, not Stripe. A future backend milestone would add receipt / App Store Server API verification, Apple Server Notifications v2, and entitlement updates via the same `UserProfile` fields used by Stripe (`authentication.services.subscriptions.apply_subscription_to_profile`). Plan mobile paywall and web vs App Store management before shipping iOS subscriptions.

### JWT (mobile-friendly sessions)

| Variable | Default | Description |
|----------|---------|-------------|
| `JWT_REFRESH_TOKEN_DAYS` | `30` | Refresh token lifetime in days (clamped 1–366 in settings). Access token lifetime stays 30 minutes in code. |

**API authentication:** `REST_FRAMEWORK` uses `JWTAuthentication` only — clients send `Authorization: Bearer <access_jwt>` on protected routes. The refresh endpoint (`POST /api/token/refresh/`) accepts `{"refresh": "<refresh_jwt>"}` in the JSON body; the httpOnly refresh cookie is still set on login/register/OAuth responses for backward compatibility, but SPA and native clients should store the refresh token from the JSON response (or URL hash for the Google redirect flow) and refresh without relying on cookies. Logout accepts an optional `refresh` field in the body to blacklist the refresh token when no cookie is present.

### reCAPTCHA

| Variable | Default | Description |
|----------|---------|-------------|
| `RECAPTCHA_SITE_KEY` | `""` | reCAPTCHA site key (Enterprise or v3). |
| `RECAPTCHA_ENTERPRISE_PROJECT_ID` | `""` | Google Cloud project ID (Enterprise). |
| `RECAPTCHA_ENTERPRISE_API_KEY` | `""` | Enterprise API key. |
| `RECAPTCHA_REQUIRED_SCORE` | `0.3` | Score threshold (0.0–1.0). |
| `RECAPTCHA_PUBLIC_KEY` / `RECAPTCHA_PRIVATE_KEY` | (none) | Legacy v3 keys if Enterprise not used. |

**Mobile:** Native clients cannot run reCAPTCHA v3. For `POST /api/login-secure/` and `POST /api/register-secure/`, send `client_type: "mobile"` or `platform: "mobile"` in the JSON body to skip reCAPTCHA when it is configured. Throttling still applies. For stronger abuse protection later, consider Firebase App Check (or similar) for mobile.

### Google OAuth

| Variable | Default | Description |
|----------|---------|-------------|
| `GOOGLE_OAUTH_CLIENT_ID` | `""` | Web OAuth client ID (authorization redirect + optional ID token). |
| `GOOGLE_OAUTH_CLIENT_SECRET` | `""` | OAuth client secret (web code exchange). |
| `GOOGLE_OAUTH_CLIENT_IDS_CSV` | (none) | Optional comma-separated extra client IDs whose ID tokens are accepted by `POST /api/auth/google/verify-credential/` (e.g. iOS + Android + web if not already in `GOOGLE_OAUTH_CLIENT_ID`). |
| `GOOGLE_OAUTH_IOS_CLIENT_ID` | (none) | Optional iOS OAuth client ID (merged into allowed ID token audiences). |
| `GOOGLE_OAUTH_ANDROID_CLIENT_ID` | (none) | Optional Android OAuth client ID (merged into allowed ID token audiences). |
| `GOOGLE_APPLICATION_CREDENTIALS` | (none) | Path to service account JSON (if used). |

ID tokens from Google Sign-In on native apps use the platform client as `aud`; the backend accepts any ID listed in the merged **allowed client IDs** set (web ID + CSV + iOS + Android, deduplicated). Create separate iOS/Android OAuth clients in Google Cloud Console and add their IDs here.

### OpenAI (AI chat)

| Variable | Default | Description |
|----------|---------|-------------|
| `OPENAI_API_KEY` | (none) | API key for OpenAI (required for AI tutor proxy). |
| `OPENAI_ALLOWED_MODELS_CSV` | `gpt-5-nano,gpt-5-mini` | Allowed model IDs (comma-separated). |
| `OPENAI_MAX_PROMPT_CHARS` | `4000` | Max prompt length. |
| `OPENAI_MAX_MESSAGES` | `30` | Max message count. |
| `OPENAI_MAX_MESSAGE_CHARS` | `2000` | Max chars per message. |
| `OPENAI_MAX_TOKENS` | `512` | Max tokens per response. |
| `AI_TUTOR_THROTTLE_RATE_FREE` | `30/min` | Throttle for free tier. |
| `AI_TUTOR_THROTTLE_RATE_PREMIUM` | `120/min` | Throttle for premium. |
| `OPENAI_CACHE_TTL_SECONDS` | `0` | Response cache TTL (0 = disabled). |
| `OPENAI_IDEMPOTENCY_TTL_SECONDS` | `120` | Idempotency window. |

### Rate limits

| Variable | Default | Description |
|----------|---------|-------------|
| `LOGIN_THROTTLE_RATE` | `10/min` | Login endpoint throttle. |
| `CONTACT_THROTTLE_RATE` | `5/min` | Contact form throttle. |
| `FINANCE_EXTERNAL_THROTTLE_RATE` | `60/min` | External finance API throttle. |

### Celery / Redis

| Variable | Default | Description |
|----------|---------|-------------|
| `CELERY_BROKER_URL` / `REDIS_URL` | (none) | Redis URL for Celery broker. If unset, Celery runs in eager mode (tasks execute inline). |
| `CELERY_TASK_ALWAYS_EAGER` | `True` when no broker | Force eager mode (useful for tests and dev without Redis). |

### Security / HTTP

| Variable | Default | Description |
|----------|---------|-------------|
| `SECURE_REFERRER_POLICY` | `strict-origin-when-cross-origin` | Referrer policy. |
| `EXTERNAL_REQUEST_TIMEOUT_SECONDS` | `15` | Timeout for outbound HTTP. |
| `HTTP_POOL_CONNECTIONS` | `20` | Connection pool size. |
| `HTTP_POOL_MAXSIZE` | `20` | Max pool size. |

### API docs

| Variable | Default | Description |
|----------|---------|-------------|
| `API_TITLE` | `Monevo API` | OpenAPI title. |
| `API_VERSION` | `0.1.0` | Schema version. |
| `API_DESCRIPTION` | (see settings) | OpenAPI description. |

### Error reporting

| Variable | Default | Description |
|----------|---------|-------------|
| `SENTRY_DSN` | (none) | Sentry DSN; backend Sentry init is commented out until set. See `docs/error-reporting.md`. |

### Other

| Variable | Default | Description |
|----------|---------|-------------|
| `CKEDITOR_5_LICENSE_KEY` | (none) | Optional CKEditor 5 license. |
| `REFRESH_COOKIE_SAMESITE` | (see auth views) | Override for refresh cookie SameSite. |
| `REFRESH_TOKEN_MAX_AGE` | (none) | Override for refresh cookie max age. |
| `REFRESH_COOKIE_DOMAIN` | (none) | Override for refresh cookie domain. |
| `CSE_ID`, `API_KEY`, `RECRAFT_API_KEY`, `ALPHA_VANTAGE_API_KEY`, `FREE_CURRENCY_API_KEY`, `EXCHANGE_RATE_API_KEY` | (none) | Optional integration keys. |

## CI and tests

Tests use the same PostgreSQL as dev/prod: set `DATABASE_URL` (e.g. in GitHub Actions with a Postgres service container). See `.github/workflows/ci.yml` and the plan in the repo for CI database setup.

# Environment Variables Reference

Quick reference for all environment variables used in the Monevo backend.

## Required for All Environments

| Variable | Description | Example |
|----------|-------------|---------|
| `SECRET_KEY` | Django secret key | Generated via `python -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())"` |
| `DATABASE_URL` | PostgreSQL connection string | Auto-set by Render from database service |
| `REDIS_URL` | Redis connection string | Auto-set by Render from Redis service |

## Email Configuration

| Variable | Description | Default |
|----------|-------------|---------|
| `EMAIL_HOST` | SMTP server | `smtp.gmail.com` |
| `EMAIL_PORT` | SMTP port | `587` |
| `EMAIL_USE_TLS` | Use TLS | `True` |
| `EMAIL_HOST_USER` | SMTP username | - |
| `EMAIL_HOST_PASSWORD` | SMTP password/app password | - |
| `DEFAULT_FROM_EMAIL` | Default sender email | - |

## Stripe

| Variable | Description |
|----------|-------------|
| `STRIPE_SECRET_KEY` | Stripe secret key (starts with `sk_`) |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook secret (starts with `whsec_`) |
| `STRIPE_PUBLISHABLE_KEY` | Stripe publishable key (starts with `pk_`) |

## reCAPTCHA

| Variable | Description | Default |
|----------|-------------|---------|
| `RECAPTCHA_PUBLIC_KEY` | reCAPTCHA site key | - |
| `RECAPTCHA_PRIVATE_KEY` | reCAPTCHA secret key | - |
| `RECAPTCHA_REQUIRED_SCORE` | Minimum score (0.0-1.0) | `0.5` |

## Google Cloud

| Variable | Description |
|----------|-------------|
| `GOOGLE_APPLICATION_CREDENTIALS` | Path to Google Cloud credentials JSON file |
| `CSE_ID` | Custom Search Engine ID |
| `API_KEY` | Google API key |

## Recraft API

| Variable | Description |
|----------|-------------|
| `RECRAFT_API_KEY` | Recraft API key |

## Django Settings

| Variable | Description | Default |
|----------|-------------|---------|
| `DEBUG` | Enable debug mode | `False` (must be `False` in production) |
| `TIME_ZONE` | Timezone | `UTC` |
| `ALLOWED_HOSTS_CSV` | Comma-separated list of allowed hosts | - |
| `FRONTEND_URL` | Frontend application URL | - |
| `CKEDITOR_5_LICENSE_KEY` | CKEditor 5 license key (if used) | - |

## CORS & CSRF

| Variable | Description | Format |
|----------|-------------|--------|
| `CORS_ALLOWED_ORIGINS_CSV` | Comma-separated allowed origins | `https://example.com,https://www.example.com` |
| `CSRF_TRUSTED_ORIGINS_CSV` | Comma-separated trusted origins | `https://example.com,https://www.example.com` |
| `CSRF_COOKIE_DOMAIN` | CSRF cookie domain | `.example.com` or empty |

## Cookie Settings

| Variable | Description | Default |
|----------|-------------|---------|
| `REFRESH_COOKIE_DOMAIN` | Refresh token cookie domain | Empty for localhost |
| `REFRESH_COOKIE_SECURE` | Use secure cookies (HTTPS only) | `True` in production |
| `REFRESH_COOKIE_SAMESITE` | SameSite cookie attribute | `None` |
| `REFRESH_TOKEN_MAX_AGE` | Refresh token max age in seconds | `86400` (24 hours) |

## Environment-Specific Examples

### Staging

```bash
DEBUG=True
ALLOWED_HOSTS_CSV=chartwise-web-staging.onrender.com
CORS_ALLOWED_ORIGINS_CSV=https://monevo-alpha.vercel.app
CSRF_TRUSTED_ORIGINS_CSV=https://monevo-alpha.vercel.app
FRONTEND_URL=https://monevo-alpha.vercel.app
CSRF_COOKIE_DOMAIN=
REFRESH_COOKIE_DOMAIN=
REFRESH_COOKIE_SECURE=False
```

### Production

```bash
DEBUG=False
ALLOWED_HOSTS_CSV=chartwise-web-production.onrender.com,monevo.tech,www.monevo.tech
CORS_ALLOWED_ORIGINS_CSV=https://www.monevo.tech,https://monevo.tech
CSRF_TRUSTED_ORIGINS_CSV=https://www.monevo.tech,https://monevo.tech
FRONTEND_URL=https://www.monevo.tech
CSRF_COOKIE_DOMAIN=monevo.tech
REFRESH_COOKIE_DOMAIN=monevo.tech
REFRESH_COOKIE_SECURE=True
```

## Notes

- Variables ending in `_CSV` accept comma-separated values
- `DATABASE_URL` and `REDIS_URL` are automatically set by Render when linking services
- Never commit actual values to version control
- Use Render's Environment Groups to manage variables across services

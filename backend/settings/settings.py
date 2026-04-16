import datetime
import os
import socket
import sys
import logging
from datetime import timedelta
from pathlib import Path

import dj_database_url
from corsheaders.defaults import default_headers
from django.core.exceptions import ImproperlyConfigured
from dotenv import load_dotenv

from core.utils import env_bool, env_csv

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env")
DJANGO_ENV = os.getenv("DJANGO_ENV", "production")

# DJANGO_ENV=build is used exclusively during `docker build` to run collectstatic.
# It tells settings to skip production-only guards that require runtime secrets
# (RECAPTCHA, CORS origins, media storage backend). The build phase never serves
# real traffic, so these checks are unnecessary and would block the image build.
_IS_BUILD_PHASE = DJANGO_ENV == "build"

DEBUG = env_bool("DEBUG", DJANGO_ENV != "production")

# Optional: serve the built React SPA (frontend/build) from Django/WhiteNoise.
# This keeps BrowserRouter URLs clean (e.g. /dashboard instead of fragment-based URLs)
# when deploying frontend + backend together.
FRONTEND_BUILD_DIR = Path(
    os.getenv("FRONTEND_BUILD_DIR", str(BASE_DIR.parent / "frontend" / "dist"))
).resolve()

SECRET_KEY = os.getenv("SECRET_KEY") or os.getenv("DJANGO_SECRET_KEY")
if not SECRET_KEY:
    if DEBUG or _IS_BUILD_PHASE:
        # Stable key in dev so session/CSRF cookies work across restarts (avoids "Session data corrupted" on admin login).
        # Production must set SECRET_KEY in env.
        SECRET_KEY = "django-insecure-dev-only-do-not-use-in-production"  # pragma: allowlist secret
    else:
        raise ImproperlyConfigured(
            "SECRET_KEY must be set in production. "
            "On Railway: Dashboard → your backend service → Variables → add SECRET_KEY (and DJANGO_ENV=production). "
            'Generate a key: python -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())"'
        )
if DEBUG:
    logging.getLogger(__name__).debug("[settings] DEBUG mode enabled")
elif _IS_BUILD_PHASE:
    logging.getLogger(__name__).debug("[settings] Build phase (collectstatic only)")
else:
    logging.getLogger(__name__).debug("[settings] Production mode (DEBUG=False)")

ALLOWED_HOSTS = env_csv(
    "ALLOWED_HOSTS_CSV",
    default=env_csv(
        "ALLOWED_HOSTS",
        default=[
            "localhost",
            "127.0.0.1",
            "garzoni-production.up.railway.app",
            "www.garzoni.app",
            "garzoni.app",
        ],
    ),
)

# Phones/simulators call http://<LAN-IP>:8000; Host must be allowed or Django raises DisallowedHost
# before the view runs. DJANGO_ALLOW_ALL_HOSTS=1/true/yes forces match-all; docker-compose sets this for local dev.
# Alternatively set ALLOWED_HOSTS_CSV=localhost,127.0.0.1,* in backend/.env (production compose must not use *).
if os.getenv("DJANGO_ALLOW_ALL_HOSTS", "").strip().lower() in ("1", "true", "yes"):
    ALLOWED_HOSTS = ["*"]
else:
    # DJANGO_ALLOW_ALL_HOSTS_IN_DEBUG intentionally has no auto-true default.
    # Explicit opt-in only — prevents host-header injection if DEBUG=True leaks to production.
    _allow_all_hosts = (
        env_bool("DJANGO_ALLOW_ALL_HOSTS", False)
        or env_bool("DJANGO_ALLOW_LAN_HOSTS", False)
        or (DEBUG and env_bool("DJANGO_ALLOW_ALL_HOSTS_IN_DEBUG", False))
    )
    if _allow_all_hosts and "*" not in ALLOWED_HOSTS:
        ALLOWED_HOSTS = [*ALLOWED_HOSTS, "*"]

# Railway injects the service's public hostname; allow it even when ALLOWED_HOSTS_CSV is stale
# (e.g. after renaming the deployment) so requests to *.up.railway.app are not rejected.
_railway_public_domain = (os.getenv("RAILWAY_PUBLIC_DOMAIN") or "").strip()
if (
    _railway_public_domain
    and "*" not in ALLOWED_HOSTS
    and _railway_public_domain not in ALLOWED_HOSTS
):
    ALLOWED_HOSTS = [*ALLOWED_HOSTS, _railway_public_domain]

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "cloudinary_storage",
    "whitenoise.runserver_nostatic",
    "corsheaders",
    "rest_framework",
    "drf_spectacular",
    "rest_framework_simplejwt",
    "rest_framework_simplejwt.token_blacklist",
    # Domain-specific apps
    "authentication",
    "education",
    "gamification",
    "finance",
    "support",
    "onboarding",
    "notifications.apps.NotificationsConfig",
    # Legacy core app (to be removed after full migration)
    "core",
    "django_rest_passwordreset",
    "django_ckeditor_5",
    "django_celery_results",
    "django_celery_beat",
    "axes",
]
if DEBUG and env_bool("ENABLE_DJANGO_EXTENSIONS", False):
    INSTALLED_APPS += ["django_extensions"]

# Gamification retention layer (weekly recap API, streak-rescue Celery job, richer profile extras).
GAMIFICATION_RETENTION_V2 = env_bool("GAMIFICATION_RETENTION_V2", False)
GAMIFICATION_DAILY_GOAL_TARGET_XP = int(os.getenv("GAMIFICATION_DAILY_GOAL_TARGET_XP", "50"))

MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "core.middleware.RequestIdMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "axes.middleware.AxesMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "settings.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [BASE_DIR / "core" / "templates"],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

# If a frontend build exists (index.html present), make it discoverable via
# TemplateView and let WhiteNoise serve the build output.
SERVE_FRONTEND = (FRONTEND_BUILD_DIR / "index.html").exists()
if SERVE_FRONTEND:
    TEMPLATES[0]["DIRS"].append(FRONTEND_BUILD_DIR)
    WHITENOISE_ROOT = str(FRONTEND_BUILD_DIR)

WSGI_APPLICATION = "settings.wsgi.application"

# Use PostgreSQL in both dev and prod.
# Prefer DATABASE_URL (Railway injects private postgres.railway.internal) so the app connects from inside Railway.
# Use DATABASE_PUBLIC_URL only when connecting from outside (e.g. push script from your Mac).
database_url = os.getenv("DATABASE_URL") or os.getenv("DATABASE_PUBLIC_URL")
# Convert postgres:// to postgresql:// for compatibility
if database_url and database_url.startswith("postgres://"):
    database_url = database_url.replace("postgres://", "postgresql://", 1)

if not database_url:
    raise ImproperlyConfigured(
        "DATABASE_URL (or DATABASE_PUBLIC_URL) must be set. "
        "Use PostgreSQL in dev and prod: e.g. postgresql://user:pass@localhost:5432/garzoni for local, "  # pragma: allowlist secret
        "or on Railway add a PostgreSQL service (DATABASE_URL is set automatically)."
    )

# Require SSL only for truly external connections (DATABASE_PUBLIC_URL from outside Railway).
# Railway's internal private URL and local Docker hosts don't need SSL.
_is_local_db = any(
    host in database_url for host in ("railway.internal", "@db:", "@localhost", "@127.0.0.1")
)
_is_external_db = not _is_local_db
default_db = dj_database_url.parse(database_url, conn_max_age=600, ssl_require=_is_external_db)
if "OPTIONS" not in default_db:
    default_db["OPTIONS"] = {}

DATABASES = {"default": default_db}

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

AUTHENTICATION_BACKENDS = [
    "axes.backends.AxesStandaloneBackend",
    "django.contrib.auth.backends.ModelBackend",
]

# django-axes: persistent brute-force lockout (stored in DB, survives restarts).
# Locks by IP+username combo so IP rotation doesn't bypass per-username tracking.
AXES_ENABLED = True
AXES_FAILURE_LIMIT = int(os.getenv("AXES_FAILURE_LIMIT", "10"))
AXES_COOLOFF_TIME = datetime.timedelta(hours=int(os.getenv("AXES_COOLOFF_HOURS", "1")))
AXES_LOCKOUT_PARAMETERS = ["ip_address", "username"]
AXES_RESET_ON_SUCCESS = True
AXES_VERBOSE = False
AXES_HANDLER = "axes.handlers.database.AxesDatabaseHandler"

LANGUAGE_CODE = "en-us"
TIME_ZONE = os.getenv("TIME_ZONE", "Europe/London")
USE_I18N = True
USE_TZ = True

# Leading slash required so urljoin/static resolution and WhiteNoise prefix match request.path (/static/...).
STATIC_URL = "/static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
STATICFILES_DIRS = [BASE_DIR / "static"] if (BASE_DIR / "static").exists() else []

MEDIA_URL = "/media/"
MEDIA_ROOT = BASE_DIR / "media"
MEDIA_STORAGE_BACKEND = os.getenv(
    "DJANGO_MEDIA_STORAGE_BACKEND", "django.core.files.storage.FileSystemStorage"
)
# Cloudinary (used when DJANGO_MEDIA_STORAGE_BACKEND=cloudinary_storage...)
CLOUDINARY_URL = os.getenv("CLOUDINARY_URL", "")
# Auto-enable Cloudinary when URL is set and no explicit backend override
if CLOUDINARY_URL and MEDIA_STORAGE_BACKEND == "django.core.files.storage.FileSystemStorage":
    MEDIA_STORAGE_BACKEND = "cloudinary_storage.storage.MediaCloudinaryStorage"

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": (
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ),
    "DEFAULT_PERMISSION_CLASSES": ("rest_framework.permissions.IsAuthenticated",),
    "DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema",
    "DEFAULT_THROTTLE_CLASSES": [
        "rest_framework.throttling.AnonRateThrottle",
        "rest_framework.throttling.UserRateThrottle",
    ],
    "DEFAULT_THROTTLE_RATES": {"anon": "50/day", "user": "500/day"},
}

SPECTACULAR_SETTINGS = {
    "TITLE": os.getenv("API_TITLE", "Garzoni API"),
    "DESCRIPTION": os.getenv(
        "API_DESCRIPTION",
        "Garzoni backend API (Django REST Framework). Use the Swagger UI for discovery and testing.",
    ),
    "VERSION": os.getenv("API_VERSION", "0.1.0"),
    "SERVE_INCLUDE_SCHEMA": False,
}

try:
    _jwt_refresh_days = int(os.getenv("JWT_REFRESH_TOKEN_DAYS", "30"))
except ValueError:
    _jwt_refresh_days = 30
_jwt_refresh_days = max(1, min(_jwt_refresh_days, 366))

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=30),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=_jwt_refresh_days),
    "ROTATE_REFRESH_TOKENS": True,
    "BLACKLIST_AFTER_ROTATION": True,
    "AUTH_HEADER_TYPES": ("Bearer",),
    "AUTH_TOKEN_CLASSES": ("rest_framework_simplejwt.tokens.AccessToken",),
    "TOKEN_TYPE_CLAIM": "token_type",
    "JTI_CLAIM": "jti",
    "UPDATE_LAST_LOGIN": True,
    # Cookie defaults for any endpoints that opt into cookie-based auth.
    "AUTH_COOKIE_SECURE": not DEBUG,
    "AUTH_COOKIE_SAMESITE": "None" if not DEBUG else "Lax",
}

# External HTTP safety defaults
EXTERNAL_REQUEST_TIMEOUT_SECONDS = int(os.getenv("EXTERNAL_REQUEST_TIMEOUT_SECONDS", "15"))
# OpenAI chat completions can exceed the generic external timeout; keep separate.
OPENAI_REQUEST_TIMEOUT_SECONDS = int(os.getenv("OPENAI_REQUEST_TIMEOUT_SECONDS", "90"))
HTTP_POOL_CONNECTIONS = int(os.getenv("HTTP_POOL_CONNECTIONS", "20"))
HTTP_POOL_MAXSIZE = int(os.getenv("HTTP_POOL_MAXSIZE", "20"))

# Rate limits (DRF throttles) for sensitive endpoints
LOGIN_THROTTLE_RATE = os.getenv("LOGIN_THROTTLE_RATE", "10/min")
CONTACT_THROTTLE_RATE = os.getenv("CONTACT_THROTTLE_RATE", "5/min")
AI_TUTOR_THROTTLE_RATE_FREE = os.getenv("AI_TUTOR_THROTTLE_RATE_FREE", "30/min")
AI_TUTOR_THROTTLE_RATE_PREMIUM = os.getenv("AI_TUTOR_THROTTLE_RATE_PREMIUM", "120/min")
FINANCE_EXTERNAL_THROTTLE_RATE = os.getenv("FINANCE_EXTERNAL_THROTTLE_RATE", "60/min")

# Daily token budgets for the AI tutor (tracked in Redis/cache).
# Limits total OpenAI token spend per user per UTC day regardless of request rate.
OPENAI_DAILY_TOKEN_BUDGET_FREE = int(os.getenv("OPENAI_DAILY_TOKEN_BUDGET_FREE", "50000"))
OPENAI_DAILY_TOKEN_BUDGET_PREMIUM = int(os.getenv("OPENAI_DAILY_TOKEN_BUDGET_PREMIUM", "500000"))

# Optional: cache OpenAI responses (in seconds). Keep disabled by default.
OPENAI_CACHE_TTL_SECONDS = int(os.getenv("OPENAI_CACHE_TTL_SECONDS", "0"))
OPENAI_IDEMPOTENCY_TTL_SECONDS = int(os.getenv("OPENAI_IDEMPOTENCY_TTL_SECONDS", "120"))

# OpenAI payload validation / abuse prevention
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "").strip()
OPENAI_MAX_PROMPT_CHARS = int(os.getenv("OPENAI_MAX_PROMPT_CHARS", "4000"))
OPENAI_MAX_MESSAGES = int(os.getenv("OPENAI_MAX_MESSAGES", "30"))
OPENAI_MAX_MESSAGE_CHARS = int(os.getenv("OPENAI_MAX_MESSAGE_CHARS", "2000"))
OPENAI_MAX_TOKENS = int(os.getenv("OPENAI_MAX_TOKENS", "512"))
OPENAI_ALLOWED_MODELS_CSV = env_csv(
    "OPENAI_ALLOWED_MODELS_CSV",
    default=["gpt-4o-mini", "gpt-4o"],
)

# Content translation settings
CONTENT_TRANSLATION_PROVIDER = os.getenv("CONTENT_TRANSLATION_PROVIDER", "openai")
CONTENT_TRANSLATION_MODEL = os.getenv("CONTENT_TRANSLATION_MODEL", "gpt-4o-mini")
CONTENT_TRANSLATION_ENABLED = os.getenv("CONTENT_TRANSLATION_ENABLED", "true").lower() in (
    "1",
    "true",
    "yes",
)

# Security headers (Django 4.2 SecurityMiddleware)
SECURE_REFERRER_POLICY = os.getenv("SECURE_REFERRER_POLICY", "strict-origin-when-cross-origin")

cors_allowed_origins = env_csv("CORS_ALLOWED_ORIGINS_CSV")
if not cors_allowed_origins:
    cors_allowed_origins = env_csv("CORS_ALLOWED_ORIGINS")
if DEBUG and not cors_allowed_origins:
    cors_allowed_origins = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ]
    local_ip = socket.gethostbyname(socket.gethostname())
    cors_allowed_origins.extend(
        [
            f"http://{local_ip}:8081",
            f"http://{local_ip}:19006",
            f"http://{local_ip}:19000",
        ]
    )
CORS_ALLOWED_ORIGINS = cors_allowed_origins
# Skip CORS check during build phase — no requests are served at build time.
if not DEBUG and not _IS_BUILD_PHASE and not CORS_ALLOWED_ORIGINS:
    raise ImproperlyConfigured(
        "CORS_ALLOWED_ORIGINS must be set in production (CORS_ALLOWED_ORIGINS_CSV or CORS_ALLOWED_ORIGINS)."
    )

CSRF_TRUSTED_ORIGINS = env_csv("CSRF_TRUSTED_ORIGINS_CSV", default=[])
if not CSRF_TRUSTED_ORIGINS:
    CSRF_TRUSTED_ORIGINS = env_csv("CSRF_TRUSTED_ORIGINS", default=[])
if DEBUG:
    CSRF_TRUSTED_ORIGINS.extend(
        [
            "http://localhost:3000",
            "http://127.0.0.1:3000",
        ]
    )
# Auto-trust the Railway public domain for admin login (CSRF validation)
if _railway_public_domain:
    CSRF_TRUSTED_ORIGINS.append(f"https://{_railway_public_domain}")
# Auto-trust BACKEND_URL origin so admin works without manual CSRF config
_backend_url_env = (os.getenv("BACKEND_URL") or "").strip().rstrip("/")
if _backend_url_env:
    from urllib.parse import urlparse as _urlparse

    _parsed = _urlparse(_backend_url_env)
    _origin = f"{_parsed.scheme}://{_parsed.netloc}"
    if _origin not in CSRF_TRUSTED_ORIGINS:
        CSRF_TRUSTED_ORIGINS.append(_origin)
CSRF_TRUSTED_ORIGINS = list(dict.fromkeys(CSRF_TRUSTED_ORIGINS))

CORS_ALLOW_CREDENTIALS = env_bool("CORS_ALLOW_CREDENTIALS", True)
CORS_ALLOW_HEADERS = list(default_headers) + [
    "access-control-allow-origin",
    "accept-language",
    "authorization",
    "content-type",
    "x-app-language",
    "x-csrftoken",
    "x-requested-with",
    "x-refresh-token",
]
CORS_EXPOSE_HEADERS = ["Content-Disposition", "Set-Cookie", "X-CSRFToken", "X-Request-ID"]

SESSION_COOKIE_SECURE = not DEBUG
SESSION_COOKIE_SAMESITE = "None" if not DEBUG else "Lax"
SESSION_COOKIE_HTTPONLY = True

CSRF_COOKIE_SECURE = not DEBUG
CSRF_COOKIE_SAMESITE = "None" if not DEBUG else "Lax"
CSRF_COOKIE_HTTPONLY = False
CSRF_COOKIE_DOMAIN = os.getenv("CSRF_COOKIE_DOMAIN") or None

SECURE_SSL_REDIRECT = not DEBUG
SECURE_HSTS_SECONDS = 31536000 if not DEBUG else 0
SECURE_HSTS_INCLUDE_SUBDOMAINS = not DEBUG
SECURE_HSTS_PRELOAD = not DEBUG
SECURE_CONTENT_TYPE_NOSNIFF = True
X_FRAME_OPTIONS = "SAMEORIGIN"
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
# Use X-Forwarded-Host so build_absolute_uri() (e.g. course image URLs) is correct on Railway/proxy
USE_X_FORWARDED_HOST = True

USE_SMTP_EMAIL = env_bool("USE_SMTP_EMAIL", not DEBUG)
EMAIL_PROVIDER = os.getenv("EMAIL_PROVIDER", "smtp").strip().lower()
if EMAIL_PROVIDER == "resend":
    EMAIL_BACKEND = "anymail.backends.resend.EmailBackend"
else:
    EMAIL_BACKEND = (
        "django.core.mail.backends.smtp.EmailBackend"
        if USE_SMTP_EMAIL
        else "django.core.mail.backends.console.EmailBackend"
    )
EMAIL_HOST = os.getenv("EMAIL_HOST", "smtp.gmail.com")
EMAIL_PORT = int(os.getenv("EMAIL_PORT", 587))
EMAIL_USE_TLS = env_bool("EMAIL_USE_TLS", True)
EMAIL_USE_SSL = env_bool(
    "EMAIL_USE_SSL", False
)  # Use for port 465 (e.g. Resend); ignored if EMAIL_USE_TLS
EMAIL_HOST_USER = os.getenv("EMAIL_HOST_USER", "")
EMAIL_HOST_PASSWORD = os.getenv("EMAIL_HOST_PASSWORD", "")
DEFAULT_FROM_EMAIL = os.getenv("DEFAULT_FROM_EMAIL", EMAIL_HOST_USER or "webmaster@localhost")
ANYMAIL = {
    "RESEND_API_KEY": os.getenv("RESEND_API_KEY", "").strip(),
}
CONTACT_EMAIL = (
    os.getenv("CONTACT_EMAIL", "").strip() or None
)  # Contact form recipient; falls back to DEFAULT_FROM_EMAIL

# --- Customer.io (optional; backend-orchestrated delivery + journeys) ---
CIO_REGION = os.getenv("CIO_REGION", "us").strip().lower()
CIO_SITE_ID = os.getenv("CIO_SITE_ID", "").strip()
CIO_TRACK_API_KEY = os.getenv("CIO_TRACK_API_KEY", "").strip()
# CDP Pipelines / HTTP source (POST https://cdp(-eu).customer.io/v1/identify); Basic auth = base64("API_KEY:")
CIO_CDP_API_KEY = os.getenv("CIO_CDP_API_KEY", "").strip()
CIO_CDP_ENABLED = env_bool("CIO_CDP_ENABLED", True)
CIO_APP_API_KEY = os.getenv("CIO_APP_API_KEY", "").strip()
CIO_TRACK_ENABLED = env_bool("CIO_TRACK_ENABLED", False)
CIO_TRANSACTIONAL_ENABLED = env_bool("CIO_TRANSACTIONAL_ENABLED", False)
CIO_JOURNEY_EVENTS_ENABLED = env_bool("CIO_JOURNEY_EVENTS_ENABLED", False)
CIO_REMINDERS_VIA_JOURNEYS = env_bool("CIO_REMINDERS_VIA_JOURNEYS", False)
# JSON map: template slug -> transactional message id (int) or trigger name (str), e.g.
# {"password-reset":12,"welcome":13}
CIO_TRANSACTIONAL_TRIGGERS_JSON = os.getenv("CIO_TRANSACTIONAL_TRIGGERS_JSON", "").strip()
# Optional: GET /api/notifications/cio-ping/ with header X-Garzoni-Cio-Ping: <secret> (no Railway console needed).
CIO_PUBLIC_PING_SECRET = os.getenv("CIO_PUBLIC_PING_SECRET", "").strip()

if DEBUG:
    FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")
else:
    FRONTEND_URL = os.getenv("FRONTEND_URL", "https://www.garzoni.app")

# Base API URL (including /api). Used to generate absolute links in emails.
BACKEND_URL = (os.getenv("BACKEND_URL", "").strip() or "http://localhost:8000/api").rstrip("/")

STRIPE_SECRET_KEY = os.getenv("STRIPE_SECRET_KEY", "")
STRIPE_WEBHOOK_SECRET = os.getenv("STRIPE_WEBHOOK_SECRET", "")
STRIPE_PUBLISHABLE_KEY = os.getenv("STRIPE_PUBLISHABLE_KEY", "")
# Stripe Price IDs for subscription plans (create in Stripe Dashboard → Products → Prices)
# Yearly plans first; 7-day free trial only on yearly Pro/Plus.
STRIPE_PRICE_PLUS_YEARLY = os.getenv("STRIPE_PRICE_PLUS_YEARLY") or os.getenv(
    "STRIPE_PRICE_PLUS_ANNUAL", ""
)
STRIPE_PRICE_PRO_YEARLY = os.getenv("STRIPE_PRICE_PRO_YEARLY") or os.getenv(
    "STRIPE_PRICE_PRO_ANNUAL", ""
)
STRIPE_PRICE_PLUS_MONTHLY = os.getenv("STRIPE_PRICE_PLUS_MONTHLY", "")
STRIPE_PRICE_PRO_MONTHLY = os.getenv("STRIPE_PRICE_PRO_MONTHLY", "")
STRIPE_DEFAULT_PRICE_ID = os.getenv(
    "STRIPE_DEFAULT_PRICE_ID", ""
)  # fallback if plan-specific not set
# Optional: pre-apply a promotion code at checkout (e.g. for testing in prod)
STRIPE_DEFAULT_PROMOTION_CODE = os.getenv("STRIPE_DEFAULT_PROMOTION_CODE", "")
if STRIPE_SECRET_KEY:
    required_prices = {
        "STRIPE_PRICE_PLUS_YEARLY": STRIPE_PRICE_PLUS_YEARLY,
        "STRIPE_PRICE_PRO_YEARLY": STRIPE_PRICE_PRO_YEARLY,
        "STRIPE_PRICE_PLUS_MONTHLY": STRIPE_PRICE_PLUS_MONTHLY,
        "STRIPE_PRICE_PRO_MONTHLY": STRIPE_PRICE_PRO_MONTHLY,
    }
    missing_prices = [name for name, value in required_prices.items() if not value.strip()]
    if missing_prices:
        raise ImproperlyConfigured(
            "Stripe is enabled but required price IDs are missing: " + ", ".join(missing_prices)
        )

# reCAPTCHA Enterprise (single key from hello@garzoni.app console)
# Local/dev: set RECAPTCHA_DISABLED=1 to allow login/register without tokens (blockers, no site key).
# Never enable in production. Build phase is also exempt — no requests are served.
RECAPTCHA_DISABLED = env_bool("RECAPTCHA_DISABLED", False)
if not DEBUG and not _IS_BUILD_PHASE and RECAPTCHA_DISABLED:
    raise ImproperlyConfigured("RECAPTCHA_DISABLED must not be True in production.")
RECAPTCHA_SITE_KEY = os.getenv("RECAPTCHA_SITE_KEY", "").strip()
RECAPTCHA_ENTERPRISE_PROJECT_ID = os.getenv("RECAPTCHA_ENTERPRISE_PROJECT_ID", "").strip()
RECAPTCHA_ENTERPRISE_API_KEY = os.getenv("RECAPTCHA_ENTERPRISE_API_KEY", "").strip()
# Score threshold (0.0-1.0). Lower = more permissive. 0.3 is often used in production.
RECAPTCHA_REQUIRED_SCORE = float(os.getenv("RECAPTCHA_REQUIRED_SCORE", "0.3"))

# Legacy v3 (only used if Enterprise not configured)
RECAPTCHA_PUBLIC_KEY = os.getenv("RECAPTCHA_PUBLIC_KEY", "")
RECAPTCHA_PRIVATE_KEY = os.getenv("RECAPTCHA_PRIVATE_KEY", "")

# Google OAuth (login/register with Google)
GOOGLE_OAUTH_CLIENT_ID = os.getenv("GOOGLE_OAUTH_CLIENT_ID", "")
GOOGLE_OAUTH_CLIENT_SECRET = os.getenv("GOOGLE_OAUTH_CLIENT_SECRET", "")
# Optional: public site origin for OAuth redirect_uri only (defaults to FRONTEND_URL).
# Use when FRONTEND_URL must differ from the URL registered in Google Cloud "Authorized redirect URIs"
# (e.g. fix redirect_uri_mismatch without changing email links).
GOOGLE_OAUTH_REDIRECT_BASE = os.getenv("GOOGLE_OAUTH_REDIRECT_BASE", "").strip()


def _google_oauth_allowed_client_ids() -> list:
    """IDs accepted for Google ID tokens (web + native). Web redirect flow still uses GOOGLE_OAUTH_CLIENT_ID."""
    raw = []
    web = (GOOGLE_OAUTH_CLIENT_ID or "").strip()
    if web:
        raw.append(web)
    raw.extend(env_csv("GOOGLE_OAUTH_CLIENT_IDS_CSV", default=[]))
    for key in ("GOOGLE_OAUTH_IOS_CLIENT_ID", "GOOGLE_OAUTH_ANDROID_CLIENT_ID"):
        v = (os.getenv(key, "") or "").strip()
        if v:
            raw.append(v)
    return list(dict.fromkeys(raw))


GOOGLE_OAUTH_ALLOWED_CLIENT_IDS = _google_oauth_allowed_client_ids()


def _apple_signin_allowed_audiences() -> list:
    """
    Values allowed as JWT `aud` for native Sign in with Apple (usually the iOS bundle ID)
    and/or a web Services ID. Comma-separated in APPLE_SIGNIN_AUDIENCES_CSV.
    """
    raw = list(env_csv("APPLE_SIGNIN_AUDIENCES_CSV", default=[]))
    bundle = (os.getenv("APPLE_SIGNIN_BUNDLE_ID", "") or "").strip()
    if bundle:
        raw.append(bundle)
    return list(dict.fromkeys([x.strip() for x in raw if x.strip()]))


APPLE_SIGNIN_ALLOWED_AUDIENCES = _apple_signin_allowed_audiences()

GOOGLE_APPLICATION_CREDENTIALS = os.getenv("GOOGLE_APPLICATION_CREDENTIALS")
CSE_ID = os.getenv("CSE_ID", "")
API_KEY = os.getenv("API_KEY", "")
RECRAFT_API_KEY = os.getenv("RECRAFT_API_KEY")
ALPHA_VANTAGE_API_KEY = os.getenv("ALPHA_VANTAGE_API_KEY", "")
FREE_CURRENCY_API_KEY = os.getenv("FREE_CURRENCY_API_KEY", "")
EXCHANGE_RATE_API_KEY = os.getenv("EXCHANGE_RATE_API_KEY", "")

# Use Redis as broker when REDIS_URL or CELERY_BROKER_URL is set (dev and production, e.g. Railway)
CELERY_BROKER_URL = os.getenv("CELERY_BROKER_URL") or os.getenv("REDIS_URL")
CELERY_TASK_ALWAYS_EAGER = env_bool("CELERY_TASK_ALWAYS_EAGER", CELERY_BROKER_URL is None)
# Forbid eager only when a broker is configured (otherwise you'd have workers but tasks wouldn't run there)
if not DEBUG and not _IS_BUILD_PHASE and CELERY_BROKER_URL and CELERY_TASK_ALWAYS_EAGER:
    raise ImproperlyConfigured(
        "Celery eager mode is not allowed in production when CELERY_BROKER_URL/REDIS_URL is set. "
        "Set CELERY_TASK_ALWAYS_EAGER=False and run a Celery worker + beat."
    )
if not DEBUG and not _IS_BUILD_PHASE and not CELERY_BROKER_URL and CELERY_TASK_ALWAYS_EAGER:
    print(
        "[settings] Production with no broker: scheduled tasks (email reminders, trial reminder) will NOT run. "
        "On Railway: add Redis, set REDIS_URL, then add a Celery worker and a Celery beat service."
    )
CELERY_BROKER_CONNECTION_RETRY_ON_STARTUP = True
CELERY_BROKER_CONNECTION_MAX_RETRIES = int(os.getenv("CELERY_BROKER_CONNECTION_MAX_RETRIES", "3"))
# Railway Redis proxy often resets idle TCP connections (Errno 104). Smaller pool + redis
# transport limits reduce stale pooled connections. Override via env if needed.
if CELERY_BROKER_URL and (
    CELERY_BROKER_URL.startswith("redis://") or CELERY_BROKER_URL.startswith("rediss://")
):
    CELERY_BROKER_POOL_LIMIT = int(os.getenv("CELERY_BROKER_POOL_LIMIT", "1"))
    CELERY_BROKER_TRANSPORT_OPTIONS = {
        "max_connections": int(os.getenv("CELERY_REDIS_MAX_CONNECTIONS", "2")),
        "retry_on_timeout": True,
    }
CELERY_RESULT_BACKEND = "django-db"
CELERY_ACCEPT_CONTENT = ["json"]
CELERY_TASK_SERIALIZER = "json"
CELERY_RESULT_SERIALIZER = "json"
CELERY_TIMEZONE = TIME_ZONE

# CKEditor 5 Configuration
CKEDITOR_5_CONFIGS = {
    "default": {
        "toolbar": [
            "heading",
            "|",
            "bold",
            "italic",
            "link",
            "bulletedList",
            "numberedList",
            "blockQuote",
            "imageUpload",
            "|",
            "undo",
            "redo",
        ],
    },
    "extends": {
        "blockToolbar": [
            "paragraph",
            "heading1",
            "heading2",
            "heading3",
            "heading4",
            "heading5",
            "heading6",
            "|",
            "bulletedList",
            "numberedList",
            "|",
            "blockQuote",
        ],
        "toolbar": [
            "undo",
            "redo",
            "|",
            "heading",
            "|",
            "fontSize",
            "fontFamily",
            "fontColor",
            "fontBackgroundColor",
            "|",
            "bold",
            "italic",
            "underline",
            "strikethrough",
            "subscript",
            "superscript",
            "code",
            "removeFormat",
            "|",
            "alignment",
            "|",
            "bulletedList",
            "numberedList",
            "todoList",
            "outdent",
            "indent",
            "|",
            "link",
            "insertImage",
            "insertImageViaUrl",
            "insertTable",
            "mediaEmbed",
            "blockQuote",
            "codeBlock",
            "horizontalLine",
            "pageBreak",
            "|",
            "specialCharacters",
            "|",
            "sourceEditing",
        ],
        "image": {
            "toolbar": [
                "imageTextAlternative",
                "|",
                "imageStyle:inline",
                "imageStyle:wrapText",
                "imageStyle:breakText",
                "|",
                "imageStyle:alignLeft",
                "imageStyle:alignRight",
                "imageStyle:alignCenter",
                "imageStyle:side",
                "|",
                "toggleImageCaption",
                "resizeImage",
            ],
        },
        "table": {
            "contentToolbar": [
                "tableColumn",
                "tableRow",
                "mergeTableCells",
                "tableProperties",
                "tableCellProperties",
            ],
            "tableProperties": {
                "borderColors": "custom",
                "backgroundColors": "custom",
            },
            "tableCellProperties": {
                "borderColors": "custom",
                "backgroundColors": "custom",
            },
        },
        "heading": {
            "options": [
                {
                    "model": "paragraph",
                    "title": "Paragraph",
                    "class": "ck-heading_paragraph",
                },
                {
                    "model": "heading1",
                    "view": "h1",
                    "title": "Heading 1",
                    "class": "ck-heading_heading1",
                },
                {
                    "model": "heading2",
                    "view": "h2",
                    "title": "Heading 2",
                    "class": "ck-heading_heading2",
                },
                {
                    "model": "heading3",
                    "view": "h3",
                    "title": "Heading 3",
                    "class": "ck-heading_heading3",
                },
                {
                    "model": "heading4",
                    "view": "h4",
                    "title": "Heading 4",
                    "class": "ck-heading_heading4",
                },
                {
                    "model": "heading5",
                    "view": "h5",
                    "title": "Heading 5",
                    "class": "ck-heading_heading5",
                },
                {
                    "model": "heading6",
                    "view": "h6",
                    "title": "Heading 6",
                    "class": "ck-heading_heading6",
                },
            ],
        },
        "fontSize": {
            "options": [9, 11, 13, "default", 17, 19, 21],
            "supportAllValues": True,
        },
        "fontFamily": {
            "supportAllValues": True,
        },
        "htmlSupport": {
            "allow": [
                {"name": "p"},
                {"name": "strong"},
                {"name": "em"},
                {"name": "u"},
                {"name": "s"},
                {"name": "ul"},
                {"name": "ol"},
                {"name": "li"},
                {"name": "blockquote"},
                {"name": "pre"},
                {"name": "code"},
                {"name": "h2"},
                {"name": "h3"},
                {"name": "h4"},
                {"name": "br"},
                {"name": "hr"},
                {"name": "a", "attributes": {"href": True, "target": True, "rel": True}},
                {
                    "name": "img",
                    "attributes": {"src": True, "alt": True, "width": True, "height": True},
                },
                {"name": "table"},
                {"name": "thead"},
                {"name": "tbody"},
                {"name": "tr"},
                {"name": "th"},
                {"name": "td"},
            ],
        },
        "link": {
            "addTargetToExternalLinks": True,
            "defaultProtocol": "https://",
            "decorators": {
                "toggleDownloadable": {
                    "mode": "manual",
                    "label": "Downloadable",
                    "attributes": {
                        "download": "file",
                    },
                },
            },
        },
        "list": {
            "properties": {
                "styles": True,
                "startIndex": True,
                "reversed": True,
            },
        },
        # Never hardcode license keys in source control.
        "licenseKey": os.getenv("CKEDITOR_5_LICENSE_KEY", ""),
    },
}

customColorPalette = [
    {"color": "hsl(4, 90%, 58%)", "label": "Red"},
    {"color": "hsl(340, 82%, 52%)", "label": "Pink"},
    {"color": "hsl(291, 64%, 42%)", "label": "Purple"},
    {"color": "hsl(262, 52%, 47%)", "label": "Deep Purple"},
    {"color": "hsl(231, 48%, 48%)", "label": "Indigo"},
    {"color": "hsl(207, 90%, 54%)", "label": "Blue"},
]

CKEDITOR_5_FILE_STORAGE = "django.core.files.storage.DefaultStorage"
STORAGES = {
    "default": {"BACKEND": MEDIA_STORAGE_BACKEND},
    # Plain StaticFilesStorage: no post-processing, no compression during collectstatic.
    # WhiteNoise middleware handles gzip/brotli on-the-fly at request time.
    # Both CompressedManifestStaticFilesStorage and CompressedStaticFilesStorage crash
    # with Django 4.2 admin assets (FileNotFoundError in threaded compressor).
    "staticfiles": {
        "BACKEND": "django.contrib.staticfiles.storage.StaticFilesStorage",
    },
}
# Skip media storage check during build phase — no file I/O happens at build time.
if (
    not DEBUG
    and not _IS_BUILD_PHASE
    and MEDIA_STORAGE_BACKEND == "django.core.files.storage.FileSystemStorage"
    and not env_bool("ALLOW_LOCAL_MEDIA_STORAGE", False)
):
    raise ImproperlyConfigured(
        "Production media storage is local filesystem. Configure DJANGO_MEDIA_STORAGE_BACKEND "
        "to a durable backend (S3/R2/Cloudinary) before launch."
    )

SENTRY_DSN = os.getenv("SENTRY_DSN", "").strip()
if SENTRY_DSN and "test" not in sys.argv:
    import sentry_sdk
    from sentry_sdk.integrations.celery import CeleryIntegration
    from sentry_sdk.integrations.django import DjangoIntegration

    sentry_sdk.init(
        dsn=SENTRY_DSN,
        environment=DJANGO_ENV,
        integrations=[DjangoIntegration(), CeleryIntegration()],
        traces_sample_rate=0.1,
        send_default_pii=False,
        sample_rate=1.0 if not DEBUG else 0.2,
        release=os.getenv("RAILWAY_GIT_COMMIT_SHA", ""),
    )

if "test" in sys.argv:
    # Use same PostgreSQL as dev/prod (DATABASE_URL). No SQLite override.
    PASSWORD_HASHERS = ["django.contrib.auth.hashers.MD5PasswordHasher"]

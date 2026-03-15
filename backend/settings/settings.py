import os
import socket
import sys
from datetime import timedelta
from pathlib import Path

import dj_database_url
from corsheaders.defaults import default_headers
from django.core.exceptions import ImproperlyConfigured
from django.core.management.utils import get_random_secret_key
from dotenv import load_dotenv

from core.utils import env_bool, env_csv

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env")
DJANGO_ENV = os.getenv("DJANGO_ENV", "production")
DEBUG = env_bool("DEBUG", DJANGO_ENV != "production")

# Optional: serve the built React SPA (frontend/build) from Django/WhiteNoise.
# This keeps BrowserRouter URLs clean (e.g. /dashboard instead of fragment-based URLs)
# when deploying frontend + backend together.
FRONTEND_BUILD_DIR = Path(
    os.getenv("FRONTEND_BUILD_DIR", str(BASE_DIR.parent / "frontend" / "build"))
).resolve()

SECRET_KEY = os.getenv("SECRET_KEY") or os.getenv("DJANGO_SECRET_KEY")
if not SECRET_KEY:
    if DEBUG:
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
    print("[settings] DEBUG mode enabled")
else:
    print("[settings] Production mode (DEBUG=False)")

ALLOWED_HOSTS = env_csv(
    "ALLOWED_HOSTS_CSV",
    default=env_csv(
        "ALLOWED_HOSTS",
        default=[
            "localhost",
            "127.0.0.1",
            "monevo-production-bc08.up.railway.app",
            "andreineagoe23.pythonanywhere.com",
        ],
    ),
)

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "whitenoise.runserver_nostatic",
    "django_extensions",
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
    # Legacy core app (to be removed after full migration)
    "core",
    "django_rest_passwordreset",
    "django_ckeditor_5",
    "django_celery_results",
    "django_celery_beat",
]

MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "core.middleware.RequestIdMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
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

# If a frontend build exists, make index.html discoverable via TemplateView and
# let WhiteNoise serve the build output (including /static/*) directly.
SERVE_FRONTEND = FRONTEND_BUILD_DIR.exists()
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
        "Use PostgreSQL in dev and prod: e.g. postgresql://user:pass@localhost:5432/monevo for local, "  # pragma: allowlist secret
        "or on Railway add a PostgreSQL service (DATABASE_URL is set automatically)."
    )

default_db = dj_database_url.parse(database_url, conn_max_age=600, ssl_require=False)
if "OPTIONS" not in default_db:
    default_db["OPTIONS"] = {}

DATABASES = {"default": default_db}

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

LANGUAGE_CODE = "en-us"
TIME_ZONE = os.getenv("TIME_ZONE", "UTC")
USE_I18N = True
USE_TZ = True

STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
STATICFILES_DIRS = [BASE_DIR / "static"] if (BASE_DIR / "static").exists() else []
STATICFILES_STORAGE = "whitenoise.storage.CompressedManifestStaticFilesStorage"

MEDIA_URL = "/media/"
MEDIA_ROOT = BASE_DIR / "media"

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
    "DEFAULT_THROTTLE_RATES": {"anon": "100/day", "user": "1000/day"},
}

SPECTACULAR_SETTINGS = {
    "TITLE": os.getenv("API_TITLE", "Monevo API"),
    "DESCRIPTION": os.getenv(
        "API_DESCRIPTION",
        "Monevo backend API (Django REST Framework). Use the Swagger UI for discovery and testing.",
    ),
    "VERSION": os.getenv("API_VERSION", "0.1.0"),
    "SERVE_INCLUDE_SCHEMA": False,
}

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=30),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=1),
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
HTTP_POOL_CONNECTIONS = int(os.getenv("HTTP_POOL_CONNECTIONS", "20"))
HTTP_POOL_MAXSIZE = int(os.getenv("HTTP_POOL_MAXSIZE", "20"))

# Rate limits (DRF throttles) for sensitive endpoints
LOGIN_THROTTLE_RATE = os.getenv("LOGIN_THROTTLE_RATE", "10/min")
CONTACT_THROTTLE_RATE = os.getenv("CONTACT_THROTTLE_RATE", "5/min")
OPENROUTER_THROTTLE_RATE_FREE = os.getenv("OPENROUTER_THROTTLE_RATE_FREE", "30/min")
OPENROUTER_THROTTLE_RATE_PREMIUM = os.getenv("OPENROUTER_THROTTLE_RATE_PREMIUM", "120/min")
FINANCE_EXTERNAL_THROTTLE_RATE = os.getenv("FINANCE_EXTERNAL_THROTTLE_RATE", "60/min")

# Optional: cache OpenRouter responses (in seconds). Keep disabled by default.
OPENROUTER_CACHE_TTL_SECONDS = int(os.getenv("OPENROUTER_CACHE_TTL_SECONDS", "0"))
OPENROUTER_IDEMPOTENCY_TTL_SECONDS = int(os.getenv("OPENROUTER_IDEMPOTENCY_TTL_SECONDS", "120"))

# OpenRouter payload validation / abuse prevention
OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY", "").strip()
OPENROUTER_MAX_PROMPT_CHARS = int(os.getenv("OPENROUTER_MAX_PROMPT_CHARS", "4000"))
OPENROUTER_MAX_MESSAGES = int(os.getenv("OPENROUTER_MAX_MESSAGES", "30"))
OPENROUTER_MAX_MESSAGE_CHARS = int(os.getenv("OPENROUTER_MAX_MESSAGE_CHARS", "2000"))
OPENROUTER_MAX_TOKENS = int(os.getenv("OPENROUTER_MAX_TOKENS", "512"))
OPENROUTER_ALLOWED_MODELS_CSV = env_csv(
    "OPENROUTER_ALLOWED_MODELS_CSV",
    default=["openrouter/auto"],
)

# Content translation settings
CONTENT_TRANSLATION_PROVIDER = os.getenv("CONTENT_TRANSLATION_PROVIDER", "openrouter")
CONTENT_TRANSLATION_MODEL = os.getenv("CONTENT_TRANSLATION_MODEL", "google/gemini-2.5-flash")
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
CORS_EXPOSE_HEADERS = ["Content-Disposition", "Set-Cookie", "X-CSRFToken"]

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
X_FRAME_OPTIONS = "DENY"
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
# Use X-Forwarded-Host so build_absolute_uri() (e.g. course image URLs) is correct on Railway/proxy
USE_X_FORWARDED_HOST = True

EMAIL_BACKEND = "django.core.mail.backends.smtp.EmailBackend"
EMAIL_HOST = os.getenv("EMAIL_HOST", "smtp.gmail.com")
EMAIL_PORT = int(os.getenv("EMAIL_PORT", 587))
EMAIL_USE_TLS = env_bool("EMAIL_USE_TLS", True)
EMAIL_USE_SSL = env_bool(
    "EMAIL_USE_SSL", False
)  # Use for port 465 (e.g. Resend); ignored if EMAIL_USE_TLS
EMAIL_HOST_USER = os.getenv("EMAIL_HOST_USER", "")
EMAIL_HOST_PASSWORD = os.getenv("EMAIL_HOST_PASSWORD", "")
DEFAULT_FROM_EMAIL = os.getenv("DEFAULT_FROM_EMAIL", EMAIL_HOST_USER or "webmaster@localhost")
CONTACT_EMAIL = (
    os.getenv("CONTACT_EMAIL", "").strip() or None
)  # Contact form recipient; falls back to DEFAULT_FROM_EMAIL

if DEBUG:
    FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")
else:
    FRONTEND_URL = os.getenv("FRONTEND_URL", "https://www.monevo.tech")

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

# reCAPTCHA Enterprise (single key from monevo.educational@gmail.com console)
RECAPTCHA_SITE_KEY = os.getenv("RECAPTCHA_SITE_KEY", "").strip()
RECAPTCHA_ENTERPRISE_PROJECT_ID = os.getenv("RECAPTCHA_ENTERPRISE_PROJECT_ID", "").strip()
RECAPTCHA_ENTERPRISE_API_KEY = os.getenv("RECAPTCHA_ENTERPRISE_API_KEY", "").strip()
# Score threshold (0.0–1.0). Lower = more permissive. 0.3 is often used in production.
RECAPTCHA_REQUIRED_SCORE = float(os.getenv("RECAPTCHA_REQUIRED_SCORE", "0.3"))

# Legacy v3 (only used if Enterprise not configured)
RECAPTCHA_PUBLIC_KEY = os.getenv("RECAPTCHA_PUBLIC_KEY", "")
RECAPTCHA_PRIVATE_KEY = os.getenv("RECAPTCHA_PRIVATE_KEY", "")

# Google OAuth (login/register with Google)
GOOGLE_OAUTH_CLIENT_ID = os.getenv("GOOGLE_OAUTH_CLIENT_ID", "")
GOOGLE_OAUTH_CLIENT_SECRET = os.getenv("GOOGLE_OAUTH_CLIENT_SECRET", "")

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
if not DEBUG and CELERY_BROKER_URL and CELERY_TASK_ALWAYS_EAGER:
    raise ImproperlyConfigured(
        "Celery eager mode is not allowed in production when CELERY_BROKER_URL/REDIS_URL is set. "
        "Set CELERY_TASK_ALWAYS_EAGER=False and run a Celery worker + beat."
    )
if not DEBUG and not CELERY_BROKER_URL and CELERY_TASK_ALWAYS_EAGER:
    print(
        "[settings] Production with no broker: scheduled tasks (email reminders, trial reminder) will NOT run. "
        "On Railway: add Redis, set REDIS_URL, then add a Celery worker and a Celery beat service."
    )
CELERY_BROKER_CONNECTION_RETRY_ON_STARTUP = True
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
                {
                    "name": "^.*$",
                    "styles": True,
                    "attributes": True,
                    "classes": True,
                }
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

# Prevent Django from creating migrations for core app
# since all models have been moved to other apps
MIGRATION_MODULES = {
    "core": None,  # Disable migrations for core app
}

# Error reporting: Sentry disabled (paid in production). Set SENTRY_DSN and uncomment to re-enable.
# SENTRY_DSN = os.getenv("SENTRY_DSN")
# if SENTRY_DSN and "test" not in sys.argv:
#     import sentry_sdk
#     from sentry_sdk.integrations.django import DjangoIntegration
#     sentry_sdk.init(
#         dsn=SENTRY_DSN,
#         environment=DJANGO_ENV,
#         integrations=[DjangoIntegration()],
#         traces_sample_rate=0.1,
#         send_default_pii=False,
#         sample_rate=1.0 if not DEBUG else 0.2,
#     )

if "test" in sys.argv:
    # Use same PostgreSQL as dev/prod (DATABASE_URL). No SQLite override.
    PASSWORD_HASHERS = ["django.contrib.auth.hashers.MD5PasswordHasher"]

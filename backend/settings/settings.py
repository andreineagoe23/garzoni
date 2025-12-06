import os
import socket
import sys
from datetime import timedelta
from pathlib import Path

import dj_database_url
from corsheaders.defaults import default_headers
from django.core.exceptions import ImproperlyConfigured
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env")


def env_bool(name: str, default: bool = False) -> bool:
    value = os.getenv(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "t", "yes", "y", "on"}


def env_csv(name: str, default=None):
    value = os.getenv(name)
    if value:
        return [item.strip() for item in value.split(",") if item.strip()]
    return [] if default is None else default


DEBUG = env_bool("DEBUG", False)

SECRET_KEY = os.getenv("SECRET_KEY")
if not SECRET_KEY:
    if DEBUG:
        SECRET_KEY = "django-insecure-change-me"
    else:
        raise ImproperlyConfigured("SECRET_KEY environment variable must be set when DEBUG is False.")

ALLOWED_HOSTS = env_csv(
    "ALLOWED_HOSTS_CSV",
    default=["localhost", "127.0.0.1"] if DEBUG else [],
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
    "rest_framework_simplejwt",
    "core",
    "django_rest_passwordreset",
    "ckeditor",
    "django_celery_results",
    "django_celery_beat",
]

MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",
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

WSGI_APPLICATION = "settings.wsgi.application"

database_url = os.getenv("DATABASE_URL")
# Convert postgres:// to postgresql:// for compatibility
if database_url and database_url.startswith("postgres://"):
    database_url = database_url.replace("postgres://", "postgresql://", 1)

# Track if we're connecting to localhost (local development)
is_localhost = False

# Check if DATABASE_URL points to Docker hostname "db" and we're not in Docker
# This works for any database type (MySQL, PostgreSQL, etc.)
if database_url and "@db:" in database_url:
    try:
        # Try to resolve "db" hostname to check if we're in Docker
        socket.gethostbyname("db")
        # If successful, we're in Docker, keep the URL as is
    except (socket.gaierror, OSError):
        # Can't resolve "db", we're not in Docker, replace with localhost
        # Works for both MySQL (mysql://user:pass@db:3306/db) and PostgreSQL (postgresql://user:pass@db:5432/db)
        database_url = database_url.replace("@db:", "@localhost:")
        is_localhost = True

# Check if connecting to localhost (either from replacement above or already set)
if database_url and ("@localhost:" in database_url or "@127.0.0.1:" in database_url):
    is_localhost = True
    # Remove SSL parameters from URL for localhost connections
    # PostgreSQL: remove ?sslmode=require or similar
    if "?" in database_url:
        url_parts = database_url.split("?")
        base_url = url_parts[0]
        params = url_parts[1].split("&")
        # Filter out SSL-related parameters
        non_ssl_params = [p for p in params if not p.lower().startswith(("sslmode", "ssl", "sslrootcert", "sslcert", "sslkey"))]
        if non_ssl_params:
            database_url = base_url + "?" + "&".join(non_ssl_params)
        else:
            database_url = base_url

default_db = None
if database_url:
    # Don't require SSL for localhost connections or in DEBUG mode
    ssl_required = not DEBUG and not is_localhost
    default_db = dj_database_url.parse(database_url, conn_max_age=600, ssl_require=ssl_required)
    
    # For localhost connections, explicitly disable SSL in OPTIONS
    if is_localhost and default_db:
        if "OPTIONS" not in default_db:
            default_db["OPTIONS"] = {}
        # PostgreSQL - explicitly disable SSL
        if default_db.get("ENGINE") == "django.db.backends.postgresql":
            default_db["OPTIONS"]["sslmode"] = "disable"
        # MySQL - disable SSL by removing SSL options
        elif "mysql" in default_db.get("ENGINE", "").lower():
            # Remove any SSL-related options that might have been set
            default_db["OPTIONS"].pop("ssl", None)
            default_db["OPTIONS"].pop("ssl_mode", None)
            default_db["OPTIONS"].pop("ssl_ca", None)
            default_db["OPTIONS"].pop("ssl_cert", None)
            default_db["OPTIONS"].pop("ssl_key", None)
            
if not default_db:
    if DEBUG:
        default_db = {
            "ENGINE": "django.db.backends.sqlite3",
            "NAME": BASE_DIR / "db.sqlite3",
        }
    else:
        raise ImproperlyConfigured("DATABASE_URL environment variable must be set when DEBUG is False.")

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
    "DEFAULT_AUTHENTICATION_CLASSES": ("rest_framework_simplejwt.authentication.JWTAuthentication",),
    "DEFAULT_PERMISSION_CLASSES": ("rest_framework.permissions.IsAuthenticated",),
    "DEFAULT_THROTTLE_CLASSES": [
        "rest_framework.throttling.AnonRateThrottle",
        "rest_framework.throttling.UserRateThrottle",
    ],
    "DEFAULT_THROTTLE_RATES": {"anon": "100/day", "user": "1000/day"},
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
}

cors_allowed_origins = env_csv("CORS_ALLOWED_ORIGINS_CSV")
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
    "authorization",
    "content-type",
    "x-csrftoken",
    "x-requested-with",
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

EMAIL_BACKEND = "django.core.mail.backends.smtp.EmailBackend"
EMAIL_HOST = os.getenv("EMAIL_HOST", "smtp.gmail.com")
EMAIL_PORT = int(os.getenv("EMAIL_PORT", 587))
EMAIL_USE_TLS = env_bool("EMAIL_USE_TLS", True)
EMAIL_HOST_USER = os.getenv("EMAIL_HOST_USER", "")
EMAIL_HOST_PASSWORD = os.getenv("EMAIL_HOST_PASSWORD", "")
DEFAULT_FROM_EMAIL = os.getenv("DEFAULT_FROM_EMAIL", EMAIL_HOST_USER or "webmaster@localhost")

FRONTEND_URL = os.getenv("FRONTEND_URL", "https://www.monevo.tech")

STRIPE_SECRET_KEY = os.getenv("STRIPE_SECRET_KEY", "")
STRIPE_WEBHOOK_SECRET = os.getenv("STRIPE_WEBHOOK_SECRET", "")
STRIPE_PUBLISHABLE_KEY = os.getenv("STRIPE_PUBLISHABLE_KEY", "")

RECAPTCHA_PUBLIC_KEY = os.getenv("RECAPTCHA_PUBLIC_KEY", "")
RECAPTCHA_PRIVATE_KEY = os.getenv("RECAPTCHA_PRIVATE_KEY", "")
RECAPTCHA_REQUIRED_SCORE = float(os.getenv("RECAPTCHA_REQUIRED_SCORE", "0.5"))

GOOGLE_APPLICATION_CREDENTIALS = os.getenv("GOOGLE_APPLICATION_CREDENTIALS")
DIALOGFLOW_PROJECT_ID = os.getenv("DIALOGFLOW_PROJECT_ID", "")
CSE_ID = os.getenv("CSE_ID", "")
API_KEY = os.getenv("API_KEY", "")
RECRAFT_API_KEY = os.getenv("RECRAFT_API_KEY")

CELERY_BROKER_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")
CELERY_BROKER_CONNECTION_RETRY_ON_STARTUP = True
CELERY_RESULT_BACKEND = "django-db"
CELERY_ACCEPT_CONTENT = ["json"]
CELERY_TASK_SERIALIZER = "json"
CELERY_RESULT_SERIALIZER = "json"
CELERY_TIMEZONE = TIME_ZONE

CKEDITOR_CONFIGS = {
    "default": {
        "toolbar": "Full",
        "height": 300,
        "width": "auto",
        "extraPlugins": "uploadimage",
        "filebrowserUploadUrl": "/ckeditor/upload/",
    },
}

CKEDITOR_UPLOAD_PATH = "uploads/ckeditor/"

if "test" in sys.argv:
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.sqlite3",
            "NAME": ":memory:",
        }
    }
    PASSWORD_HASHERS = ["django.contrib.auth.hashers.MD5PasswordHasher"]
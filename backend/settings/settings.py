import os
import socket
import sys
from datetime import timedelta
from pathlib import Path

import dj_database_url
from corsheaders.defaults import default_headers
from django.core.exceptions import ImproperlyConfigured
from dotenv import load_dotenv

from core.utils import env_bool, env_csv

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env")
DEBUG = env_bool("DEBUG", False)

SECRET_KEY = os.getenv("SECRET_KEY")
if not SECRET_KEY:
    if DEBUG:
        SECRET_KEY = "django-insecure-change-me"
    else:
        raise ImproperlyConfigured("SECRET_KEY environment variable must be set when DEBUG is False.")

ALLOWED_HOSTS = env_csv(
    "ALLOWED_HOSTS_CSV",
    default=[
        "localhost",
        "127.0.0.1",
        "andreineagoe23.pythonanywhere.com",
    ],
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
    # Domain-specific apps
    "authentication",
    "education",
    "gamification",
    "finance",
    "support",
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

default_db = None
if database_url:
    default_db = dj_database_url.parse(database_url, conn_max_age=600, ssl_require=False)

    if default_db:
        if "OPTIONS" not in default_db:
            default_db["OPTIONS"] = {}

        if "mysql" in default_db.get("ENGINE", "").lower():
            default_db["OPTIONS"].pop("sslmode", None)
            default_db["OPTIONS"]["charset"] = "utf8mb4"
            default_db["OPTIONS"]["init_command"] = "SET sql_mode='STRICT_TRANS_TABLES'"

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

EMAIL_BACKEND = "django.core.mail.backends.smtp.EmailBackend"
EMAIL_HOST = os.getenv("EMAIL_HOST", "smtp.gmail.com")
EMAIL_PORT = int(os.getenv("EMAIL_PORT", 587))
EMAIL_USE_TLS = env_bool("EMAIL_USE_TLS", True)
EMAIL_HOST_USER = os.getenv("EMAIL_HOST_USER", "")
EMAIL_HOST_PASSWORD = os.getenv("EMAIL_HOST_PASSWORD", "")
DEFAULT_FROM_EMAIL = os.getenv("DEFAULT_FROM_EMAIL", EMAIL_HOST_USER or "webmaster@localhost")

if DEBUG:
    FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")
else:
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
ALPHA_VANTAGE_API_KEY = os.getenv("ALPHA_VANTAGE_API_KEY", "")
FREE_CURRENCY_API_KEY = os.getenv("FREE_CURRENCY_API_KEY", "")
EXCHANGE_RATE_API_KEY = os.getenv("EXCHANGE_RATE_API_KEY", "")

CELERY_BROKER_URL = os.getenv("CELERY_BROKER_URL") or (os.getenv("REDIS_URL") if DEBUG else None)
CELERY_TASK_ALWAYS_EAGER = env_bool("CELERY_TASK_ALWAYS_EAGER", CELERY_BROKER_URL is None)
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
        "licenseKey": "eyJhbGciOiJFUzI1NiJ9.eyJleHAiOjE3NjYzNjE1OTksImp0aSI6Ijg0OWU3Y2M0LWY3OTktNDVmYy1iNGYwLTMzZDI4N2Y5ZjVlNiIsInVzYWdlRW5kcG9pbnQiOiJodHRwczovL3Byb3h5LWV2ZW50LmNrZWRpdG9yLmNvbSIsImRpc3RyaWJ1dGlvbkNoYW5uZWwiOlsiY2xvdWQiLCJkcnVwYWwiLCJzaCJdLCJ3aGl0ZUxhYmVsIjp0cnVlLCJsaWNlbnNlVHlwZSI6InRyaWFsIiwiZmVhdHVyZXMiOlsiKiJdLCJ2YyI6IjgzMTFjMmQ2In0.h_kaJ2F9B79VlBU9unjEpRqtg7oErZ3EJQlzSKWfmml6jY-MO3uws1lm2KZvzKojsQUmbpeO_Q5zToCnbNx5VQ",
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
    'core': None,  # Disable migrations for core app
}

if "test" in sys.argv:
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.sqlite3",
            "NAME": ":memory:",
        }
    }
    PASSWORD_HASHERS = ["django.contrib.auth.hashers.MD5PasswordHasher"]

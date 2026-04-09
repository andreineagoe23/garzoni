# syntax=docker/dockerfile:1
# Build context is usually the backend dir (Railway with backend/Dockerfile, or local docker-compose).
# So BUILD_SRC defaults to ".". From repo root: docker build --build-arg BUILD_SRC=backend -f backend/Dockerfile .

FROM python:3.12-alpine AS runtime

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    DJANGO_SETTINGS_MODULE=settings.settings \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app

# Install runtime dependencies + build deps needed for pip install, then remove build deps
RUN apk add --no-cache \
    libpq \
    libjpeg-turbo \
    zlib \
    freetype \
    libffi \
    && apk add --no-cache --virtual .build-deps \
    gcc \
    musl-dev \
    postgresql-dev \
    libjpeg-turbo-dev \
    zlib-dev \
    freetype-dev \
    libffi-dev

ARG BUILD_SRC=.
COPY ${BUILD_SRC}/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt \
    && rm -rf /root/.cache/pip \
    && apk del .build-deps

# Copy backend into /app so we have /app/media, /app/manage.py, /app/settings, etc.
COPY ${BUILD_SRC}/ /app/

# Verify essential media seed assets are present (small PNG assets only)
RUN test -f /app/media/path_images/basicfinance.png && ls /app/media/mascots/*.png >/dev/null 2>&1 || (echo "ERROR: /app/media missing required seed assets. Check .dockerignore and build context." && exit 1)

# Collect static files at build time (admin CSS/JS, DRF, CKEditor).
# Uses dummy env so settings.py doesn't raise ImproperlyConfigured.
RUN DATABASE_URL="sqlite:////tmp/build.db" \
    DJANGO_ENV="build" \
    DEBUG="True" \
    SECRET_KEY="build-only" \
    ALLOWED_HOSTS_CSV="*" \
    STRIPE_SECRET_KEY="" \
    CLOUDINARY_URL="" \
    ALLOW_LOCAL_MEDIA_STORAGE="1" \
    python -c "\
import django, os; \
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'settings.settings'); \
django.setup(); \
from django.conf import settings as s; \
print('STATIC_ROOT:', s.STATIC_ROOT); \
print('STATIC_ROOT exists:', os.path.exists(str(s.STATIC_ROOT))); \
print('INSTALLED_APPS:', [a for a in s.INSTALLED_APPS if 'static' in a or 'admin' in a]); \
print('STORAGES:', s.STORAGES.get('staticfiles')); \
from django.contrib.staticfiles.finders import get_finders; \
for finder in get_finders(): \
    for path, storage in finder.list(None): \
        if 'admin' in path: \
            print('FOUND:', path); \
            break; \
    else: continue; \
    break; \
" \
    && python manage.py collectstatic --noinput --verbosity 2 2>&1 | head -30 \
    && echo "[build] files in STATIC_ROOT:" \
    && find /app -name "staticfiles" -type d 2>/dev/null \
    && find /app/staticfiles -type f 2>/dev/null | wc -l || echo "0"

# Backup static files so entrypoint can restore if a volume mount shadows /app/staticfiles
RUN cp -r /app/staticfiles /app/staticfiles_build || true

# Seed for Railway volume: duplicate media so entrypoint can fill an empty /app/media mount
RUN mkdir -p /app/media_seed && cp -r /app/media/. /app/media_seed/

# Backup for entrypoint (mascots only)
RUN mkdir -p /app/media_mascots_template && cp -r /app/media/mascots/. /app/media_mascots_template/ 2>/dev/null || true

# Fix entrypoint line endings (CRLF can cause "permission denied") and ensure executable
RUN sed -i 's/\r$//' /app/docker/entrypoint.sh 2>/dev/null || true \
    && chmod +x /app/docker/entrypoint.sh

EXPOSE 8000

# Run entrypoint via sh so it works even if exec bit is lost (e.g. volume mounts)
ENTRYPOINT ["/bin/sh", "/app/docker/entrypoint.sh"]
CMD ["gunicorn", "settings.wsgi:application", "--bind", "0.0.0.0:8000", "--workers", "2", "--timeout", "300", "--graceful-timeout", "30", "--keep-alive", "5", "--max-requests", "1000", "--max-requests-jitter", "100"]

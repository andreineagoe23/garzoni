# syntax=docker/dockerfile:1
# Build context is usually the backend dir (Railway with backend/Dockerfile, or local docker-compose).
# So BUILD_SRC defaults to ".". From repo root: docker build --build-arg BUILD_SRC=backend -f backend/Dockerfile .

FROM python:3.12-alpine3.23 AS runtime

# Patch all OS-level packages (including openssl) at build time.
# This resolves CVE-2026-31790, CVE-2026-28390, CVE-2026-28389, and related HIGH vulns
# in openssl 3.5.5-r0 → fixed in 3.5.6-r0 (Alpine 3.23 advisory 2026-04-xx).
RUN apk upgrade --no-cache

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    DJANGO_SETTINGS_MODULE=settings.settings \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app

# Runtime + build deps for pip packages (psycopg2, Pillow, cryptography)
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

# Copy backend into /app so we have /app/manage.py, /app/settings, etc.
COPY ${BUILD_SRC}/ /app/

# Bake static files into the image at build time.
# DJANGO_ENV=build activates the _IS_BUILD_PHASE bypass in settings.py.
# stderr is NOT redirected here so Railway shows the full traceback on failure.
RUN SECRET_KEY=build-time-collectstatic-only \
    DATABASE_URL=postgresql://x:x@localhost/x \
    DJANGO_ENV=build \
    DEBUG=False \
    python manage.py collectstatic --noinput --clear \
    && echo "[build] collectstatic OK: $(find /app/staticfiles -type f | wc -l) files"

# Fix entrypoint line endings (CRLF can cause "permission denied") and ensure executable
RUN sed -i 's/\r$//' /app/docker/entrypoint.sh 2>/dev/null || true \
    && chmod +x /app/docker/entrypoint.sh

EXPOSE 8000

# Run entrypoint via sh so it works even if exec bit is lost (e.g. volume mounts)
ENTRYPOINT ["/bin/sh", "/app/docker/entrypoint.sh"]
CMD ["gunicorn", "settings.wsgi:application", "--bind", "0.0.0.0:8000", "--workers", "2", "--timeout", "300", "--graceful-timeout", "30", "--keep-alive", "5", "--max-requests", "1000", "--max-requests-jitter", "100"]

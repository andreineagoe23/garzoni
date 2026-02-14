# syntax=docker/dockerfile:1
# Build context is usually the backend dir (Railway with backend/Dockerfile, or local docker-compose).
# So BUILD_SRC defaults to ".". From repo root: docker build --build-arg BUILD_SRC=backend -f backend/Dockerfile .

ARG BUILD_SRC=.

FROM python:3.12-slim-bookworm AS builder

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    DEBIAN_FRONTEND=noninteractive

WORKDIR /app

# Install build dependencies in a single layer (no debconf prompts)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    libjpeg-dev \
    zlib1g-dev \
    libfreetype6-dev \
    libffi-dev \
    pkg-config \
    && rm -rf /var/lib/apt/lists/*

ARG BUILD_SRC=.
COPY ${BUILD_SRC}/requirements.txt .

# Install Python dependencies
RUN pip install --upgrade pip setuptools wheel \
    && pip wheel --wheel-dir /wheels --no-cache-dir -r requirements.txt


FROM python:3.12-slim-bookworm AS runtime

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    DJANGO_SETTINGS_MODULE=settings.settings \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    DEBIAN_FRONTEND=noninteractive

WORKDIR /app

# Install only runtime dependencies (no build tools, no debconf prompts)
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq5 \
    libjpeg62-turbo \
    zlib1g \
    libfreetype6 \
    libffi8 \
    && rm -rf /var/lib/apt/lists/* \
    && apt-get clean

# Copy wheels and requirements from builder and install (no network: use base pip + local wheels only)
COPY --from=builder /wheels /wheels
ARG BUILD_SRC=.
COPY ${BUILD_SRC}/requirements.txt .
RUN pip install --no-cache-dir --no-index --find-links=/wheels -r requirements.txt \
    && rm -rf /wheels

# Copy backend into /app so we have /app/media, /app/manage.py, /app/settings, etc.
COPY ${BUILD_SRC}/ /app/

# Force-include media so path_images, mascots, etc. are never missing (e.g. Railway)
COPY ${BUILD_SRC}/media/ /app/media/

# Verify media is present (build fails if path_images or mascots are missing)
RUN test -f /app/media/path_images/basicfinance.png && test -f /app/media/mascots/monevo-bear.png && test -f /app/media/mascots/Bear-Mascot.mp4 || (echo "ERROR: /app/media missing required files. Check .dockerignore and build context." && exit 1)

# Seed for Railway volume: duplicate media so entrypoint can fill an empty /app/media mount
RUN mkdir -p /app/staticfiles \
  && mkdir -p /app/media_seed && cp -r /app/media/. /app/media_seed/

# Backup for entrypoint (mascots only)
RUN mkdir -p /app/media_mascots_template && cp -r /app/media/mascots/. /app/media_mascots_template/ 2>/dev/null || true

# Fix entrypoint line endings (CRLF can cause "permission denied") and ensure executable
RUN sed -i 's/\r$//' /app/docker/entrypoint.sh 2>/dev/null || true \
    && chmod +x /app/docker/entrypoint.sh

EXPOSE 8000

# Run entrypoint via sh so it works even if exec bit is lost (e.g. volume mounts)
ENTRYPOINT ["/bin/sh", "/app/docker/entrypoint.sh"]
CMD ["gunicorn", "settings.wsgi:application", "--bind", "0.0.0.0:8000", "--workers", "2", "--timeout", "300", "--graceful-timeout", "30", "--keep-alive", "5", "--max-requests", "1000", "--max-requests-jitter", "100"]

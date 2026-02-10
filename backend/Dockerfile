# syntax=docker/dockerfile:1
# When Railway uses Dockerfile path "backend/Dockerfile", build context is REPO ROOT.
# So we copy from backend/ into /app. Set BUILD_SRC=. when building from backend dir (e.g. local).

ARG BUILD_SRC=backend

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

ARG BUILD_SRC=backend
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
ARG BUILD_SRC=backend
COPY ${BUILD_SRC}/requirements.txt .
RUN pip install --no-cache-dir --no-index --find-links=/wheels -r requirements.txt \
    && rm -rf /wheels

# Copy backend into /app so we have /app/media, /app/manage.py, /app/settings, etc.
# Railway: context = repo root → BUILD_SRC=backend (default). Local from backend dir: docker build --build-arg BUILD_SRC=. -f Dockerfile .
COPY ${BUILD_SRC}/ /app/

# Seed for Railway volume: duplicate media so entrypoint can fill an empty /app/media mount
RUN mkdir -p /app/staticfiles \
  && if [ -d /app/media ] && [ -n "$(ls -A /app/media 2>/dev/null)" ]; then \
       mkdir -p /app/media_seed && cp -r /app/media/. /app/media_seed/; \
     fi

# Backup for entrypoint (mascots only)
RUN mkdir -p /app/media_mascots_template && cp -r /app/media/mascots/. /app/media_mascots_template/ 2>/dev/null || true

# Fix entrypoint line endings (CRLF can cause "permission denied") and ensure executable
RUN sed -i 's/\r$//' /app/docker/entrypoint.sh 2>/dev/null || true \
    && chmod +x /app/docker/entrypoint.sh

EXPOSE 8000

# Run entrypoint via sh so it works even if exec bit is lost (e.g. volume mounts)
ENTRYPOINT ["/bin/sh", "/app/docker/entrypoint.sh"]
CMD ["gunicorn", "settings.wsgi:application", "--bind", "0.0.0.0:8000", "--workers", "2", "--timeout", "300", "--graceful-timeout", "30", "--keep-alive", "5", "--max-requests", "1000", "--max-requests-jitter", "100"]

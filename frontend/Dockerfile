# syntax=docker/dockerfile:1
# Build from repository root: docker build -f frontend/Dockerfile .

FROM node:20-alpine

RUN corepack enable && corepack prepare pnpm@9.15.4 --activate

WORKDIR /app

COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages/core/package.json packages/core/
COPY frontend/package.json frontend/

RUN pnpm install --frozen-lockfile

COPY packages/core packages/core
COPY frontend frontend

WORKDIR /app/frontend

ARG VITE_BACKEND_URL
ARG VITE_BACKEND_PORT
ARG VITE_CHECKOUT_URL
ENV VITE_BACKEND_URL=$VITE_BACKEND_URL \
    VITE_BACKEND_PORT=$VITE_BACKEND_PORT \
    VITE_CHECKOUT_URL=$VITE_CHECKOUT_URL

EXPOSE 3000
ENV HOST=0.0.0.0

CMD ["pnpm", "exec", "vite", "--host"]

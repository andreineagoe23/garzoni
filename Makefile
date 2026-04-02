dev:
	docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build

# Dev with Celery worker + beat (for testing async tasks). Default dev has no Celery.
dev-celery:
	docker compose -f docker-compose.yml -f docker-compose.dev.yml --profile celery up --build

prod:
	docker compose -f docker-compose.yml -f docker-compose.prod.yml --profile celery up -d --build

.PHONY: help up down build logs backend-shell backend-migrate backend-collectstatic backend-superuser \
	backend-test backend-lint backend-flake8 seed-exercises ensure-lesson-sections load-backup load-mission-pool backfill-mission-completions frontend-install frontend-test frontend-lint frontend-build \
	test-all pre-commit-install pre-commit

help:
	@echo "Common commands:"
	@echo "  make up                 Start docker compose services"
	@echo "  make down               Stop docker compose services"
	@echo "  make logs               Tail docker compose logs"
	@echo "  make build              Build docker images"
	@echo "  make backend-migrate     Run Django migrations"
	@echo "  make backend-test        Run Django unit tests"
	@echo "  make backend-lint        Run black --check (required in CI)"
	@echo "  make pre-commit-install  Install git pre-commit hook (runs on every commit)"
	@echo "  make pre-commit          Run pre-commit on all files"
	@echo "  make seed-exercises      Seed example exercises"
	@echo "  make load-mission-pool   Load mission pool from gamification/fixtures/mission_pool.json"
	@echo "  make backfill-mission-completions  Assign all missions to all existing users"
	@echo "  make frontend-test       Run frontend tests (requires node env)"
	@echo "  make test-all            Run backend lint + backend tests + frontend tests (backend requires docker stack up)"

up:
	docker compose up -d --build

down:
	docker compose down

build:
	docker compose build

logs:
	docker compose logs -f --tail=200

backend-shell:
	docker compose exec backend sh

backend-migrate:
	docker compose exec backend python manage.py migrate --noinput

backend-collectstatic:
	docker compose exec backend python manage.py collectstatic --noinput

backend-superuser:
	docker compose exec backend python manage.py createsuperuser

# Create or fix superuser (e.g. after DB reset). Usage: make ensure-superuser USER=andreineagoe23 EMAIL=you@example.com
ensure-superuser:
	docker compose exec backend python manage.py ensure_superuser $(or $(USER),andreineagoe23) --email $(or $(EMAIL),neagoe.andrei23@yahoo.com)

backend-test:
	docker compose exec backend python manage.py test

seed-exercises:
	docker compose exec backend python manage.py seed_exercises

# Load mission pool (requires dev stack with backend volume: make dev, then make load-mission-pool)
load-mission-pool:
	docker compose -f docker-compose.yml -f docker-compose.dev.yml exec backend python manage.py load_mission_pool

backfill-mission-completions:
	docker compose -f docker-compose.yml -f docker-compose.dev.yml exec backend python manage.py backfill_mission_completions

ensure-lesson-sections:
	docker compose exec backend python manage.py ensure_lesson_sections

# Load canonical backup (500 lesson sections, 263 exercises). Use with dev stack.
# Run from repo root: make -f Makefile load-backup  (requires: docker compose -f docker-compose.dev.yml up -d)
load-backup:
	docker compose -f docker-compose.dev.yml exec backend python manage.py loaddata backups/backup_for_postgres_20260206_203429.json

backend-lint:
	python -m black --check backend

backend-flake8:
	python -m flake8 backend

frontend-install:
	cd frontend && npm ci

frontend-test:
	pnpm --filter @monevo/web test

frontend-lint:
	pnpm --filter @monevo/web lint

frontend-build:
	pnpm --filter @monevo/web build

# Run backend lint, backend tests, and frontend tests. Backend tests require the docker stack to be up (e.g. make dev).
test-all: backend-lint backend-test frontend-test

pre-commit-install:
	python -m pip install -r backend/requirements-dev.txt
	pre-commit install

pre-commit:
	pre-commit run --all-files

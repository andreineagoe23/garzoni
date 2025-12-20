.PHONY: help up down build logs backend-shell backend-migrate backend-collectstatic backend-superuser \
	backend-test backend-lint seed-exercises ensure-lesson-sections frontend-install frontend-test frontend-lint frontend-build

help:
	@echo "Common commands:"
	@echo "  make up                 Start docker compose services"
	@echo "  make down               Stop docker compose services"
	@echo "  make logs               Tail docker compose logs"
	@echo "  make build              Build docker images"
	@echo "  make backend-migrate     Run Django migrations"
	@echo "  make backend-test        Run Django unit tests"
	@echo "  make backend-lint        Run black/flake8 (requires local python env)"
	@echo "  make seed-exercises      Seed example exercises"
	@echo "  make frontend-test       Run frontend tests (requires node env)"

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

backend-test:
	docker compose exec backend python manage.py test

seed-exercises:
	docker compose exec backend python manage.py seed_exercises

ensure-lesson-sections:
	docker compose exec backend python manage.py ensure_lesson_sections

backend-lint:
	python -m black --check backend
	python -m flake8 backend

frontend-install:
	cd frontend && npm ci

frontend-test:
	cd frontend && npm test -- --watchAll=false

frontend-lint:
	cd frontend && npm run lint

frontend-build:
	cd frontend && npm run build



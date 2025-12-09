.PHONY: help install dev run test lint format migrate seed docker-up docker-down

# Default target
help:
	@echo "Medical Analysis API - Available commands:"
	@echo ""
	@echo "  make install     - Install dependencies"
	@echo "  make dev         - Run development server"
	@echo "  make run         - Run production server"
	@echo "  make test        - Run tests"
	@echo "  make lint        - Run linter"
	@echo "  make format      - Format code"
	@echo "  make migrate     - Run database migrations"
	@echo "  make seed        - Seed biomarkers data"
	@echo "  make docker-up   - Start with Docker"
	@echo "  make docker-down - Stop Docker containers"

# Install dependencies
install:
	pip install -r requirements.txt

# Run development server
dev:
	uvicorn app.main:app --reload --port 8000

# Run production server
run:
	uvicorn app.main:app --host 0.0.0.0 --port 8000

# Run tests
test:
	pytest -v

# Run linter
lint:
	black --check app/
	isort --check-only app/

# Format code
format:
	black app/
	isort app/

# Create new migration
migration:
	alembic revision --autogenerate -m "$(msg)"

# Run migrations
migrate:
	alembic upgrade head

# Rollback migration
rollback:
	alembic downgrade -1

# Seed biomarkers
seed:
	python -m scripts.seed_biomarkers

# Docker commands
docker-up:
	docker-compose up -d --build

docker-down:
	docker-compose down

docker-logs:
	docker-compose logs -f api

# Database shell
db-shell:
	docker-compose exec db psql -U postgres -d medical_db

# Full setup
setup: install migrate seed
	@echo "Setup complete! Run 'make dev' to start the server."




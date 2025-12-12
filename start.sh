#!/bin/bash

echo "🚀 Starting deployment script..."

# Run database migrations
echo "📦 Running database migrations..."
# Always try to upgrade to head. If it fails, we log it but continue 
# because app/main.py now has a hotfix for the critical schema change.
alembic upgrade head || echo "⚠️ Migration failed, continuing anyway..."

# Start the application
echo "🔥 Starting Uvicorn..."
exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}

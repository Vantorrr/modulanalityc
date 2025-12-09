#!/bin/bash

echo "🚀 Starting deployment script..."

# Run database migrations (don't exit on error)
echo "📦 Running database migrations..."
alembic upgrade head || echo "⚠️ Migration failed, continuing anyway..."

# Import products - DISABLED for stability
# To run import manually: python -m app.scripts.import_products
# echo "🛒 Importing products..."
# python -m app.scripts.import_products || echo "⚠️ Product import finished with warnings"

# Start the application
echo "🔥 Starting Uvicorn..."
exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}

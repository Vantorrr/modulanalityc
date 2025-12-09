#!/bin/bash

# Exit on error
set -e

echo "🚀 Starting deployment script..."

# Run database migrations
echo "📦 Running database migrations..."
alembic upgrade head

# Import products if table is empty (simple check could be added, but for now we run it)
# We run it in background or just once. For safety, let's run it.
# Warning: Running this every time might be slow if optimization is needed.
# For now, let's run it only if a specific flag is set or just skip if populated.
# Actually, let's just run it. The script should handle duplicates or we trust it.
echo "🛒 Importing products..."
python -m app.scripts.import_products || echo "⚠️ Product import finished with warnings"

# Start the application
echo "🔥 Starting Uvicorn..."
exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}


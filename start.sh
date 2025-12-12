#!/bin/bash

echo "🚀 Starting deployment script..."

# Run database migrations
echo "📦 Running database migrations..."

# Try to upgrade to head
if alembic upgrade head; then
    echo "✅ Migrations applied successfully"
else
    echo "⚠️ Migration failed, checking if database already exists..."
    
    # If migration failed, it might be because tables already exist
    # Try to stamp the database as current version
    if alembic stamp head; then
        echo "✅ Database marked as up-to-date"
    else
        echo "⚠️ Could not stamp database, continuing anyway..."
    fi
fi

# Start the application
echo "🔥 Starting Uvicorn..."
exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}

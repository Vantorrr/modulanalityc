#!/bin/bash

echo "🚀 Starting deployment script..."

# Run database migrations with safety net for missing revisions
echo "📦 Running database migrations..."

# If alembic fails due to missing revisions, forcibly reset the version table
if ! alembic current 2>&1 | grep -q "head"; then
  echo "⚠️ Alembic state inconsistent, resetting..."
  # Delete all rows from alembic_version table to start fresh
  python -c "
from app.core.config import settings
from sqlalchemy import create_engine, text
engine = create_engine(settings.sync_database_url)
with engine.connect() as conn:
    conn.execute(text('DELETE FROM alembic_version'))
    conn.commit()
print('✅ Alembic version table cleared')
" 2>/dev/null || echo "⚠️ Could not clear alembic_version (table may not exist yet)"
fi

alembic upgrade head || echo "⚠️ Migration failed, continuing anyway..."

# Import products - DISABLED for stability
# To run import manually: python -m app.scripts.import_products
# echo "🛒 Importing products..."
# python -m app.scripts.import_products || echo "⚠️ Product import finished with warnings"

# Start the application
echo "🔥 Starting Uvicorn..."
exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}

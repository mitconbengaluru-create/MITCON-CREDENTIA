#!/bin/sh
set -e

echo "🐳 Running MITCON Credentia entrypoint startup sequence..."

# 1. Verify Database URL is set
if [ -z "$DATABASE_URL" ]; then
  echo "❌ Error: DATABASE_URL environment variable is missing!"
  exit 1
fi

echo "Prisma Database migrations check..."
# Run Prisma deploy migrations safely, allowing P3005 (database not empty)
# which is common when deploying to databases that were already synchronized
# or baselined without the migration history table.
MIGRATE_OUT=$(npx prisma migrate deploy 2>&1)
MIGRATE_STATUS=$?

echo "$MIGRATE_OUT"

if [ $MIGRATE_STATUS -ne 0 ]; then
  if echo "$MIGRATE_OUT" | grep -q -e "P3005" -e "database schema is not empty"; then
    echo "⚠️ Warning: Database schema is not empty (P3005). Assuming database is already initialized. Continuing..."
  else
    echo "❌ Error: Prisma migrate deploy failed! Aborting container startup."
    exit 1
  fi
fi

echo "✅ Migrations check complete."

# 2. Execute downstream command payload (e.g. npm start)
exec "$@"

#!/bin/sh
set -e

echo "🐳 Running MITCON Credentia entrypoint startup sequence..."

# 1. Verify Database URL is set
if [ -z "$DATABASE_URL" ]; then
  echo "❌ Error: DATABASE_URL environment variable is missing!"
  exit 1
fi

echo "Prisma Database migrations check..."
# Run Prisma deploy migrations safely
if ! npx prisma migrate deploy; then
  echo "❌ Error: Prisma migrate deploy failed! Aborting container startup."
  exit 1
fi

echo "✅ Migrations applied successfully."

# 2. Execute downstream command payload (e.g. npm start)
exec "$@"

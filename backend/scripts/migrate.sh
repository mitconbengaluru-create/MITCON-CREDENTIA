#!/bin/sh
set -e

echo "Deploying database schema migrations..."
npx prisma migrate deploy

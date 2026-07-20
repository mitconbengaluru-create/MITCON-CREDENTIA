#!/bin/sh
set -e

PORT="${PORT:-5000}"

# Invoke internal API health probe check endpoint
if curl -s -f "http://localhost:${PORT}/health" > /dev/null; then
  echo "✅ Application health check passed."
  exit 0
else
  echo "❌ Application health check failed!"
  exit 1
fi

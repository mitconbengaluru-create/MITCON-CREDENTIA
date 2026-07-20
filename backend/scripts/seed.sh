#!/bin/sh
set -e

echo "Populating database configuration tables and records..."
node prisma/seed.js

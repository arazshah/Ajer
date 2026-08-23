#!/bin/sh
set -eu

mkdir -p /app/data /app/public/uploads
database_path="${DATABASE_URL#file:}"
seed_database="false"
if [ "${SEED_DEMO_DATA:-true}" = "true" ] && [ ! -f "$database_path" ]; then
  seed_database="true"
fi

./node_modules/.bin/prisma migrate deploy
if [ "$seed_database" = "true" ]; then
  echo "Initializing Ajer with fictional demo data..."
  ./node_modules/.bin/tsx prisma/seed.ts
fi

exec ./node_modules/.bin/next start -H "${HOSTNAME:-0.0.0.0}" -p "${PORT:-3000}"

#!/bin/sh
set -eu

./node_modules/.bin/prisma migrate deploy
./node_modules/.bin/tsx scripts/bootstrap.ts
if [ "${SEED_DEMO_DATA:-false}" = "true" ]; then
  echo "Initializing Ajer with fictional demo data..."
  SEED_ONLY_IF_EMPTY=true ./node_modules/.bin/tsx prisma/seed.ts
fi

exec node .next/standalone/server.js

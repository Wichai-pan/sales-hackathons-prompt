#!/usr/bin/env sh
# Container boot: sync schema, seed a fresh demo world, then serve.
set -e
echo "[entrypoint] pushing Prisma schema..."
npx prisma db push --accept-data-loss
echo "[entrypoint] seeding demo data..."
npm run db:seed
echo "[entrypoint] starting Next.js..."
npm run start

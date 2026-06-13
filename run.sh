#!/usr/bin/env bash
# One command to boot HMD Secure CRM locally / on the Frankfurt demo server.
#   db up -> prisma generate -> db push -> seed -> next dev
# Uses docker-compose Postgres when Docker is available; otherwise assumes
# DATABASE_URL points to a reachable Postgres (e.g. a native install).
set -euo pipefail
cd "$(dirname "$0")"

if [ ! -f .env ]; then
  echo "[run] creating .env from .env.example"
  cp .env.example .env
fi

if command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then
  # Host-side `next dev` needs a PUBLISHED db (the main compose keeps Postgres internal).
  echo "[run] starting a published dev Postgres (docker-compose.dev.yml -> localhost:5432)..."
  docker compose -f docker-compose.dev.yml up -d
  echo "[run] waiting for Postgres to be healthy..."
  for i in $(seq 1 30); do
    if docker compose -f docker-compose.dev.yml exec -T db pg_isready -U "${POSTGRES_USER:-hmd}" -d "${POSTGRES_DB:-hmd_crm}" >/dev/null 2>&1; then break; fi
    sleep 2
  done
else
  echo "[run] Docker not found — using DATABASE_URL from .env (expects a reachable Postgres on localhost:5432)."
fi

echo "[run] installing dependencies..."
npm install

echo "[run] generating Prisma client + pushing schema..."
npx prisma generate
npx prisma db push

echo "[run] seeding demo data..."
npm run db:seed

echo "[run] starting Next.js dev server on http://localhost:3000"
npm run dev

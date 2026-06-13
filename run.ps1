# Windows one-command boot for local demo (no Docker required).
# Expects a reachable Postgres in DATABASE_URL (.env). Mirrors run.sh:
#   prisma generate -> db push -> seed -> next dev
$ErrorActionPreference = "Stop"
Set-Location -Path $PSScriptRoot

if (-not (Test-Path ".env")) {
  Write-Host "[run] creating .env from .env.example"
  Copy-Item ".env.example" ".env"
}

Write-Host "[run] installing dependencies..."
npm install

Write-Host "[run] generating Prisma client + pushing schema..."
npx prisma generate
npx prisma db push

Write-Host "[run] seeding demo data..."
npm run db:seed

Write-Host "[run] starting Next.js dev server on http://localhost:3000"
npm run dev

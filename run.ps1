# Windows one-command boot for local demo (no Docker required).
# Expects a reachable Postgres in DATABASE_URL (.env). Mirrors run.sh:
#   prisma generate -> db push -> seed -> next dev
$ErrorActionPreference = "Stop"
Set-Location -Path $PSScriptRoot

if (-not (Test-Path ".env")) {
  Write-Host "[run] creating .env from .env.example"
  Copy-Item ".env.example" ".env"
}

# Host-side `next dev` needs a PUBLISHED db (the main compose keeps Postgres internal).
$docker = Get-Command docker -ErrorAction SilentlyContinue
if ($docker) {
  Write-Host "[run] starting a published dev Postgres (docker-compose.dev.yml -> localhost:5432)..."
  docker compose -f docker-compose.dev.yml up -d
  Write-Host "[run] waiting for Postgres to be healthy..."
  for ($i = 0; $i -lt 30; $i++) {
    docker compose -f docker-compose.dev.yml exec -T db pg_isready -U hmd -d hmd_crm > $null 2>&1
    if ($LASTEXITCODE -eq 0) { break }
    Start-Sleep -Seconds 2
  }
} else {
  Write-Host "[run] Docker not found — using DATABASE_URL from .env (expects a reachable Postgres on localhost:5432)."
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

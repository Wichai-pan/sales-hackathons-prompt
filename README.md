# HMD Secure CRM

HMD Secure's first shared source of truth for **accounts, contacts, deals, cases, service history, offers, approvals, and a 3-year weighted forecast** — with AI acting as an analyst layer on top. Built for the Prompt Sales Hackathon 2026 (HMD challenge).

> **Before:** email, Excel, no pipeline visibility, no service history, no forecast.
> **After:** every role works from one system; AI drafts CRM updates from a pasted email, suggests the next best action, and summarizes the forecast.

## Tech stack

- **Next.js 15** (App Router) + **TypeScript** + **Tailwind CSS** + shadcn-style UI + lucide-react
- **PostgreSQL** + **Prisma ORM**
- **Auth.js / Microsoft Entra ID** in production; **demo role-switch** (server-side cookie) for the hackathon
- **Azure OpenAI** for AI features, with a deterministic fallback so the demo never dead-ends
- **Docker Compose** for local/demo deployment

## Quick start

### Option A — Docker (recommended for the demo / Frankfurt server)

```bash
cp .env.example .env
docker compose up --build
# app on http://localhost:3000 — schema is pushed and seeded automatically on boot
```

### Option B — Local with a native Postgres

```bash
cp .env.example .env          # point DATABASE_URL at your Postgres
# Linux/macOS:
./run.sh
# Windows:
pwsh ./run.ps1
```

`run.sh` / `run.ps1` do: install deps → `prisma generate` → `prisma db push` → seed → `next dev`.

### Manual

```bash
npm install
npx prisma generate
npx prisma db push
npm run db:seed
npm run dev
```

## Demo users (role switch)

| User | Role | Lands on |
|---|---|---|
| Sofia Rep | Sales Rep | Accounts, deals, offers, next best action |
| Timo TAM | Technical Account Manager | Assigned cases + service history |
| Mira Sales Manager | Sales Manager | Pipeline, stalled deals, approvals |
| Fiona Finance | Finance | 3-year forecast, catalog, finance approvals |

Switch at `/role-switch`. Production auth is Microsoft Entra ID SSO (deferred for the demo).

## Seed data

`prisma/seed.ts` builds a believable HMD world: 8 accounts (direct + reseller across DACH/Nordics/Baltics), 18 deals across all stages (incl. stalled >14d and past-close), full 3-year quarterly forecast rows, 12 cases across every status/priority, a product + service catalog (all three invoicing models, one retired item), and offers in every approval state (draft / pending SM / pending Finance / approved / rejected) with matching notifications.

## AI configuration

Set `AZURE_OPENAI_ENDPOINT`, `AZURE_OPENAI_API_KEY`, `AZURE_OPENAI_DEPLOYMENT` to enable AI features (intake, next best action, forecast narrative). Without them, each feature uses a deterministic rules-based fallback.

## Deployment

- **Hackathon demo:** Docker Compose on the team's EU Frankfurt server (data stays in the EU → satisfies HMD data-residency).
- **Azure-portable mapping:** Next.js → Azure App Service / Container Apps · PostgreSQL → Azure Database for PostgreSQL (North/West Europe) · Auth → Entra ID SSO.

## Key business rules (do not regress)

- Reseller deals never use the *Contract negotiation* stage.
- Forecast is time-phased rows, never a single amount; device vs service revenue kept separate.
- Discount > 0 requires justification; offer is locked while pending.
- Sales Manager approves before Finance.
- In-app notifications only.

## Known limitations

Demo role-switch instead of real SSO; AI degrades to deterministic fallback without Azure OpenAI creds; no customer portal / mobile app / live 3rd-party integrations (out of scope per brief).

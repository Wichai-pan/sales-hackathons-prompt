# Parallel Build Plan — Coordination Contract (shared by Owner + V)

> Two builders (Owner, V), each may spawn ≤4 subagents in parallel. This file is the integration
> contract both sides obey. Detailed feature spec = /BUILD-SPEC.md. Narrative/demo = memory/pitch-spec.md.
> Per-stream plans: memory/plan-owner.md (Owner) and memory/plan-v.md (V, droppable into a fresh chat).

## Who owns what (no overlap by design)

- **V = Stream B — Foundation + Data + Back-office + Forecast engine.** Owns: scaffold, Prisma schema,
  seed, Docker, run.sh, shared layout + role-switch + shared helpers; catalog; offer approval + notifications;
  TAM case flow; Manager + Finance dashboards + 3-yr forecast aggregation; reporting.
- **Owner = Stream A — Sales-front + AI + Server/Deploy.** Owns: server config + Frankfurt deploy (no code dep);
  Rep dashboard; Account 360 page; Deal create + 12-month forecast INPUT; Offer builder (front half);
  AI layer (intake + NBA + forecast narrative + preset query chips); demo hardening + deck.
- **PAIR item: 3-yr forecast (H3).** V builds the aggregation ENGINE + Finance/Manager views; Owner builds the
  Rep-side 12-month forecast INPUT + AI forecast narrative. They meet at the `DealForecastPeriod` rows.

## Hard sequencing — the ONE barrier

1. **V does WAVE 0 (foundation) FIRST, solo, ~30–45 min, straight to `main`.** Nothing else starts coding until this lands. Deliverables:
   - Next.js 15 App Router + TS + Tailwind + shadcn/ui scaffolded; `lucide-react`.
   - **Complete** `prisma/schema.prisma` — ALL entities from BUILD-SPEC "Data Model" (User, Account, Contact, Deal, DealForecastPeriod, Product, Service, Case, Note, ActivityEvent, Offer, OfferLineItem, Approval, Notification). Build it complete now so later schema edits are rare.
   - `prisma/seed.ts` matching BUILD-SPEC "Seed Data Requirements" (≥5–8 accounts, 15–25 deals, stalled/overdue, full 3-yr forecast rows, cases, catalog, offers in all approval states, notifications).
   - `docker-compose.yml` (Next app + Postgres), `.env.example`, `run.sh` (one command: db up → migrate/push → seed → dev).
   - **Shared shell**: app layout + nav, demo role-switch (Sofia Rep / Timo TAM / Mira Sales Manager / Fiona Finance) via seeded users + server-side session cookie.
   - **Shared helpers (the integration contract — Owner depends on these):**
     - `lib/session.ts` → `currentUser()`, `currentRole()`
     - `lib/activity.ts` → `createActivityEvent({accountId, actorId, type, summary, linkedRecordType, linkedRecordId})`
     - `lib/notify.ts` → `notify({recipientId, title, body, linkedRecordType, linkedRecordId})`
     - `lib/forecast.ts` → forecast types + `weightedRevenue(stageProb, totalRevenue)` + period helpers
   - Commit to main, then **post in the team channel + append memory/progress.md: "FOUNDATION LANDED — branch off main now."**
2. **Owner runs WAVE 0 in parallel** (server config, Azure OpenAI creds, `docker compose up` smoke test on Frankfurt) — no code dependency, do it while V scaffolds.
3. After foundation lands, **both run WAVE 1 with ≤4 subagents each** against the shared schema/helpers.

## Branch strategy (branches, NOT separate files)

- Foundation → committed **directly to `main`** (it's the base; everything imports it).
- Every Wave-1 slice → its own short branch: `feat/v-<slice>` or `feat/owner-<slice>` (lifetime ≤2h).
- Merge to `main` the moment `./run.sh` passes for that slice (rebase on latest main first). `main` stays demoable.
- Pull often: `./scripts/sync.sh` (rebase-pull + push) after every memory edit and before every merge.
- **Shared files are V-owned**: `prisma/schema.prisma`, `app/layout`, nav, the `lib/*` helpers. If Owner needs a schema field, ping V or open a tiny `feat/owner-schema-<x>` PR for V to fast-review — never edit schema on two branches at once.
- App Router route folders are disjoint per owner → near-zero collision. Keep your slice inside your own route folder + your own server-action file.

## Per-slice loop (MANDATORY — both sides, after every subagent slice)

1. Branch from latest `main`.
2. Build the slice strictly per /BUILD-SPEC.md (data model + business rules).
3. **CHECK & TEST against real requirements + architecture:**
   - Run `./run.sh`; click through the slice.
   - Walk the matching items in BUILD-SPEC "Acceptance Checklist".
   - Verify the business rules that touch your slice, e.g.: reseller deals MUST NOT offer Contract-negotiation; Finance CANNOT approve before SM; discount>0 REQUIRES justification; offer LOCKED while pending; forecast keeps device vs service revenue SEPARATE; notifications are in-app only.
   - Confirm you used the shared helpers (`notify`, `createActivityEvent`, `currentRole`) — do not re-implement them.
4. **If it deviates from BUILD-SPEC or the architecture → fix BEFORE moving to the next slice.** No half-broken merges.
5. Update `memory/team-board.md` (your line → done) and append one line to `memory/progress.md`.
6. Commit (native git identity — never inject -c name/email), merge to `main` when green, `./scripts/sync.sh`.

## Demo-path guard

The 7-step demo path (pitch-spec.md) must run end-to-end on `main` before ANYONE starts P2. Prefer fewer working features over broken placeholders. AI (Phase 8) only after the P0 CRM core works.

## Known blockers / TBD

- LLM provider = Featherless (OpenAI-compatible, team HAS key), NOT Azure (no access). Every AI feature STILL ships a deterministic fallback (BUILD-SPEC), so a model/network failure never dead-ends the demo. AI client = `lib/ai/client.ts` (Owner, pre-drafted in .agent/ai-draft/).
- Real Entra SSO = deferred → demo role-switch is the path; wire SSO only if everything else is done.
- Deploy target = Frankfurt 43.165.2.182 (Owner owns; use the `frankfurt` skill). EU region satisfies data residency.

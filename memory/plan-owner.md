# Stream A — Owner's Plan (Sales-front + AI + Server/Deploy)

> You already have the repo. Read order: CLAUDE.md → memory/HACKATHON.md → BUILD-SPEC.md →
> memory/pitch-spec.md → memory/parallel-plan.md. Obey the per-slice loop + branch strategy there.
> You own server config + Frankfurt deploy. V owns foundation/schema — wait for the foundation
> push before coding pages; meanwhile do WAVE 0 server prep (no code dependency).

## Your scope (Stream A)

You build sales-front pages + the AI layer + deploy. You DEPEND on V's foundation (schema, role-switch,
shared `lib/*` helpers `notify` / `createActivityEvent` / `currentRole`). Stay inside your own route
folders + server-action files; never edit `prisma/schema.prisma` or `lib/*` on your branch — if you need a
schema field, ping V.

### WAVE 0 — Server + deploy prep (do NOW, parallel with V's foundation, no code dep)

- Bring up the Frankfurt server (use the `frankfurt` skill, 43.165.2.182). Install Docker + Compose.
- Prepare `.env` (DATABASE_URL for the Postgres in compose, AUTH_SECRET, APP_URL, DEMO_MODE=true).
- LLM = Featherless (team has key), NOT Azure. Put FEATHERLESS_API_KEY + FEATHERLESS_MODEL (Qwen/Qwen2.5-7B-Instruct) + FEATHERLESS_BASE_URL in .env. AI layer pre-drafted in .agent/ai-draft/ (client/intake/nba + INTEGRATION.md).
- Once V pushes foundation: `git clone` / pull, `docker compose up` smoke test on Frankfurt, confirm seed loads, get a public demo URL.

### WAVE 1 — after foundation lands, spawn up to 4 subagents, each branch `feat/owner-<slice>`

- **SA-O1 — Rep dashboard + Account 360:** Rep dashboard (my accounts, open deals by stage, pending approvals, recent activity, at-risk deals). Account detail page = the most important page: summary, contacts, open deals, active cases, offers, activity timeline, notes, + an AI Next Best Action panel slot. Wire "create deal / create case / generate offer / add note" entry points.
- **SA-O2 — Deal create/edit + forecast input:** create/edit deal; channel direct/reseller; **stage dropdown constrained by channel** (reseller hides Contract negotiation); expected close date; **12-month forecast input** that writes `DealForecastPeriod` rows (use V's forecast helpers); on save → `createActivityEvent` + appears in dashboards.
- **SA-O3 — Offer builder (front half):** select deal → add products + services from catalog → quantity → discount % → required justification when discount>0 → generate immutable offer snapshot (OfferLineItem with name/price snapshots) → submit. On submit with discount: set status, lock, and `notify()` the Sales Manager. (V's SA-V2 owns the approval queues that take it from here.)
- **SA-O4 — AI layer (the 3 HERO AI beats + chips):**
  - **AI-assisted intake (HERO, demo opener):** paste email/notes → server-only route extracts a DRAFT (contact/deal/case/task) → preview with per-item checkboxes → "Apply selected" writes via the SAME server actions as manual create. NOT auto-entry. NO Microsoft Graph. Deterministic rules fallback when no API key.
  - **AI Next Best Action (HERO):** account page panel → reads timeline/deals/cases/offer-status → 1 recommended action + 2–3 bullet reasons + optional draft email. Must NOT mutate records. Rules fallback per BUILD-SPEC.
  - **AI forecast narrative** (optional, low-effort) on Finance/Manager view.
  - **3 preset query chips:** "At-risk DACH enterprise deals" / "Offers pending Finance" / "Cases blocking customer tests" — each applies a predefined filter. NO open-ended NL query.

### WAVE 2 — Phase 9 demo hardening + deck (you present)

Fix broken/empty/loading states, make the demo path obvious, README + demo script, then hand to hackathon-demo-builder / hackathon-deck-builder (start no later than T-6h ≈ Sun 03:00 UTC).

## Per-slice loop (same as V — non-negotiable)

Branch off main → build per BUILD-SPEC → **run `./run.sh`, walk the matching acceptance-checklist items, verify your business rules, confirm you reused V's helpers** → fix any deviation BEFORE next slice → update team-board.md + progress.md → commit (native identity) → merge to main when green → `./scripts/sync.sh`.

## PAIR with V on the 3-yr forecast (H3)

You own the Rep-side 12-month INPUT + AI forecast narrative; V owns the aggregation engine + Finance/Manager views. Meet at the `DealForecastPeriod` rows + V's `lib/forecast.ts` helpers. Sync early so the row shape matches.

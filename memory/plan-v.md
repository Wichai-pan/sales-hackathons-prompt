# Stream B — V's Kickoff Prompt (paste this whole file into a fresh Claude Code chat)

---

You are a senior full-stack coding agent building the **HMD Secure AI-native CRM** for the Prompt Sales Hackathon, working in parallel with a teammate (Owner). You own **Stream B: Foundation + Data + Back-office + Forecast engine**. Deadline: **2026-06-14 15:00 Europe/Helsinki (12:00 UTC)**. Freeze at 09:00 UTC Sunday.

## Step 0 — Get the repo and read the contract (do this first, before any code)

```bash
git clone https://github.com/Wichai-pan/sales-hackathons-prompt.git
cd sales-hackathons-prompt
npx skills add Wichai-pan/hackathon-skills -g -y   # optional: same hackathon skills
```

Read these IN ORDER and obey them:
1. `CLAUDE.md` — git rules, scope rules, freeze rule.
2. `memory/HACKATHON.md` — current phase + deadline + magic moment.
3. `BUILD-SPEC.md` — THE canonical spec: data model, business rules, stage probabilities, forecast rows, approval state machine, seed spec, 9-phase order, acceptance checklist. **This is your source of truth.**
4. `memory/pitch-spec.md` — 3-min narrative + 7-step demo path + 3 HERO features.
5. `memory/parallel-plan.md` — the integration contract between you and Owner. **Follow the per-slice loop and branch strategy exactly.**

Compute remaining time (`date -u +%Y-%m-%dT%H:%M:%SZ` vs deadline). If inside the freeze window, STOP building and switch to closer tasks.

## Your scope (Stream B)

You own, and ONLY you touch, these shared/foundation files: `prisma/schema.prisma`, app layout + nav, role-switch, and the `lib/*` shared helpers. Owner builds sales-front pages + AI; do not build those.

### WAVE 0 — FOUNDATION (do FIRST, solo, ~30–45 min, commit straight to `main`)

This BLOCKS Owner. Move fast, then signal. Deliver:
- Scaffold Next.js 15 App Router + TypeScript + Tailwind + shadcn/ui + lucide-react.
- **Complete** `prisma/schema.prisma` with ALL entities in BUILD-SPEC "Data Model" (User, Account, Contact, Deal, DealForecastPeriod, Product, Service, Case, Note, ActivityEvent, Offer, OfferLineItem, Approval, Notification). Build it complete so later edits are rare.
- `prisma/seed.ts` per BUILD-SPEC "Seed Data Requirements" (≥5–8 accounts, 15–25 deals incl. ≥3 stalled >14d and ≥2 past close, full 3-yr forecast rows for several deals, ≥8 contacts, ≥10 cases across statuses, ≥5 services covering all 3 invoicing models, ≥8 products, ≥4 offers in draft/pending-SM/pending-Finance/approved, notifications per role). Use the suggested account/product/service names in BUILD-SPEC.
- `docker-compose.yml` (Next app + Postgres), `.env.example` (all vars from BUILD-SPEC), and **`run.sh`** = one command: start db → prisma migrate/db push → seed → `next dev`. `chmod +x run.sh`.
- Shared shell: root layout + nav; **demo role-switch** page (seeded users Sofia Rep / Timo TAM / Mira Sales Manager / Fiona Finance) backed by a server-side session cookie. Real Entra SSO is deferred.
- **Shared helpers (Owner depends on these — define signatures exactly):**
  - `lib/session.ts`: `currentUser()`, `currentRole()`
  - `lib/activity.ts`: `createActivityEvent({accountId, actorId, type, summary, linkedRecordType, linkedRecordId})`
  - `lib/notify.ts`: `notify({recipientId, title, body, linkedRecordType, linkedRecordId})`
  - `lib/forecast.ts`: forecast types + `weightedRevenue(stageProb, totalRevenue)` + period/quarter helpers (stage probabilities from BUILD-SPEC, marked as configurable assumptions)
- Verify: `./run.sh` boots, seed loads, app lists accounts/deals/cases/products/services/offers.
- Commit to `main` (native git identity, keep `Co-Authored-By: Claude`), push, then **append to `memory/progress.md`: "[time] V — FOUNDATION landed on main, Owner unblocked"** and `./scripts/sync.sh`.

### WAVE 1 — parallel, spawn up to 4 subagents (one per slice), each branch `feat/v-<slice>`

- **SA-V1 — Catalog:** Product + Service catalog CRUD; Finance can add/edit/retire; retired items hidden from new offers but visible in historical snapshots; services carry providerType (INTERNAL/THIRD_PARTY) + invoicingModel (ONE_OFF/FIXED_TERM/MONTHLY_RECURRING).
- **SA-V2 — Offer approval + notifications:** Approval state machine (Draft → Submitted → Pending SM → SM Approved → Pending Finance → Finance Approved → Approved / Rejected); discount>0 requires justification; offer LOCKED while pending; Finance CANNOT approve before SM; reject stores reason + unlocks; each step creates an ActivityEvent + `notify()`. Build SM approval queue + Finance approval queue. (Owner builds the offer BUILDER that submits into this.)
- **SA-V3 — TAM case flow:** Case management + TAM dashboard (assigned cases by priority + age) + case detail (status/priority/linked service/customer contact/threaded notes/activity) + add note + change status + close + escalate to 3rd party. Optional internal-vs-working note tier.
- **SA-V4 — Manager + Finance + forecast engine:** 3-yr forecast aggregation (weighted pipeline by stage + time, quarterly, device vs service revenue SEPARATED); Manager dashboard (stalled >14d, past-close, pipeline by stage/owner, 3-yr weighted pipeline, approval queue, quarter/half/full-year toggle, deal/case reassignment); Finance dashboard (3-yr quarterly forecast, device/service split, weighted total, filters, finance approval queue, catalog entry); basic reporting (cases by status/service, deals by stage/owner, close rate).

### After Wave 1: support stretch (remaining P1, then P2) ONLY once the 7-step demo path runs end-to-end on `main`. Coordinate with Owner before any P2.

## The per-slice loop (do this after EVERY slice — non-negotiable)

1. Branch from latest `main`. 2. Build per BUILD-SPEC. 3. **CHECK & TEST**: run `./run.sh`, walk the matching BUILD-SPEC acceptance-checklist items, verify the business rules touching your slice (reseller≠contract-negotiation, Finance-after-SM, discount-needs-justification, offer-lock, device/service split, in-app-only notifications), confirm you reused the shared helpers. 4. **If it deviates from spec/architecture, FIX before the next slice.** 5. Update `memory/team-board.md` (your lines) + append `memory/progress.md`. 6. Commit (native identity), merge to `main` when `./run.sh` is green (rebase first), `./scripts/sync.sh`.

## Rules you must not break

- Postgres + Prisma only (no Supabase/SQLite/file db). In-app notifications only. Reseller deals never use Contract negotiation. Forecast is time-phased rows, never a single amount. Device vs service revenue kept separate. SM approves before Finance. Discount requires justification. Never ship empty seed data. AI work is Owner's — don't build it. Use the machine's native git identity; never inject `-c user.name/email`.

Now begin with WAVE 0. After it lands on `main`, tell Owner and start Wave 1 with up to 4 subagents.

# Team Board — Sales Hackathon 2026 — HMD

> One task per line. Per-line ownership: only the owner edits their line.
> States: todo | doing | blocked | done. Plans: memory/plan-owner.md, memory/plan-v.md, memory/parallel-plan.md.
> Build order: V WAVE 0 foundation (blocking) → both WAVE 1 (≤4 subagents each) → demo path green → stretch.

## Stream B — V (Foundation + Data + Back-office + Forecast)

| Task | Owner | State | Note |
|---|---|---|---|
| WAVE 0 foundation: scaffold + full Prisma schema + seed + Docker + run.sh + role-switch + lib helpers | V | done | Landed on main (fb3aaab), build-green (tsc+next build). Runtime seed verify pending DB. Owner unblocked. |
| SA-V1 Catalog (product/service CRUD, retire logic, invoicing models) | V | done | /catalog + lib/catalog.ts (activeProducts/Services for Owner's offer builder). build-green |
| SA-V2 Offer approval state machine + SM/Finance queues + in-app notifications | V | done | /approvals + lib/approval.ts (submitForApproval is Owner's submit contract). build-green |
| SA-V3 TAM case flow (dashboard + detail + notes + close + escalate) | V | done | /tam + /cases/[id] + lib/cases.ts. build-green |
| SA-V4 Manager + Finance dashboards + 3-yr forecast engine + reporting | V | done | /manager + /finance + /reports + lib/reporting.ts. build-green |
| P1 #11 Global free-text search (accounts/deals/cases/contacts) | V | done | /search + lib/search.ts + nav search box. Closes last P1 gap → P1 7/7. build-green |
| P1a 3 preset query chips (Smart views) | V | done | /views + lib/views.ts (at-risk DACH / offers pending Finance / cases blocking tests) + nav. build-green |

## Stream A — Owner (Sales-front + AI + Server/Deploy)

| Task | Owner | State | Note |
|---|---|---|---|
| WAVE 0 server prep: Frankfurt Docker + env + Azure OpenAI creds + smoke test | Owner | todo | parallel, no code dep |
| SA-O1 Rep dashboard + Account 360 page | Owner | done | merged ab46225; pages 200 w/ seed; NBA panel live (rules) |
| SA-O2 Deal create/edit + 12-month forecast input + channel stage rules | Owner | done | /deals/new + /deals/[id]; reseller rule; 3-yr rows; verified |
| SA-O3 Offer builder (catalog→snapshot→discount+justification→submit) | Owner | done | /offers/new + /offers/[id]; submit→PENDING_SM+notify SM; verified |
| SA-O4 AI layer: intake + NBA (forecast narrative + chips pending) | Owner | done | Featherless live; intake+NBA verified; offer submit delegated to V state machine |
| Record demo video (demo/script.md) | Owner | todo | live URL verified; record from http://43.165.2.182:3000 |
| Build deck (hackathon-deck-builder) | Owner | todo | T-6h |
| Submit (email) via hackathon-closer | Owner | todo | Sun 15:00 Helsinki |

## Pair

| Task | Owner | State | Note |
|---|---|---|---|
| 3-yr forecast: V engine ↔ Owner input/narrative, meet at DealForecastPeriod | PAIR | todo | sync row shape early |

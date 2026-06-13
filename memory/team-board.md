# Team Board — Sales Hackathon 2026 — HMD

> One task per line. Per-line ownership: only the owner edits their line.
> States: todo | doing | blocked | done. Plans: memory/plan-owner.md, memory/plan-v.md, memory/parallel-plan.md.
> Build order: V WAVE 0 foundation (blocking) → both WAVE 1 (≤4 subagents each) → demo path green → stretch.

## Stream B — V (Foundation + Data + Back-office + Forecast)

| Task | Owner | State | Note |
|---|---|---|---|
| WAVE 0 foundation: scaffold + full Prisma schema + seed + Docker + run.sh + role-switch + lib helpers | V | done | Landed on main (fb3aaab), build-green (tsc+next build). Runtime seed verify pending DB. Owner unblocked. |
| SA-V1 Catalog (product/service CRUD, retire logic, invoicing models) | V | todo | feat/v-catalog |
| SA-V2 Offer approval state machine + SM/Finance queues + in-app notifications | V | todo | feat/v-approval |
| SA-V3 TAM case flow (dashboard + detail + notes + close + escalate) | V | todo | feat/v-cases |
| SA-V4 Manager + Finance dashboards + 3-yr forecast engine + reporting | V | todo | feat/v-forecast |

## Stream A — Owner (Sales-front + AI + Server/Deploy)

| Task | Owner | State | Note |
|---|---|---|---|
| WAVE 0 server prep: Frankfurt Docker + env + Azure OpenAI creds + smoke test | Owner | todo | parallel, no code dep |
| SA-O1 Rep dashboard + Account 360 page | Owner | done | merged ab46225; pages 200 w/ seed; NBA panel live (rules) |
| SA-O2 Deal create/edit + 12-month forecast input + channel stage rules | Owner | done | /deals/new + /deals/[id]; reseller rule; 3-yr rows; verified |
| SA-O3 Offer builder (catalog→snapshot→discount+justification→submit) | Owner | todo | feat/owner-offer |
| SA-O4 AI layer: intake + NBA + forecast narrative + 3 query chips | Owner | todo | feat/owner-ai |
| WAVE 2 demo hardening + README + deck | Owner | todo | start ≤ T-6h |

## Pair

| Task | Owner | State | Note |
|---|---|---|---|
| 3-yr forecast: V engine ↔ Owner input/narrative, meet at DealForecastPeriod | PAIR | todo | sync row shape early |

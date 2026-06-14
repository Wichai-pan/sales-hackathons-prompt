<!-- PROJECT LOGIC SPEC — code-accurate, stack-agnostic. Generated from the real Next.js codebase
     to migrate ALL logic/features into the Lovable (TanStack Start) UI without loss.
     The Next.js app under /app, /lib, /prisma remains the REFERENCE implementation. -->

I have a complete and concrete picture of both the source app and the TanStack Start target. Here is the migration spec preamble.

---

# HMD Secure CRM — Migration to TanStack Start (Lovable UI)

## 1. Project Overview

HMD Secure's AI-native CRM is a multi-role (Rep / TAM / Sales Manager / Finance) sales-and-service system: one shared source of truth for accounts, contacts, deals, cases, offers, a 3-year time-phased weighted forecast, and an in-app offer-approval chain, with AI acting as an analyst layer on top (assisted intake, next best action, forecast narrative, case summary, and the "Aino" floating assistant). The current implementation is **Next.js 15 App Router** — React Server Components with `"use server"` server actions, Prisma against a single Postgres database, a server-side demo role-switch cookie, in-app DB-backed notifications, and server-only Featherless (OpenAI-compatible) AI calls with deterministic fallbacks so every AI feature works with no API key. We are porting the **working backend and feature behavior** onto a **Lovable-built TanStack Start UI** (Vite full-stack React 19 + `@tanstack/react-router` file routes + `@tanstack/react-start` server functions + `@tanstack/react-query`, Nitro server entry at `src/server.ts`). The Lovable canvas (`NextGen CRM Canvas.zip`) ships the full visual system, shadcn/Radix primitives, `recharts`, the AppShell nav, an `AiBubble` (the Aino placeholder), and **mock data only** (`src/lib/seed.ts` is hardcoded objects — no DB). The migration's job: replace that mock layer with the real data model, business logic, AI, and approval workflow **without losing the 8-step demo path or any P0/P1/P2 + audit fix that already ships.**

The single biggest mental shift: **App Router fuses data-fetch and render in the same RSC; TanStack Start separates them** — data comes from route `loader`s (and `createServerFn`), UI is always a client component. Server actions (`<form action={fn}>`) do not exist; mutations become `createServerFn({ method: "POST" })` called from event handlers, then `router.invalidate()` / query invalidation to refresh.

---

## 2. Tech-Stack Migration Mapping

| Current building block (Next.js 15) | TanStack Start equivalent | Gotchas / notes |
|---|---|---|
| **Server action** `"use server"` fn taking `FormData` (e.g. `createDeal`, `createOffer`, `applyIntake`, `approveAsSM`) invoked via `<form action={fn}>` | `createServerFn({ method: "POST" }).inputValidator(zodSchema).handler(async ({ data }) => …)` in `src/lib/api/*.functions.ts`; called from an `onSubmit`/`onClick` handler. Pattern shown in `src/lib/api/example.functions.ts`. | **No automatic `FormData`.** Lovable forms use `react-hook-form` + zod — pass a typed object, not `FormData`. Rewrite each action's `formData.get("x")` to `data.x`. **No implicit redirect or revalidate** — handle navigation/refresh on the client (see redirect/revalidatePath rows). The `.handler` body is server-only and tree-shaken from the client; keep Prisma/Featherless imports *inside* the handler or in `.server.ts` files. |
| **Prisma client query** in an RSC body (`await prisma.deal.findMany(...)` then render) | Move the query into a route **`loader`** (`createFileRoute("/rep")({ loader: async () => … })`) or a `createServerFn({ method: "GET" })` consumed via `@tanstack/react-query`. Read with `Route.useLoaderData()`. | Loaders run on the server during SSR and on client navigations; **anything Prisma must be reached only through a server fn or loader**, never imported into a component module that ships to the browser. Use `useSuspenseQuery` + `queryClient` (already wired in `router.tsx`) for the AI panels that currently use React `<Suspense>`. |
| **Prisma schema** `prisma/schema.prisma` + `prisma/seed.ts` | **Keep Prisma + Postgres unchanged.** Copy `prisma/` verbatim into the Lovable repo; add `@prisma/client` + `prisma` to its `package.json`; add a `lib/db.ts` singleton. **Do not adopt Drizzle** — the schema, enums, the time-phased `DealForecastPeriod`, and the offer state machine are load-bearing and already audited. | Lovable defaults its Nitro build to **Cloudflare Workers** (`vite.config.ts`). Prisma needs a Node runtime + a real Postgres TCP connection — **switch the Nitro/deploy target to Node** (Frankfurt Docker, same as today) or it won't connect. The Lovable `src/lib/seed.ts` is *display mock data* and must be **deleted/replaced** by the real `prisma/seed.ts` (do not confuse the two). |
| **Route page** `app/rep/page.tsx` (RSC, default export) | **File route** `src/routes/rep.tsx` via `createFileRoute("/rep")({ loader, component })`; routeTree is generated (`routeTree.gen.ts`). Lovable already has `rep`, `tam`, `manager`, `finance`, `cases`, `pipeline`, `forecast`, `contacts`, `offers.$id`, `accounts.$id`, `assistant`, `automations`, `login`, `index`. | Dynamic segments use `$` not `[]`: `app/accounts/[id]/page.tsx` → `src/routes/accounts.$id.tsx` (already present). Params via `Route.useParams()`. **The Lovable routes render `seed.ts` mock data — rewire each to its loader.** Missing routes to add: `/role-switch`, `/notifications`, `/catalog`, `/approvals`, `/deals/new`, `/deals/$id`, `/cases/new`, `/cases/$id`, `/offers/new`, `/search`, `/views`, `/reports`. |
| **In-app notification** (`lib/notify.ts` → `prisma.notification.create`; bell `<Link>` to `/notifications`; `openNotification`/`markAllReadAction` actions; per-request `unreadCount`) | `lib/notify.ts` stays (pure Prisma — copy as-is). Expose `listNotifications`/`unreadCount`/`markRead`/`markAllRead` through `createServerFn`s; bell count via a `useQuery` (poll/`refetchOnWindowFocus`); mark-read/open become POST server fns + `router.invalidate()`. | No realtime needed (brief allows polling/refresh). The current per-request RSC `unreadCount()` becomes a client query — set a sane `staleTime`. Keep "click notification → jump to linked record" working (`linkedRecordType` + `linkedRecordId`). |
| **Featherless server-only AI call** (`lib/ai/client.ts` `import "server-only"`; `hasAI()`, `aiJSON`, `aiText`; consumers `nba`, `intake`, `assistant`, `case-summary`, `forecast-narrative`; exposed via `app/api/ai/*/route.ts`) | Keep all of `lib/ai/*` (logic is framework-agnostic). Replace `import "server-only"` with the `.server.ts` suffix convention (`lib/ai/client.server.ts`) **or** only call it from inside `createServerFn().handler`. The two `app/api/ai/{intake,assistant}/route.ts` Route Handlers become **server functions** (`extractIntake`, `askAino`, `assistantGreeting`) or TanStack **API routes** (`src/routes/api/*`). | **Read `process.env` inside the handler, never at module scope** (`config.server.ts` says so explicitly — on Workers env binds per-request; even on Node this matches the current `cfg()` runtime-read pattern in `client.ts`). Keep the **deterministic fallback path** — `hasAI()===false` must still return rules-based output so the demo never dead-ends. `aiJSON` already handles Featherless reasoning-model quirks (`reasoning` vs `content`) — preserve verbatim. |
| **Demo role-switch cookie** (`lib/session.ts`: `cookies()` from `next/headers`, `SESSION_COOKIE="hmd_demo_user"`, `currentUser()`/`currentRole()`/`setDemoUser()`, REP fallback, `dashboardPathForRole`) | Read cookies via TanStack's request context inside a server fn: `getWebRequest()`/`getHeaders()` from `@tanstack/react-start/server` to read; set via a `Set-Cookie` response header from a `setDemoUser` server fn (or `vinxi`/h3 cookie helpers). Wrap `currentUser()` so every other server fn calls it. | `next/headers` `cookies()` does not exist — this is the **single most-touched cross-cutting change**: every server action/loader that calls `currentUser()` must thread the request. Centralize it. Lovable has a `/login` route and an avatar/role switcher in `AppShell` — wire those to `setDemoUser`. Keep the REP fallback so a cold load still lands somewhere. **Dashboard role guards** (Rep/TAM bounced off `/manager`,`/finance` — audit minor fix) move into `beforeLoad` on those routes. |
| **`redirect()`** from `next/navigation` (server-side, e.g. `createDeal` → `/deals/[id]`) | Client-side `router.navigate({ to: "/deals/$id", params: { id } })` after the server fn resolves, **or** throw `redirect({ to })` from within a loader/`beforeLoad`. | Server actions can't redirect transparently anymore — the *caller* navigates. Return the new record's id from the server fn so the client knows where to go. `redirect("/role-switch")` guards become `beforeLoad` throws to `/login`. |
| **`revalidatePath(path)`** from `next/cache` (after mutations) | `router.invalidate()` (revalidate all active loaders) and/or `queryClient.invalidateQueries({ queryKey })` after the mutating server fn resolves. | There is **no path-scoped cache to bust** — TanStack re-runs loaders for mounted routes. Call invalidate in the mutation's `.then`/`onSuccess`. For optimistic UX use react-query mutations. Forecast re-weighting in `updateDealStage` etc. is pure DB work — unaffected; just invalidate the manager/finance/account queries after. |

**Cross-cutting note — the AI "wow" stays server-only.** Aino (`AiBubble.tsx` today is a static mock) must be wired to `askAino`/`assistantGreeting`; intake's **preview→Apply gate** (`extractIntake` returns a draft; `applyIntake` writes via the same code paths as manual create) must survive — the draft must never auto-mutate records.

---

## 3. Migration Order (demo path end-to-end first)

Port in this order; the 8-step demo line must walk on the new stack before any extra polish.

1. **Foundation / data layer.** Copy `prisma/` (schema + seed) into the Lovable repo; add Prisma + `lib/db.ts` singleton; **switch Nitro target from Cloudflare to Node**; wire `config.server.ts` to read `DATABASE_URL`/`FEATHERLESS_*`. Delete-or-quarantine `src/lib/seed.ts` mock. Verify `prisma db push` + seed against the Frankfurt Postgres. *Gate: real seeded accounts/deals/cases query from a server fn.*
2. **Session + role switch + AppShell.** Port `lib/session.ts` to TanStack cookie access; wire `/login` + AppShell avatar switcher to `setDemoUser`; per-role landing via `dashboardPathForRole`; `beforeLoad` role guards on `/manager` + `/finance`. *Gate: switch user → land on correct dashboard with real data.*
3. **Account 360 + read dashboards.** Rewire `accounts.$id`, `rep`, `tam`, `manager`, `finance`, `cases`, `pipeline`, `forecast`, `contacts` loaders from mock to Prisma (`lib/reporting.ts`, `lib/cases.ts`, `lib/targets.ts`, `lib/forecast.ts`). *Gate: Rep opens account, sees open deals + active cases together (the official success criterion).*
4. **Deal create + 12-month forecast.** Port `createDeal`/`updateDealStage`/`addDealNote` to server fns; reseller stage rule + service-invoicing-model revenue curves (audit fix C2) + Y2/Y3 projection intact; `/deals/new`, `/deals/$id`. *Gate: direct deal with Contract-negotiation stage + 12-mo forecast saves and appears in manager pipeline; reseller excludes Contract negotiation.*
5. **Offer builder + full approval chain.** Port `createOffer`, `lib/approval.ts` (`submitForApproval`/`smApprove`/`smReject`/`financeApprove`/`financeReject`), `/offers/new`, `/approvals`; discount→justification gate; lock-on-pending; SM-before-Finance ordering; `notify()` at each step. *Gate: discounted offer Rep→SM→Finance in order, Finance can't approve first, Rep gets final notification.*
6. **Notifications.** Port `lib/notify.ts` consumers; bell count query + `/notifications` inbox + click-through + mark-read. *Gate: each approval step lands a clickable notification.*
7. **TAM case flow.** Port `createCase` (audit fix C1 — create case from account), `addCaseNote`, `changeCaseStatus`/`closeCase`/`escalateCase`, `reassignCase` (M3), seeded case ActivityEvents (M5); `/cases/new`, `/cases/$id`. *Gate: TAM reads non-empty history, adds note, closes case.*
8. **AI layer (HEROs + Aino).** Port `lib/ai/*` behind server fns; AI-assisted intake preview→Apply on Rep dashboard; Next Best Action panel on account page; wire `AiBubble` → `askAino`/`assistantGreeting`; forecast narrative + case-summary. Verify deterministic fallbacks with no key. *Gate: every AI surface returns useful output with `FEATHERLESS_API_KEY` unset.*
9. **Catalog + P1/P2 + charts/funnel + polish.** Port `lib/catalog.ts` actions (`/catalog`), search/filters (`/search`, `/views` preset chips), reporting (`/reports`), CSV export (`api/export/*`), SLA badges, forecast chart + 7-stage funnel; loading/empty/error states. README + assumptions.

---

## 4. Completeness Checklist (nothing may be dropped)

### P0 — Must have (all 10)
- [ ] **Account + contact management** — Account 360 page (deals, cases, offers, contacts, timeline, notes together) — *the central page*.
- [ ] **Case management** — status/priority/linked service/assigned TAM/customer contact/threaded notes/timestamps; add note + close.
- [ ] **Deal pipeline + stages** — 7 stages; **reseller deals exclude CONTRACT_NEGOTIATION**; direct/reseller behave differently; owner, expected close, stage probability.
- [ ] **Offer creation + storage** — built from product + service catalogs; immutable `OfferLineItem` snapshots; stored on account.
- [ ] **Offer approval workflow** — discount→required justification; lock while pending; **SM before Finance**; both approvals in history; both trigger notifications.
- [ ] **Product + pricing catalog** — Finance add/update/retire (SKU/name/category/unit price/currency/status + GM%).
- [ ] **Service catalog** — internal vs third-party; **3 invoicing models that drive different revenue curves** (audit fix C2); cases link to services.
- [ ] **Role-based access + default view** — REP/TAM/SALES_MANAGER/FINANCE land on distinct dashboards; UI + data respect roles; **route guards**.
- [ ] **Personal dashboard per role** — Rep / TAM / Manager / Finance each distinct.
- [ ] **Case + deal notes** — timestamped, author + role, visible to those with access; **internal-vs-working note tier**.

### P1 — Should have (all 7)
- [ ] **Search + filters** across accounts/cases/deals (`/search`).
- [ ] **3-year weighted forecast** by stage + time (HERO #3) — `DealForecastPeriod`, device vs service kept separate, weighted by stage probability.
- [ ] **Case activity log** — every change timestamped + attributed (`ActivityEvent`).
- [ ] **In-app notifications** — unread/read, click-to-jump.
- [ ] **Deal risk indicator** — flags stale 14+ days or past expected close (manager dashboard).
- [ ] **AI Next Best Action** (HERO #2) — account page, with deterministic rules fallback.
- [ ] **Basic reporting** — cases by status/service, deals by stage/owner (`/reports`); **preset query chips** (`/views`); **deal/case reassignment** (M3); **pipeline time-granularity switch** (Q/H/Y); **note visibility tiers**.

### P2 — Nice to have (the 4 that ship today)
- [ ] **SLA / due-date tracking** — `Case.dueDate`, overdue/approaching badges.
- [ ] **CSV export for Finance** — forecast + cases (`api/export/forecast`, `api/export/cases`).
- [ ] **AI case summary** for cases with 5+ notes (`caseSummary`, `MIN_NOTES_FOR_SUMMARY=5`).
- [ ] **AI forecast narrative** on Finance + Manager (`forecastNarrative`).

### The 6 audit fixes (must survive)
- [ ] **C1** — Rep can create a service case from inside an account (`createCase` + `/cases/new` + Account 360 button).
- [ ] **C2** — service invoicing models drive different revenue curves (ONE_OFF=point / FIXED_TERM=spread / MONTHLY_RECURRING=device trajectory) — not flattened.
- [ ] **M3** — case→TAM reassignment (`reassignCase`) **and** deal→rep reassignment (`reassignDeal`), each with activity event + notify.
- [ ] **M4** — forecast committed / at-risk / gap-to-target (`lib/targets.ts` + Manager card).
- [ ] **M5** — seeded case ActivityEvents (CASE_OPENED / NOTE_ADDED / CLOSED) so TAM "read history" lands on a non-empty timeline.
- [ ] **M6** — monthly-recurring service revenue scales with device trajectory in the live `createDeal` path.

### Demo-upgrade features (Aino + chart + funnel)
- [ ] **Aino floating assistant** — wire `AiBubble` to `askAino` (conversational query over live role-aware data) + `assistantGreeting` (greets by name, proactive data-driven work chips, "Plan my day"); Featherless + keyword fallback; per-role context (REP account names/stage mix/at-risk; SM team rep names/stalled/forecast).
- [ ] **3-year forecast chart** — device/service stacked + stage-weighted line on Finance + Manager (use `recharts` from the Lovable canvas, replacing the dependency-free SVG).
- [ ] **7-stage pipeline funnel** — Manager (width ∝ deal count, flags Contract-negotiation as direct-only).

### Foundational / cross-cutting (don't lose in translation)
- [ ] Demo role-switch + 4 seeded users (Sofia/Timo/Mira/Fiona); per-role landing.
- [ ] AI-assisted intake **preview→Apply gate** (HERO #1) — draft never auto-mutates.
- [ ] **Deterministic AI fallbacks** verified with no `FEATHERLESS_API_KEY`.
- [ ] Realistic seed data (the real `prisma/seed.ts`, not Lovable's mock `src/lib/seed.ts`) — 6+ accounts, 15-25 deals incl. 3+ stalled & 2+ overdue, full 3-yr forecast rows, 10+ cases, 5+ services (all invoicing models), 8+ products, 4 offers across approval states, notifications per role.
- [ ] **Gross-margin (GM)** layer — `Product.gmPercent`/`Service.gmPercent`, Finance net-sales/GM/GM% + HMD funnel vocabulary (Opportunity→Pipeline→Committed→Confirmed).
- [ ] Node deploy target on Frankfurt (Docker) — **not** Lovable's default Cloudflare Workers (Prisma/Postgres requires Node runtime).

---

### Key file references (current app, absolute paths)
- Data model: `/Users/huataipan/Wichai/Hackathons/sales-hackathons-prompt/prisma/schema.prisma` (+ `prisma/seed.ts`)
- Session/cookie: `/Users/huataipan/Wichai/Hackathons/sales-hackathons-prompt/lib/session.ts`
- AI client (server-only Featherless): `/Users/huataipan/Wichai/Hackathons/sales-hackathons-prompt/lib/ai/client.ts` (+ `lib/ai/{nba,intake,assistant,case-summary,forecast-narrative}.ts`)
- Notifications: `/Users/huataipan/Wichai/Hackathons/sales-hackathons-prompt/lib/notify.ts`
- Approval state machine: `/Users/huataipan/Wichai/Hackathons/sales-hackathons-prompt/lib/approval.ts`
- Forecast logic: `/Users/huataipan/Wichai/Hackathons/sales-hackathons-prompt/lib/forecast.ts`, `lib/targets.ts`
- Server actions to port: `app/{deals,offers,cases,catalog,approvals,manager,notifications}/actions.ts`, `app/accounts/[id]/actions.ts`, `app/rep/intake-actions.ts`
- API routes to port: `app/api/ai/{intake,assistant}/route.ts`, `app/api/export/{forecast,cases}/route.ts`
- Canonical spec: `/Users/huataipan/Wichai/Hackathons/sales-hackathons-prompt/BUILD-SPEC.md`

### Target (Lovable TanStack Start canvas)
- Server-fn pattern: `src/lib/api/example.functions.ts` · server env: `src/lib/config.server.ts` · router/query: `src/router.tsx` · server entry: `src/server.ts` / `src/start.ts`
- Routes present: `src/routes/{rep,tam,manager,finance,cases,pipeline,forecast,contacts,assistant,automations,login,index}.tsx`, `accounts.$id.tsx`, `offers.$id.tsx` — all currently render `src/lib/seed.ts` **mock** data (replace).
- Aino placeholder: `src/components/app-shell/AiBubble.tsx` (static mock — wire to real `askAino`/`assistantGreeting`).
- **`src/lib/seed.ts` is display mock data — delete/replace, do not confuse with `prisma/seed.ts`.**

**Two highest-risk migration items:** (1) the **role-switch cookie** — `next/headers cookies()` has no direct equivalent; every `currentUser()` caller must thread the TanStack request, so centralize it first; (2) the **Nitro/Cloudflare → Node target switch** — Lovable defaults to Cloudflare Workers, where Prisma's Postgres TCP connection will not work; flip to Node before any DB call is attempted.

---

# Part B — Per-Subsystem Logic Specs (code-accurate)

I have everything. The schema uses `prisma db push` (no migration files — schema-first). Here is the exhaustive migration spec.

## Data Model + Seed

This subsystem is the canonical persistence layer for the HMD Secure AI-native CRM: a Postgres database defined via Prisma (`prisma/schema.prisma`, 390 lines, `prisma db push` schema-first — there is NO `prisma/migrations/` directory, the schema is the source of truth) plus a deterministic-shape seed (`prisma/seed.ts`, 502 lines) that builds the entire demo world. Every other subsystem (forecast, offers/approvals, cases/SLA, notifications, activity timeline, AI features) reads these tables. Re-implementing this WITHOUT loss means reproducing (a) all 14 entities + 13 enums + every relation/index/default exactly, and (b) the seed's exact object graph (6 users, 8 products, 6 services, 8 accounts, 11 contacts, 18 deals + 13 forecast profiles × 12 quarters, 12 cases + SLA dueDates, 11 case notes across 2 threads with internal-tier flagging, 5 offers in 5 distinct approval states, 7 approvals, 7 notifications, and a populated activity timeline).

### 0. Stack & data-access context (read first)

- **DB engine**: PostgreSQL (`datasource db { provider = "postgresql"; url = env("DATABASE_URL") }`). schema.prisma:1-12 has a hard comment: "Postgres + Prisma ONLY. Do not switch to SQLite/Supabase/file db." EU region (Frankfurt) for data-residency. Keep Postgres in TanStack Start — do NOT swap to SQLite.
- **IDs**: every model PK is `String @id @default(cuid())`. Prisma generates the cuid client-side at insert. In TanStack Start you must replicate: use the `cuid`/`@paralleldrive/cuid2` package (or keep Prisma) so IDs are collision-free strings, NOT auto-increment ints. Foreign keys are all `String`.
- **Timestamps**: `createdAt DateTime @default(now())` and `updatedAt DateTime @updatedAt` are Prisma-managed. In a non-Prisma data layer you must set `createdAt = new Date()` on insert and bump `updatedAt = new Date()` on every update yourself (or use Postgres `DEFAULT now()` + an `updated_at` trigger).
- **Client singleton**: `lib/db.ts` exports a hot-reload-safe `prisma` singleton (stashed on `globalThis` outside production). TanStack Start (Vite) has the same dev-HMR double-instantiation hazard — keep the same `globalThis` singleton guard for whatever client/pool you use.
- **Seed runner**: `package.json` → `"db:seed": "tsx prisma/seed.ts"` and a `prisma.seed` hook. In TanStack Start, port `seed.ts` to a standalone script run via `tsx`/`node`.
- **The simplest correct migration is to KEEP Prisma + Postgres** behind a `lib/db.ts`-style module and call it from TanStack Start server functions. Prisma is server-only; ensure it is never bundled to the client. Everything below assumes you might also re-implement on raw SQL, so column-level detail is given.

---

### 1. Enums (13 total — schema.prisma:14-110, 132-138)

Reproduce all as Postgres enums (or string unions + a CHECK). Member order matters only for UI dropdowns, not storage.

1. **`Role`** (16-21): `REP`, `TAM`, `SALES_MANAGER`, `FINANCE`. (Note: enum value is `SALES_MANAGER`, displayed as "Sales Manager".)
2. **`Channel`** (23-26): `DIRECT`, `RESELLER`. Default on Deal = `DIRECT`.
3. **`DealStage`** (28-38): `INTEREST_SHOWN`, `RFI_ANSWERED`, `RFP_OFFER_GIVEN`, `CUSTOMER_TEST`, `CONTRACT_NEGOTIATION`, `WON`, `LOST`. **RULE**: a RESELLER deal MUST NOT use `CONTRACT_NEGOTIATION` (enforced in app logic, not DB — see `RESELLER_STAGES` in lib/forecast.ts:30-37). Default = `INTEREST_SHOWN`.
4. **`DealStatus`** (40-44): `OPEN`, `WON`, `LOST`. Default = `OPEN`. (Distinct from `DealStage`; both exist on Deal.)
5. **`CatalogStatus`** (46-49): `ACTIVE`, `RETIRED`. Default on Product/Service = `ACTIVE`. RETIRED items are hidden from NEW offers but stay visible in historical offer snapshots.
6. **`ProviderType`** (51-54): `INTERNAL`, `THIRD_PARTY` (Service only, no default — required).
7. **`InvoicingModel`** (56-60): `ONE_OFF`, `FIXED_TERM`, `MONTHLY_RECURRING`. Used by Service (required) and Deal.serviceModel (default `MONTHLY_RECURRING`).
8. **`CaseStatus`** (62-67): `OPEN`, `IN_PROGRESS`, `ESCALATED`, `CLOSED`. Default = `OPEN`.
9. **`Priority`** (69-74): `LOW`, `MEDIUM`, `HIGH`, `CRITICAL`. Default on Case = `MEDIUM`. Drives SLA window.
10. **`NoteParentType`** (76-81): `ACCOUNT`, `DEAL`, `CASE`, `OFFER`. Polymorphic note parent discriminator.
11. **`OfferStatus`** (83-94): `DRAFT`, `SUBMITTED`, `PENDING_SM`, `SM_APPROVED`, `PENDING_FINANCE`, `FINANCE_APPROVED`, `APPROVED`, `REJECTED`. Default = `DRAFT`. State machine: Draft → Submitted → Pending SM → SM Approved → Pending Finance → Finance Approved → Approved / Rejected.
12. **`OfferItemType`** (96-99): `PRODUCT`, `SERVICE`.
13. **`ApprovalStep`** (101-104): `SALES_MANAGER`, `FINANCE`.
14. **`ApprovalStatus`** (106-110): `PENDING`, `APPROVED`, `REJECTED`. Default on Approval = `PENDING`.
15. **`ContactRole`** (132-138): `FINANCIAL`, `BUDGET`, `TECH`, `INFLUENCER`, `OTHER`. Nullable on Contact (the field is `ContactRole?`).

(13 named enums in the "Enums" block + `ContactRole` declared mid-file before Account = 14 enum declarations; I count `ContactRole` and `ProviderType` separately above so the list is 1-15 but represents 14 enum types — `InvoicingModel` is reused, not duplicated.)

---

### 2. Entity catalog (14 models)

Each model below: every field, type, nullability, default, plus relations and indexes. Nullable = Prisma `?`. All PKs are `String @id @default(cuid())` unless noted.

#### 2.1 `User` (schema.prisma:114-130)
- `id` cuid PK · `name` String · `email` String **@unique** · `role` Role · `createdAt` DateTime default now()
- Back-relations (no columns, just reverse sides): `accountsOwned` (Account via "AccountOwnerRep"), `accountsAsTam` (Account via "AccountAssignedTam"), `dealsOwned` (Deal via "DealOwnerRep"), `casesAssigned` (Case via "CaseAssignedTam"), `notes` (Note via "NoteAuthor"), `activityEvents` (ActivityEvent via "ActivityActor"), `offersCreated` (Offer via "OfferCreatedBy"), `approvals` (Approval via "ApprovalApprover"), `notifications` (Notification via "NotificationRecipient").
- **Re-impl**: 9 named relations all point back at User. In raw SQL these are just FKs on the child tables; the named relations exist because User is referenced multiple times from the same table (e.g. Account has both `ownerRepId` and `assignedTamId` → both FK to User). Preserve both directions per FK.

#### 2.2 `Account` (140-166)
- `id` cuid PK · `name` String · `domain` String? · `address` String? · `vatId` String? · `region` String · `segment` String · `industry` String · `ownerRepId` String (FK→User) · `assignedTamId` String? (FK→User) · `status` String **@default("ACTIVE")** (plain string, NOT an enum) · `createdAt` default now() · `updatedAt` @updatedAt
- Relations: `ownerRep` User (required, "AccountOwnerRep", onDelete default Restrict) · `assignedTam` User? ("AccountAssignedTam") · children: `contacts` Contact[], `deals` Deal[], `cases` Case[], `offers` Offer[], `activityEvents` ActivityEvent[]
- Indexes: `@@index([ownerRepId])`, `@@index([assignedTamId])`
- **Note**: `status` is a free String, not the CatalogStatus enum. `region`/`segment`/`industry` are free strings.

#### 2.3 `Contact` (168-182)
- `id` cuid PK · `accountId` String (FK→Account, **onDelete: Cascade**) · `name` String · `title` String? · `decisionRole` ContactRole? · `email` String? · `phone` String? · `isPrimary` Boolean **@default(false)**
- Relations: `account` Account (cascade delete) · `casesAsContact` Case[] ("CaseCustomerContact")
- Index: `@@index([accountId])`

#### 2.4 `Deal` (184-209)
- `id` cuid PK · `accountId` String (FK→Account, **onDelete: Cascade**) · `ownerRepId` String (FK→User, "DealOwnerRep") · `name` String · `channel` Channel **@default(DIRECT)** · `stage` DealStage **@default(INTEREST_SHOWN)** · `probability` Int **@default(10)** (percent 0-100) · `expectedCloseDate` DateTime? · `lastActivityAt` DateTime **@default(now())** · `status` DealStatus **@default(OPEN)** · `serviceModel` InvoicingModel **@default(MONTHLY_RECURRING)** · `notes` String? · `createdAt` default now() · `updatedAt` @updatedAt
- Relations: `account` Account (cascade) · `ownerRep` User · children: `forecastPeriods` DealForecastPeriod[], `offers` Offer[]
- Indexes: `@@index([accountId])`, `@@index([ownerRepId])`, `@@index([stage])`
- **RULE**: `probability` is normally set from `STAGE_PROBABILITY[stage]` (see §4) but stored as a column (so it can in principle be overridden per-deal). The schema default 10 = INTEREST_SHOWN's probability.

#### 2.5 `DealForecastPeriod` (211-229) — the time-phased forecast row
- `id` cuid PK · `dealId` String (FK→Deal, **onDelete: Cascade**) · `periodStart` DateTime · `periodEnd` DateTime · `periodLabel` String (e.g. `"2026-Q3"`) · `deviceUnits` Int @default(0) · `deviceRevenue` Float @default(0) · `serviceRevenue` Float @default(0) · `totalRevenue` Float @default(0) · `weightedRevenue` Float @default(0)
- Relation: `deal` Deal (cascade)
- Indexes: `@@index([dealId])`, `@@index([periodLabel])`
- **HARD RULE** (schema comment 211-212): NEVER collapse a deal to a single amount. device vs service revenue is kept SEPARATE in distinct columns. There are 12 rows per forecasted deal (3 years × 4 quarters). `Float` = Postgres double precision; keep float, not integer, though seed values happen to be whole numbers.

#### 2.6 `Product` (231-242)
- `id` cuid PK · `sku` String **@unique** · `name` String · `category` String · `unitPrice` Float · `gmPercent` Float **@default(0.35)** (gross margin as fraction 0..1) · `currency` String **@default("EUR")** · `status` CatalogStatus **@default(ACTIVE)** · `createdAt` default now() · `updatedAt` @updatedAt
- No relations declared (offers reference products only by snapshot, not FK — see OfferLineItem).

#### 2.7 `Service` (244-257)
- `id` cuid PK · `name` String · `providerType` ProviderType (required) · `invoicingModel` InvoicingModel (required) · `basePrice` Float · `gmPercent` Float **@default(0.55)** · `currency` String **@default("EUR")** · `status` CatalogStatus **@default(ACTIVE)** · `createdAt` default now() · `updatedAt` @updatedAt
- Relation: `cases` Case[] (a Case may reference a Service).
- **Note**: Service has NO `sku` and NO unique constraint; default gmPercent is 0.55 (vs Product's 0.35).

#### 2.8 `Case` (259-282)
- `id` cuid PK · `accountId` String (FK→Account, **onDelete: Cascade**) · `serviceId` String? (FK→Service, onDelete default) · `assignedTamId` String? (FK→User, "CaseAssignedTam") · `title` String · `description` String? · `status` CaseStatus **@default(OPEN)** · `priority` Priority **@default(MEDIUM)** · `customerContactId` String? (FK→Contact, "CaseCustomerContact") · `createdAt` default now() · `updatedAt` @updatedAt · `closedAt` DateTime? · `dueDate` DateTime? (SLA target, P2 #18)
- Relations: `account` Account (cascade) · `service` Service? · `assignedTam` User? · `customerContact` Contact?
- Indexes: `@@index([accountId])`, `@@index([assignedTamId])`, `@@index([status])`
- **RULE**: `dueDate` = `createdAt + SLA_DAYS[priority]` (see §5). SLA highlighting (overdue/approaching) is computed at read time, not stored.

#### 2.9 `Note` (284-297) — polymorphic
- `id` cuid PK · `parentType` NoteParentType · `parentId` String (NO FK — polymorphic, points at Account/Deal/Case/Offer id) · `authorId` String (FK→User, "NoteAuthor") · `body` String · `internal` Boolean **@default(false)** · `createdAt` default now()
- Relation: `author` User
- Index: `@@index([parentType, parentId])` (composite — query notes by (type,id))
- **RULE**: `internal` is the two-tier note model (TAM #5 / BUILD-SPEC P1): `false` = working note visible to all with access; `true` = internal-only (vendor/engineering coordination). There is NO database FK enforcing parent existence — the parent is resolved in app code via (parentType, parentId).

#### 2.10 `ActivityEvent` (299-314) — the account timeline / service history
- `id` cuid PK · `accountId` String? (FK→Account, **onDelete: Cascade**) · `actorId` String? (FK→User, "ActivityActor") · `type` String (free string, e.g. `"CASE_OPENED"`) · `summary` String · `linkedRecordType` String? · `linkedRecordId` String? · `createdAt` default now()
- Relations: `account` Account? (cascade) · `actor` User?
- Indexes: `@@index([accountId])`, `@@index([createdAt])`
- **Note**: `type`, `linkedRecordType`, `linkedRecordId` are all free strings (NOT enums, NOT FKs). Both account and actor are nullable. `linkedRecordId` can legitimately be `null` even when `linkedRecordType` is set (see seed §6.7 role notifications/events).

#### 2.11 `Offer` (316-341)
- `id` cuid PK · `accountId` String (FK→Account, **onDelete: Cascade**) · `dealId` String? (FK→Deal, onDelete default) · `version` Int **@default(1)** · `status` OfferStatus **@default(DRAFT)** · `subtotal` Float @default(0) · `discountPercent` Float @default(0) · `discountJustification` String? · `total` Float @default(0) · `locked` Boolean **@default(false)** · `createdById` String (FK→User, "OfferCreatedBy") · `createdAt` default now() · `updatedAt` @updatedAt
- Relations: `account` Account (cascade) · `deal` Deal? · `createdBy` User · children: `lineItems` OfferLineItem[], `approvals` Approval[]
- Indexes: `@@index([accountId])`, `@@index([dealId])`, `@@index([status])`
- **RULES**: `total = round(subtotal * (1 - discountPercent/100))`. `locked` is true while pending approval, false for draft/approved/rejected (see seed). `version` defaults to 1 (revision support exists in schema but seed only uses v1).

#### 2.12 `OfferLineItem` (344-357) — immutable catalog snapshot
- `id` cuid PK · `offerId` String (FK→Offer, **onDelete: Cascade**) · `itemType` OfferItemType · `itemId` String (the source Product/Service id — NOT an FK) · `nameSnapshot` String · `unitPriceSnapshot` Float · `quantity` Int **@default(1)** · `lineTotal` Float @default(0)
- Relation: `offer` Offer (cascade)
- Index: `@@index([offerId])`
- **HARD RULE** (schema comment 343): this is an IMMUTABLE snapshot of a catalog item at offer time. `nameSnapshot` and `unitPriceSnapshot` freeze the catalog state so a RETIRED product (or a later price change) stays correct in old offers. `itemId` is a soft reference (string), deliberately NOT an FK, so deleting/retiring a catalog item never breaks historical offers. `lineTotal = unitPriceSnapshot * quantity`.

#### 2.13 `Approval` (359-374)
- `id` cuid PK · `offerId` String (FK→Offer, **onDelete: Cascade**) · `step` ApprovalStep · `status` ApprovalStatus **@default(PENDING)** · `approverId` String? (FK→User, "ApprovalApprover") · `comment` String? · `createdAt` default now() · `decidedAt` DateTime?
- Relations: `offer` Offer (cascade) · `approver` User?
- Indexes: `@@index([offerId])`, `@@index([step, status])` (composite)
- **RULE**: one Approval row per step. `approverId`/`decidedAt`/`comment` are null while PENDING, set on decision. Two steps (`SALES_MANAGER` then `FINANCE`) run in sequence.

#### 2.14 `Notification` (376-390)
- `id` cuid PK · `recipientId` String (FK→User, "NotificationRecipient", **onDelete: Cascade**) · `title` String · `body` String · `linkedRecordType` String? · `linkedRecordId` String? · `readAt` DateTime? · `createdAt` default now()
- Relation: `recipient` User (cascade)
- Indexes: `@@index([recipientId])`, `@@index([readAt])`
- **RULE**: unread = `readAt IS NULL`. `linkedRecordId` may be null even with a type set.

#### Relation / cascade summary (preserve exactly)
`onDelete: Cascade` is set on: Contact→Account, Deal→Account, DealForecastPeriod→Deal, Case→Account, ActivityEvent→Account, Offer→Account, OfferLineItem→Offer, Approval→Offer, Notification→User. All other FKs use Prisma's default (Restrict/NoAction). The seed's `wipe()` (seed.ts:79-95) deletes in strict child-first order regardless, so cascade is a safety net, not the deletion mechanism. **Re-impl**: in raw SQL declare `ON DELETE CASCADE` on those 9 FKs; in a non-Prisma ORM mirror the cascade config.

#### Index summary (15 secondary indexes — create all for query parity)
Account(ownerRepId), Account(assignedTamId), Contact(accountId), Deal(accountId), Deal(ownerRepId), Deal(stage), DealForecastPeriod(dealId), DealForecastPeriod(periodLabel), Case(accountId), Case(assignedTamId), Case(status), Note(parentType,parentId), ActivityEvent(accountId), ActivityEvent(createdAt), Offer(accountId), Offer(dealId), Offer(status), OfferLineItem(offerId), Approval(offerId), Approval(step,status), Notification(recipientId), Notification(readAt). Plus unique: User.email, Product.sku.

---

### 3. Seed: exact demo world (`prisma/seed.ts`)

The seed must be reproduced so the new app boots into an identical, believable HMD world. An empty DB is explicitly a "losing demo" (seed.ts:2). Order of operations matters because of FK dependencies. All dates are relative to `NOW = new Date()` at seed time via `daysAgo(d)` / `daysAhead(d)` (seed.ts:22-24). The seed is **not** idempotent by upsert — it first wipes everything (`wipe()`), then inserts. Re-running gives the same shape but new cuids and NOW-relative dates.

#### 3.0 `wipe()` order (seed.ts:79-95) — child-first delete
notification → approval → offerLineItem → offer → note → activityEvent → case → dealForecastPeriod → deal → contact → account → service → product → user. **Re-impl**: keep this exact order (or rely on cascade + truncate-restart-identity). Do this before every seed.

#### 3.1 Users (6) — seed.ts:101-118 — drive the demo role-switch
| var | name | email | role |
|---|---|---|---|
| sofia | Sofia Rep | sofia@hmd.demo | REP |
| raj | Raj Rep | raj@hmd.demo | REP |
| timo | Timo TAM | timo@hmd.demo | TAM |
| lena | Lena TAM | lena@hmd.demo | TAM |
| mira | Mira Sales Manager | mira@hmd.demo | SALES_MANAGER |
| fiona | Fiona Finance | fiona@hmd.demo | FINANCE |

These emails are stable login identities (the app role-switches by user). Keep them verbatim.

#### 3.2 Products (8) — seed.ts:121-147 — `currency:"EUR"` for all
| sku | name | category | unitPrice | gmPercent | status |
|---|---|---|---|---|---|
| HMD-PRO-001 | HMD Secure Pro Device | Device | 749 | 0.35 | ACTIVE |
| HMD-RUG-002 | HMD Secure Rugged Device | Device | 899 | 0.40 | ACTIVE |
| HMD-TAB-003 | HMD Secure Tablet | Device | 629 | 0.33 | ACTIVE |
| HMD-LITE-004 | HMD Secure Lite Device | Device | 449 | 0.30 | ACTIVE |
| HMD-ENR-010 | Device Enrollment Pack | Accessory | 39 | 0.55 | ACTIVE |
| HMD-WAR-011 | Extended Warranty | Accessory | 89 | 0.70 | ACTIVE |
| HMD-DOCK-012 | USB-C Secure Dock | Accessory | 119 | 0.45 | ACTIVE |
| HMD-LEG-099 | HMD Legacy Secure Phone | Device | 399 | 0.25 | **RETIRED** |

The RETIRED HMD-LEG-099 is load-bearing: it must be hidden from new offers yet appear in offer #4's historical snapshot (§3.7). `status` defaults to `"ACTIVE"` if a spec omits it (`p.status ?? "ACTIVE"`, line 143).

#### 3.3 Services (6) — seed.ts:151-162 — covers all 3 invoicing models; `currency:"EUR"`, `status:"ACTIVE"`
| name | providerType | invoicingModel | basePrice | gmPercent |
|---|---|---|---|---|
| Secure Device Management | INTERNAL | MONTHLY_RECURRING | 9 | 0.72 |
| 24/7 Premium Support | INTERNAL | MONTHLY_RECURRING | 14 | 0.65 |
| Deployment Workshop | INTERNAL | ONE_OFF | 4500 | 0.55 |
| Compliance Audit Package | THIRD_PARTY | FIXED_TERM | 12000 | 0.30 |
| MDM Integration Support | INTERNAL | FIXED_TERM | 8000 | 0.60 |
| Third-party Incident Response | THIRD_PARTY | ONE_OFF | 6500 | 0.28 |

#### 3.4 Accounts (8) + Contacts (11) — seed.ts:170-222
Account specs (owner/tam are User vars from §3.1):

| # | name | region | segment | industry | owner | tam | contacts (name / title, *=primary) |
|---|---|---|---|---|---|---|---|
| 1 | NordSec Logistics | DACH | Enterprise | Logistics | sofia | timo | Anke Vogel / Head of IT *, Markus Bauer / Security Lead |
| 2 | Aurora Health Systems | Nordics | Enterprise | Healthcare | sofia | timo | Elin Sandberg / CISO * |
| 3 | Baltic Field Services | Baltics | Mid-market | Field Services | raj | lena | Janis Ozols / Operations Director * |
| 4 | RheinWerk Manufacturing | DACH | Enterprise | Manufacturing | raj | lena | Stefan Krause / IT Procurement *, Petra Lang / Plant Manager |
| 5 | FinGov Mobility | Finland | Public Sector | Government | sofia | timo | Aino Korhonen / Procurement Officer * |
| 6 | Alpine Utilities | Central Europe | Enterprise | Energy | raj | timo | Luca Moser / Head of Field Ops * |
| 7 | Nordic Retail Group | Nordics | Mid-market | Retail | sofia | lena | Freja Nilsson / Store Tech Manager * |
| 8 | Helvetia Secure Bank | Central Europe | Enterprise | Finance | raj | timo | Daniel Frei / Head of Endpoint Security * |

Contact emails follow `firstname.lastname@<accountslug>.example`. Derived account fields (seed.ts:205-211):
1. `domain` = the host part of the FIRST contact's email (e.g. `nordsec.example`), or null.
2. `address` = `` `${firstWordOfName} House, ${region}` `` (e.g. "NordSec House, DACH").
3. `vatId` = `` `${VAT_PREFIX[region] ?? "EU"}${(20000000 + accIdx*137)}` `` where `accIdx` is 1-based and `VAT_PREFIX = { DACH:"DE", Nordics:"SE", Baltics:"LV", Finland:"FI", "Central Europe":"CH" }` (seed.ts:190). So account 1 → `DE20000137`, account 2 → `SE20000274`, … account 8 → `CH20001096`. (Regions "Baltics" and "Finland" map to LV/FI; any region not in the map → "EU".)
4. `status` = `"ACTIVE"`.
5. Contact `decisionRole` is derived from title by `roleFromTitle` (seed.ts:191-198), case-insensitive, FIRST match wins:
   - matches `/cfo|finance|financial/` → `FINANCIAL`
   - else `/procurement|purchas|budget/` → `BUDGET` (so "IT Procurement", "Procurement Officer" → BUDGET)
   - else `/ciso|security|it|cto|tech|endpoint/` → `TECH` (so "CISO", "Security Lead", "Head of IT", "Head of Endpoint Security" → TECH)
   - else `/head|director|manager|officer|lead/` → `INFLUENCER` (so "Operations Director", "Plant Manager", "Store Tech Manager", "Head of Field Ops" → INFLUENCER; note "Head of IT" already matched TECH via "it")
   - else `OTHER`.
6. The primary contact's id per account is stored in `primaryContactByAccount` (seed.ts:201,220) and later used as `Case.customerContactId`.

**Re-impl ordering caveat**: `roleFromTitle` ordering matters — "Head of IT" contains both "head" and "it"; "it" is tested before "head" so it resolves to TECH. Replicate the regex precedence exactly.

#### 3.5 Deals (18) + forecast rows — seed.ts:231-300
Each deal: `ownerRepId` is copied from the account's owner (NOT the spec), `probability = STAGE_PROBABILITY[stage]`, `expectedCloseDate = daysAhead(closeInDays)`, `lastActivityAt = daysAgo(lastActivityDaysAgo)`, `status = spec.status ?? "OPEN"`, `channel`/`stage` verbatim, `notes = null`. Full deal table (only forecasted deals get DealForecastPeriod rows):

| # | account | name | channel | stage | closeInDays | lastActivityDaysAgo | status | forecast {devicesYr1, devicePrice, monthlySvc/device} |
|---|---|---|---|---|---|---|---|---|
| 1 | NordSec Logistics | NordSec fleet rollout 4k units | DIRECT | CUSTOMER_TEST | 60 | 2 | OPEN | 1600, 749, 9 |
| 2 | NordSec Logistics | NordSec rugged expansion | DIRECT | RFP_OFFER_GIVEN | 95 | 6 | OPEN | 600, 899, 14 |
| 3 | Aurora Health Systems | Aurora clinical tablet pilot | DIRECT | CONTRACT_NEGOTIATION | 30 | 3 | OPEN | 900, 629, 14 |
| 4 | Aurora Health Systems | Aurora ward expansion | DIRECT | INTEREST_SHOWN | 150 | 21 (STALLED) | OPEN | — |
| 5 | Baltic Field Services | Baltic reseller bundle | RESELLER | CUSTOMER_TEST | 45 | 5 | OPEN | 400, 449, 9 |
| 6 | Baltic Field Services | Baltic seasonal top-up | RESELLER | RFI_ANSWERED | 80 | 18 (STALLED) | OPEN | — |
| 7 | RheinWerk Manufacturing | RheinWerk plant rollout | RESELLER | RFP_OFFER_GIVEN | 70 | 4 | OPEN | 1200, 899, 9 |
| 8 | RheinWerk Manufacturing | RheinWerk warehouse scanners | RESELLER | INTEREST_SHOWN | 120 | 30 (STALLED) | OPEN | — |
| 9 | FinGov Mobility | FinGov public-sector framework | DIRECT | RFI_ANSWERED | 110 | 7 | OPEN | 2000, 629, 9 |
| 10 | FinGov Mobility | FinGov pilot batch | DIRECT | WON | -20 | 25 | **WON** | 300, 629, 9 |
| 11 | Alpine Utilities | Alpine field crew devices | DIRECT | CUSTOMER_TEST | -8 (PAST CLOSE) | 9 | OPEN | 700, 899, 14 |
| 12 | Alpine Utilities | Alpine substation tablets | DIRECT | RFP_OFFER_GIVEN | 65 | 11 | OPEN | 350, 629, 9 |
| 13 | Nordic Retail Group | Nordic Retail POS refresh | RESELLER | CUSTOMER_TEST | 40 | 6 | OPEN | 500, 449, 9 |
| 14 | Nordic Retail Group | Nordic Retail back-office | RESELLER | LOST | -40 | 35 | **LOST** | — |
| 15 | Helvetia Secure Bank | Helvetia branch security devices | DIRECT | CONTRACT_NEGOTIATION | 25 | 1 | OPEN | 1100, 749, 14 |
| 16 | Helvetia Secure Bank | Helvetia executive fleet | DIRECT | RFP_OFFER_GIVEN | -5 (PAST CLOSE+STALLED) | 16 | OPEN | 200, 899, 14 |
| 17 | NordSec Logistics | NordSec accessory framework | DIRECT | INTEREST_SHOWN | 130 | 3 | OPEN | — |
| 18 | FinGov Mobility | FinGov disaster-recovery kit | DIRECT | RFI_ANSWERED | 90 | 4 | OPEN | 250, 449, 9 |

13 of the 18 deals carry a forecast profile → each gets 12 DealForecastPeriod rows (= **156 forecast rows total**, matches the seed `forecastRows` count). The deliberate demo signals to preserve: 4 STALLED deals (lastActivity > ~14d on open deals), 2 PAST-CLOSE deals (expectedCloseDate in the past, still open: #11, #16), 1 WON (#10), 1 LOST (#14). Reseller deals (#5,#6,#7,#8,#13,#14) never use CONTRACT_NEGOTIATION.

**Forecast row generation** (seed.ts:272-298) — per forecasted deal, `quarters = quartersFrom(NOW, 12)` (12 consecutive quarters from the quarter containing NOW), `prob = STAGE_PROBABILITY[stage]`. For each quarter at index `i` (0..11):
1. `yearIndex = floor(i / 4)` (0, 1, or 2).
2. `rampFactor = [1, 0.55, 0.4][yearIndex] ?? 0.3` (year 1 full, year 2 = 0.55, year 3 = 0.4).
3. `deviceUnits = round((devicesYr1 / 4) * rampFactor)`.
4. `deviceRevenue = deviceUnits * devicePrice`.
5. `cumulativeDevices = round((devicesYr1 / 4) * (i+1) * 0.8)` — recurring base grows with cumulative active devices.
6. `serviceRevenue = cumulativeDevices * monthlyServicePerDevice * 3` (3 months/quarter).
7. `totalRevenue = deviceRevenue + serviceRevenue`.
8. `weightedRevenue = weightedRevenue(prob, totalRevenue) = round(totalRevenue * prob/100)`.
9. Row stores `periodStart=q.start`, `periodEnd=q.end`, `periodLabel=q.label` (e.g. "2026-Q3").

Quarter math (lib/forecast.ts:81-107, all **UTC**): `quarterOf = floor(month/3)+1`; `makeQuarter(year,q)` → start = `Date.UTC(year,(q-1)*3,1)`, end = `Date.UTC(year,(q-1)*3+3,0)` (last day of quarter). `quartersFrom` walks forward 12 quarters wrapping year on Q4→Q1.

**Re-impl note**: these formulas must be byte-identical or the Manager/Finance 3-year aggregated views and the forecast narrative AI (which read these rows) will show different numbers. Port `lib/forecast.ts` verbatim — it is shared by seed AND the live views/aggregation (`aggregateByQuarter`, `rollUp` for quarter/half/year toggles). Keep `STAGE_PROBABILITY` exactly: INTEREST_SHOWN 10, RFI_ANSWERED 25, RFP_OFFER_GIVEN 45, CUSTOMER_TEST 70, CONTRACT_NEGOTIATION 90, WON 100, LOST 0.

#### 3.6 Cases (12) + SLA dueDates + timeline events — seed.ts:309-355
Each case: `serviceId` from service name, `assignedTamId` from spec, `customerContactId = primaryContactByAccount.get(accountId) ?? null`, `createdAt = daysAgo(ageDays)`, `dueDate = createdAt + SLA_DAYS[priority]*86400000`, `closedAt = closedDaysAgo!=null ? daysAgo(closedDaysAgo) : null`. `SLA_DAYS = { CRITICAL:2, HIGH:4, MEDIUM:8, LOW:15 }` (seed.ts:324, mirrors lib/sla.ts:7-12).

| # | account | service | tam | title | status | priority | ageDays | closedDaysAgo |
|---|---|---|---|---|---|---|---|---|
| 1 | NordSec Logistics | Secure Device Management | timo | Devices failing MDM check-in | ESCALATED | CRITICAL | 5 | — |
| 2 | NordSec Logistics | 24/7 Premium Support | timo | Battery drain after firmware update | IN_PROGRESS | HIGH | 9 | — |
| 3 | Aurora Health Systems | Compliance Audit Package | timo | Audit evidence export blocked | OPEN | HIGH | 3 | — |
| 4 | Aurora Health Systems | Secure Device Management | timo | Ward tablets need re-enrollment | OPEN | MEDIUM | 12 | — |
| 5 | Baltic Field Services | MDM Integration Support | lena | Integration with legacy ERP | IN_PROGRESS | MEDIUM | 7 | — |
| 6 | RheinWerk Manufacturing | Third-party Incident Response | lena | Suspicious access on 3 devices | ESCALATED | CRITICAL | 2 | — |
| 7 | FinGov Mobility | Deployment Workshop | timo | Workshop scheduling conflict | OPEN | LOW | 6 | — |
| 8 | Alpine Utilities | Secure Device Management | timo | Rugged devices overheating in field | OPEN | HIGH | 4 | — |
| 9 | Nordic Retail Group | 24/7 Premium Support | lena | POS app crash on scan | IN_PROGRESS | MEDIUM | 8 | — |
| 10 | Helvetia Secure Bank | Compliance Audit Package | timo | Quarterly compliance review | CLOSED | LOW | 30 | 4 |
| 11 | RheinWerk Manufacturing | Secure Device Management | lena | Warehouse Wi-Fi handoff drops | CLOSED | MEDIUM | 22 | 6 |
| 12 | FinGov Mobility | MDM Integration Support | timo | SSO token expiry too aggressive | OPEN | MEDIUM | 10 | — |

For EACH case the seed also writes an ActivityEvent `type:"CASE_OPENED"`, `summary:"Case opened: <title>"`, `linkedRecordType:"CASE"`, `linkedRecordId:caseId`, `actorId:tam`, `createdAt:createdAt`. For the 2 CLOSED cases it additionally writes `type:"CASE_CLOSED"`, `summary:"Case closed: <title>"`, `createdAt:daysAgo(closedDaysAgo)`. SLA status is then computed at read time by `slaStatus(dueDate, closedAt)` (lib/sla.ts:22-28): closed→`ok`; no dueDate→`none`; `(due-now)<0`→`overdue`; `<=2 days`→`approaching`; else `ok`. Given ageDays vs SLA window, several OPEN cases will be overdue/approaching at demo time (e.g. case #4 MEDIUM age 12 vs 8-day SLA = overdue; case #2 HIGH age 9 vs 4-day = overdue).

#### 3.7 Case notes (2 threads, 11 notes) + internal-tier flagging + timeline — seed.ts:357-389
Threaded notes are added to the FIRST TWO created cases (case #1 NordSec MDM, case #2 NordSec battery) so the AI case-summary feature (P2 #22, fires at ≥5 notes) has material. Thread 1 = 6 notes, thread 2 = 5 notes (11 total). Each note: `parentType:"CASE"`, `parentId:caseId`, `authorId:tam`, `createdAt = daysAgo(max(0, ageDays - j))` (notes walk forward in time across the case's life). **`internal` is set by regex** `/vendor|engineering|qa|hotfix|internal/i` on the note body (seed.ts:380) — so notes mentioning vendor tickets, engineering, QA, hotfix become internal-tier; customer-facing observations stay working-tier.

Thread 1 bodies (case "Devices failing MDM check-in"): "Customer reports ~40 units failing the MDM compliance check-in." / "Narrowed it down to devices on firmware 4.2.1 only." / "Opened vendor ticket HMD-4471; they suspect a certificate-rotation bug." *(internal: vendor)* / "Workaround confirmed: a manual re-enrol clears it temporarily." / "Vendor committed to a hotfix in the next release." *(internal: vendor+hotfix)* / "Rolled the workaround to the worst-affected site; complaints dropping."

Thread 2 bodies (case "Battery drain after firmware update"): "Fleet-wide battery-drain complaints started right after the firmware update." / "Reproduced on a test unit — idle drain roughly doubled." / "Logs point at a background sync loop that never backs off." / "Gave the customer a config to throttle sync as a stopgap." / "Engineering has a candidate fix in QA; targeting next patch." *(internal: engineering+QA)*

Each note ALSO writes an ActivityEvent `type:"CASE_NOTE_ADDED"`, `summary:'Note on "<caseTitle>"'`, `linkedRecordType:"CASE"`, `linkedRecordId:caseId`, `createdAt:noteAt`.

#### 3.8 Offers (5) — one in each key approval state — seed.ts:391-466
Offers are built by `buildOffer()` (seed.ts:32-77): prices each item (PRODUCT uses `product.unitPrice`, SERVICE uses `service.basePrice`), `subtotal = round(Σ price*qty)`, `total = round(subtotal*(1 - discountPercent/100))`, `version:1`, then writes one OfferLineItem per item with `itemType`, `itemId`, `nameSnapshot`, `unitPriceSnapshot`, `quantity`, `lineTotal = price*qty`.

| # | deal | createdBy | status | discount% | locked | justification | line items (name × qty) |
|---|---|---|---|---|---|---|---|
| 1 | NordSec accessory framework | sofia | **DRAFT** | 0 | false | — | Device Enrollment Pack ×200, USB-C Secure Dock ×150 |
| 2 | NordSec fleet rollout 4k units | sofia | **PENDING_SM** | 12 | true | "Strategic flagship account; 12% to beat incumbent in customer test." | HMD Secure Pro Device ×1600, Secure Device Management ×1600 |
| 3 | Aurora clinical tablet pilot | sofia | **PENDING_FINANCE** | 8 | true | "Healthcare framework pricing; 8% volume discount agreed with SM." | HMD Secure Tablet ×900, 24/7 Premium Support ×900, Compliance Audit Package ×1 |
| 4 | FinGov pilot batch | sofia | **APPROVED** | 5 | false | "Public-sector framework discount, pre-approved." | **HMD Legacy Secure Phone (RETIRED) ×300**, Deployment Workshop ×1 |
| 5 | Helvetia executive fleet | raj | **REJECTED** | 22 | false | "Customer pushing hard on price." | HMD Secure Rugged Device ×200 |

Per-offer side effects (Approval + ActivityEvent + Notification), reproduce exactly:
- **Offer 2 (PENDING_SM)**: Approval{step:SALES_MANAGER, status:PENDING}. ActivityEvent{actor:sofia, type:"OFFER_SUBMITTED", summary:"Offer submitted for SM approval (12% discount)"}. Notification→mira{title:"Discounted offer awaiting your approval", body:"NordSec fleet rollout — 12% discount needs Sales Manager sign-off."}.
- **Offer 3 (PENDING_FINANCE)**: Approval{SALES_MANAGER, APPROVED, approver:mira, comment:"Approved — strategic healthcare logo.", decidedAt:daysAgo(1)} + Approval{FINANCE, PENDING}. ActivityEvent{actor:mira, type:"OFFER_SM_APPROVED", summary:"Sales Manager approved offer; routed to Finance"}. Notification→fiona{title:"Offer awaiting Finance approval", body:"Aurora clinical tablet pilot — SM approved, 8% discount, needs Finance sign-off."}.
- **Offer 4 (APPROVED)**: Approval{SALES_MANAGER, APPROVED, approver:mira, comment:"Approved.", decidedAt:daysAgo(26)} + Approval{FINANCE, APPROVED, approver:fiona, comment:"Finance approved; framework pricing confirmed.", decidedAt:daysAgo(25)}. ActivityEvent{actor:fiona, type:"OFFER_APPROVED", summary:"Offer fully approved (SM + Finance)"}. Notification→sofia{title:"Your offer was approved", body:"FinGov pilot batch — fully approved by SM and Finance."}. Demonstrates the RETIRED-product-in-historical-snapshot rule (snapshot keeps HMD-LEG-099 valid).
- **Offer 5 (REJECTED)**: Approval{SALES_MANAGER, REJECTED, approver:mira, comment:"22% too deep; cap at 12% and resubmit with justification.", decidedAt:daysAgo(2)}. ActivityEvent{actor:mira, type:"OFFER_REJECTED", summary:"Sales Manager rejected offer (discount too deep)"}. Notification→raj{title:"Your offer was rejected", body:"Helvetia executive fleet — SM rejected 22% discount. See comment and resubmit."}.
- **Offer 1 (DRAFT)**: no approval, no event, no notification.

Total approvals created = 7 (offer2:1, offer3:2, offer4:2, offer5:1, offer1:0). Computed subtotals/totals (illustrative, all rounded): offer1 subtotal = 200·39 + 150·119 = 7,800 + 17,850 = 25,650, total = 25,650 (0%). offer2 = 1600·749 + 1600·9 = 1,198,400 + 14,400 = 1,212,800, total = round(·0.88) = 1,067,264. offer3 = 900·629 + 900·14 + 1·12,000 = 566,100 + 12,600 + 12,000 = 590,700, total = round(·0.92) = 543,444. offer4 = 300·399 + 1·4,500 = 119,700 + 4,500 = 124,200, total = round(·0.95) = 117,990. offer5 = 200·899 = 179,800, total = round(·0.78) = 140,244.

#### 3.9 Standalone notifications + account timeline texture — seed.ts:469-475
- 2 extra notifications with `linkedRecordId: null`:
  - →timo{title:"Critical case assigned", body:"NordSec Logistics — devices failing MDM check-in (CRITICAL).", linkedRecordType:"CASE", linkedRecordId:null}.
  - →lena{title:"Case escalated to 3rd party", body:"RheinWerk Manufacturing — suspicious access escalated to incident response.", linkedRecordType:"CASE", linkedRecordId:null}.
  - Total notifications = 4 offer-related (offers 2-5) + 2 standalone = **6**. (Earlier I listed 7 — recount: offers 2,3,4,5 = 4 notifications, plus these 2 = 6. Verify against the seed `notifications` count printed at runtime.)
- Account-timeline texture: for the FIRST 5 accounts, one ActivityEvent{actor:account.ownerRepId, type:"ACCOUNT_NOTE", summary:"Quarterly review scheduled with account.", linkedRecordType:"ACCOUNT", linkedRecordId:account.id, createdAt:daysAgo(8)}.

#### 3.10 ActivityEvent total (timeline)
Sources: 12 CASE_OPENED + 2 CASE_CLOSED + 11 CASE_NOTE_ADDED + 4 offer events (OFFER_SUBMITTED, OFFER_SM_APPROVED, OFFER_APPROVED, OFFER_REJECTED) + 5 ACCOUNT_NOTE = **34 activity events**. The seed prints exact counts at the end (seed.ts:478-492) — the new app's seed should print and match: users 6, accounts 8, contacts 11, deals 18, forecastRows 156, products 8, services 6, cases 12, offers 5, approvals 7, notifications 6, activity 34.

---

### 4. Re-implementation notes: Prisma/Next → TanStack Start

1. **Keep Postgres + Prisma if at all possible.** Prisma is runtime-agnostic; it runs fine inside TanStack Start **server functions** (`createServerFn`). Wrap all DB access in a `lib/db.ts` singleton exactly as today and import it only from server-function modules. Do NOT let `@prisma/client` reach the client bundle (Vite will try to bundle it — mark it external / server-only). This is the lowest-risk path and preserves every default, index, cascade, and the `lib/forecast.ts`/`lib/sla.ts` logic untouched.
2. **If replacing Prisma** (e.g. Drizzle/Kysely): translate each model in §2 column-for-column including the 15 secondary indexes, 2 unique constraints, and 9 `ON DELETE CASCADE` FKs. Re-implement cuid id generation (do not switch to serial/uuid silently — existing seed code and any AI prompts assume opaque string ids). Re-implement `@default(now())` and `@updatedAt` (Drizzle: `.defaultNow()` + an `$onUpdate`; or Postgres `DEFAULT now()` + trigger). The polymorphic `Note(parentType,parentId)` and soft-reference `OfferLineItem.itemId`/`ActivityEvent.linkedRecordId` must stay FK-less by design — do not "fix" them into real FKs or you break retired-item snapshots and cross-entity notes.
3. **Floats**: `unitPrice`, `basePrice`, `gmPercent`, all forecast/offer money fields are Prisma `Float` = Postgres double precision. Keep float (the rounding in code already controls precision). Do not switch to integer cents without re-deriving every formula in `lib/forecast.ts` and `buildOffer`.
4. **Shared pure logic is portable as-is.** `lib/forecast.ts` (STAGE_PROBABILITY, weightedRevenue, quartersFrom, makeQuarter, aggregateByQuarter, rollUp, grossMargin, STAGE_LABEL, RESELLER_STAGES/DIRECT_STAGES) and `lib/sla.ts` (SLA_DAYS, slaDueDate, slaStatus, slaLabel) are framework-agnostic TypeScript with only a `@prisma/client` type import for enum names — copy verbatim; if you drop Prisma, replace those type imports with your own union types. The seed depends on `STAGE_PROBABILITY`, `quartersFrom`, `weightedRevenue` so port these first.
5. **Seed**: port `prisma/seed.ts` to a standalone `tsx` script. The `buildOffer` helper, `wipe()` delete order, `daysAgo/daysAhead` relative dates, `roleFromTitle` regex precedence, the `internal`-note regex, and the SLA dueDate computation are all logic that MUST be preserved — they are the difference between a demo-ready world and a broken one. Keep the end-of-seed count assertions (§3.10) as a self-check.
6. **NOW-relative dating**: because all seed dates are relative to `new Date()` at seed time, the SLA overdue/approaching badges and "stalled"/"past-close" deal signals stay correct whenever you re-seed. Do not hardcode absolute dates.
7. **Demo identities**: the 6 `@hmd.demo` emails and the role-switch they enable are part of the demo contract — keep them verbatim so the role-switcher and per-role notification inboxes (mira=SM approvals, fiona=Finance approvals, sofia/raj=their own offer outcomes, timo/lena=case assignments) light up correctly.

### Relevant files (absolute)
- `/Users/huataipan/Wichai/Hackathons/sales-hackathons-prompt/prisma/schema.prisma` — full data model.
- `/Users/huataipan/Wichai/Hackathons/sales-hackathons-prompt/prisma/seed.ts` — full demo-world seed.
- `/Users/huataipan/Wichai/Hackathons/sales-hackathons-prompt/lib/forecast.ts` — STAGE_PROBABILITY, weightedRevenue, quartersFrom/makeQuarter, aggregateByQuarter, rollUp (shared by seed + views).
- `/Users/huataipan/Wichai/Hackathons/sales-hackathons-prompt/lib/sla.ts` — SLA_DAYS + slaDueDate/slaStatus (case dueDate logic).
- `/Users/huataipan/Wichai/Hackathons/sales-hackathons-prompt/lib/db.ts` — Prisma singleton pattern to replicate.
- No `prisma/migrations/` dir exists — schema is applied via `prisma db push` (`package.json` `prisma:push`); the new app can either `db push` the same schema or generate equivalent DDL from §2.

---

I now have the complete picture. Here is the exhaustive migration spec.

## Deal Pipeline + 3-Year Time-Phased Forecast

This subsystem owns the deal record, the 7-stage pipeline with the direct/reseller channel rule, stage probabilities, and the 3-year (12-quarter) time-phased forecast where a deal's value is the SUM of per-quarter device/service rows — never a single amount field. Source files: `lib/forecast.ts`, `app/deals/actions.ts`, `components/deal-form.tsx`, `app/deals/new/page.tsx`, `app/deals/[id]/page.tsx`, plus downstream consumers `lib/reporting.ts`, `lib/targets.ts`, `app/finance/page.tsx`, `app/manager/page.tsx`, `app/api/export/forecast/route.ts`, `app/rep/intake-actions.ts`, `prisma/seed.ts`.

---

### 1. Data model (Prisma → must be preserved exactly)

`prisma/schema.prisma`.

**Enums**
- `Channel` (line 23): `DIRECT | RESELLER`.
- `DealStage` (line 30): `INTEREST_SHOWN | RFI_ANSWERED | RFP_OFFER_GIVEN | CUSTOMER_TEST | CONTRACT_NEGOTIATION | WON | LOST`. Comment (line 29) is load-bearing: "Reseller deals MUST NOT use CONTRACT_NEGOTIATION (enforced in app logic)."
- `DealStatus` (line 40): `OPEN | WON | LOST`.
- `InvoicingModel` (line 56): `ONE_OFF | FIXED_TERM | MONTHLY_RECURRING`.

**`Deal` model** (line 184): `id` (cuid), `accountId`, `ownerRepId`, `name`, `channel Channel @default(DIRECT)`, `stage DealStage @default(INTEREST_SHOWN)`, `probability Int @default(10)` (percent 0-100), `expectedCloseDate DateTime?`, `lastActivityAt DateTime @default(now())`, `status DealStatus @default(OPEN)`, `serviceModel InvoicingModel @default(MONTHLY_RECURRING)`, `notes String?`, `createdAt`, `updatedAt`. Relations: `account` (onDelete Cascade), `ownerRep` (relation `DealOwnerRep`), `forecastPeriods DealForecastPeriod[]`, `offers Offer[]`. Indexes on `accountId`, `ownerRepId`, `stage`.

**`DealForecastPeriod` model** (line 213) — the time-phased row. THIS is where deal value lives; there is NO single amount field on `Deal`. Fields: `id` (cuid), `dealId`, `periodStart DateTime`, `periodEnd DateTime`, `periodLabel String` (e.g. `"2026-Q3"`), `deviceUnits Int @default(0)`, `deviceRevenue Float @default(0)`, `serviceRevenue Float @default(0)`, `totalRevenue Float @default(0)`, `weightedRevenue Float @default(0)`. Relation `deal` (onDelete Cascade). Indexes on `dealId`, `periodLabel`. Comment (line 211): "Time-phased forecast row — NEVER collapse a deal to a single amount. device vs service revenue kept SEPARATE."

> Re-impl note: keep `deviceUnits` as an integer and the four revenue fields as floats. `totalRevenue` and `weightedRevenue` are STORED (denormalized), not computed at read time — read paths trust the stored values. The forecast functions never recompute `totalRevenue` from device+service on read; they only sum stored rows.

---

### 2. The forecast engine — `lib/forecast.ts` (pure, no I/O, no Prisma client — only a TYPE import of `DealStage`)

This file is stack-agnostic already. Port it as a plain TS module; the only Prisma coupling is `import type { DealStage }` (line 5) which can become a local string-union type in TanStack Start.

#### 2a. `STAGE_PROBABILITY` (lines 8-16) — `Record<DealStage, number>`, percent
EXACT values:
1. `INTEREST_SHOWN = 10`
2. `RFI_ANSWERED = 25`
3. `RFP_OFFER_GIVEN = 45`
4. `CUSTOMER_TEST = 70`
5. `CONTRACT_NEGOTIATION = 90`
6. `WON = 100`
7. `LOST = 0`

These are a CONFIGURABLE ASSUMPTION (the brief does not fix them — comment line 3). The `Deal.probability` column mirrors whichever stage the deal is at.

#### 2b. `STAGE_LABEL` (lines 19-27) — `Record<DealStage, string>` for UI
`INTEREST_SHOWN`→"Interest shown", `RFI_ANSWERED`→"RFI answered", `RFP_OFFER_GIVEN`→"RFP / offer given", `CUSTOMER_TEST`→"Customer test", `CONTRACT_NEGOTIATION`→"Contract negotiation", `WON`→"Won", `LOST`→"Lost".

#### 2c. Channel stage lists
- `RESELLER_STAGES` (lines 30-37) = `[INTEREST_SHOWN, RFI_ANSWERED, RFP_OFFER_GIVEN, CUSTOMER_TEST, WON, LOST]` — note **`CONTRACT_NEGOTIATION` is excluded**.
- `DIRECT_STAGES` (lines 39-47) = all 7 stages in order, including `CONTRACT_NEGOTIATION`.

#### 2d. `probabilityForStage(stage)` (line 49) → `STAGE_PROBABILITY[stage] ?? 0`.

#### 2e. `weightedRevenue(stageProb, totalRevenue)` (line 54) — THE CORE WEIGHTING FORMULA
```
return Math.round(totalRevenue * (stageProb / 100))
```
`stageProb` is a percent (0-100). Result is rounded to the nearest integer euro. Edge cases: `LOST` (prob 0) → 0; `WON` (prob 100) → equals total. Used at write-time (deal create, seed) and as a read-time fallback in reporting.

#### 2f. Gross margin (lines 63-69) — blended assumption for aggregated rows
- `DEVICE_GM_PCT = 0.35`, `SERVICE_GM_PCT = 0.55` (fractions 0..1).
- `grossMargin(deviceRevenue, serviceRevenue)` = `Math.round(deviceRevenue * 0.35 + serviceRevenue * 0.55)`.
- Rationale (comment lines 58-64): catalog items carry real per-item `gmPercent`, but aggregated forecast rows aren't item-linked, so a blended device/service margin is applied. Used only by Finance views, NOT stored.

#### 2g. Quarter / period helpers — ALL UTC
- `Quarter` interface (line 73): `{ label: string; year: number; quarter: 1|2|3|4; start: Date; end: Date }`.
- `quarterOf(date)` (line 81) = `Math.floor(date.getUTCMonth() / 3) + 1` → 1..4. **Uses `getUTCMonth`, not local.**
- `quarterLabel(date)` (line 85) = `` `${date.getUTCFullYear()}-Q${quarterOf(date)}` ``.
- `makeQuarter(year, quarter)` (line 89): `startMonth = (quarter-1)*3`; `start = Date.UTC(year, startMonth, 1)`; `end = Date.UTC(year, startMonth+3, 0)` (day 0 of next-quarter's first month = last day of this quarter). `label = "${year}-Q${quarter}"`.
- `quartersFrom(from, count)` (line 97): enumerate `count` consecutive quarters starting at the quarter that CONTAINS `from`. Walks `q` 1→2→3→4→1 (rolling `year += 1` when wrapping to Q1). Returns `Quarter[]` of length `count`. The forecast always calls this with `count = 12` (3 years).

> Re-impl note: every date computation MUST use UTC (`Date.UTC`, `getUTCMonth`, `getUTCFullYear`). Do NOT switch to local-time date math or the quarter a deal lands in can shift by timezone. Labels sort lexicographically because the format is `YYYY-Q?` and `YYYY-H?` and `YYYY` — relied on by `aggregateByQuarter` and `rollUp` sorts.

#### 2h. `ForecastRow` / `QuarterAggregate` shapes (lines 112-128)
`ForecastRow` mirrors `DealForecastPeriod` scalars: `{ periodLabel, deviceUnits, deviceRevenue, serviceRevenue, totalRevenue, weightedRevenue }`. `QuarterAggregate` adds `label` instead of `periodLabel`, same five numeric fields.

#### 2i. `aggregateByQuarter(rows)` (line 134)
Group `ForecastRow[]` by `periodLabel` into a `Map`. For each row, SUM `deviceUnits`, `deviceRevenue`, `serviceRevenue`, `totalRevenue`, `weightedRevenue` into the bucket keyed by label. Return `[...map.values()].sort((a,b) => a.label.localeCompare(b.label))`. Keeps device/service split. Used by deal-detail and reporting.

#### 2j. `Granularity` + `rollUp(quarters, granularity)` (lines 157-191) — Manager toggle
- `Granularity = "quarter" | "half" | "year"`.
- `granularity === "quarter"` → return input unchanged.
- Otherwise split each `label` on `"-Q"` into `[yearStr, qStr]`, `qNum = Number(qStr)`. Bucket key:
  - `"year"` → `yearStr` (e.g. `"2026"`).
  - `"half"` → `` `${yearStr}-H${qNum <= 2 ? 1 : 2}` `` (Q1/Q2→H1, Q3/Q4→H2).
- Sum the five numeric fields into the bucket. Sort by `label.localeCompare`. (Input is assumed already in `YYYY-Q?` form, i.e. the quarter aggregates, not arbitrary labels.)

---

### 3. Server action: `createDeal(formData)` — `app/deals/actions.ts:31-120`

Top of file declares two CONFIGURABLE multipliers (lines 23-24): `YEAR2_GROWTH = 1.2`, `YEAR3_GROWTH = 1.35`. Helper `num(v)` (line 26): `n = Number(v)`; returns `n` if `Number.isFinite(n) && n > 0`, else `0` (negative and non-numeric coerce to 0).

**Step-by-step:**
1. `user = await currentUser()`; if falsy → `redirect("/role-switch")`.
2. Read form fields: `accountId`, `name` (trimmed), `channel` (default `"DIRECT"`), `stage` (default `"INTEREST_SHOWN"`, mutable `let`), `serviceModel` (default `"MONTHLY_RECURRING"`), `closeRaw` (`expectedCloseDate`).
3. Guard: if `!accountId || !name` → `return` (silent no-op, no redirect).
4. **Reseller stage rule (enforcement #1):** `if (channel === "RESELLER" && !RESELLER_STAGES.includes(stage)) stage = "CUSTOMER_TEST"`. (So a reseller deal that somehow arrives at `CONTRACT_NEGOTIATION` is forced to `CUSTOMER_TEST`.)
5. `probability = probabilityForStage(stage)`.
6. `expectedCloseDate = closeRaw ? new Date(closeRaw) : null`.
7. **Year-1 input parse:** for `q ∈ [1,2,3,4]` build `year1[q-1] = { deviceUnits: num(q{q}_units), deviceRevenue: num(q{q}_device), serviceRevenue: num(q{q}_service) }`. Four quarters, three numbers each.
8. **12-quarter generation:** `quarters = quartersFrom(new Date(), 12)`. For each `(qtr, i)`:
   - `base = year1[i % 4]` (year-1 pattern repeats across years 2-3).
   - `growth = i < 4 ? 1 : i < 8 ? YEAR2_GROWTH(1.2) : YEAR3_GROWTH(1.35)`.
   - `deviceUnits = round(base.deviceUnits * growth)`, `deviceRevenue = round(base.deviceRevenue * growth)`, `serviceRevenue = round(base.serviceRevenue * growth)`.
   - `totalRevenue = deviceRevenue + serviceRevenue`; `weightedRevenue = weightedRevenue(probability, totalRevenue)`.
   - Row also carries `periodStart=qtr.start`, `periodEnd=qtr.end`, `periodLabel=qtr.label`.
9. **SERVICE-INVOICING-MODEL reshaping (lines 84-92) — total service is PRESERVED, only the per-quarter SHAPE changes:**
   - `totalService = Σ rows[i].serviceRevenue` (after the projection in step 8).
   - `totalUnits = (Σ rows[i].deviceUnits) || 1` (guard divide-by-zero).
   - For each row `i`:
     - `ONE_OFF` → `serviceRevenue = (i === 0 ? totalService : 0)` (entire service value recognized at a single point — the first quarter).
     - `FIXED_TERM` → `serviceRevenue = round(totalService / rows.length)` (`rows.length` is 12; spread evenly across the term).
     - `MONTHLY_RECURRING` (the `else`) → `serviceRevenue = round(totalService * (row.deviceUnits / totalUnits))` (scales with that quarter's share of the active-device trajectory).
   - After reshaping, RECOMPUTE per row: `totalRevenue = deviceRevenue + serviceRevenue` and `weightedRevenue = weightedRevenue(probability, totalRevenue)`. (Device revenue is untouched; only the service curve is reshaped, then total + weighted are rebuilt.)
   - NOTE on rounding: because `FIXED_TERM`/`MONTHLY_RECURRING` round each quarter independently, the reshaped sum can drift a few euros from `totalService`; this is accepted, not corrected. `ONE_OFF` preserves the total exactly.
10. **Persist:** `prisma.deal.create({ data: { accountId, ownerRepId: user.id, name, channel, stage, probability, serviceModel, expectedCloseDate, status: "OPEN", forecastPeriods: { create: rows } } })` — nested create writes all 12 forecast rows atomically with the deal.
11. **Activity event:** `createActivityEvent({ accountId, actorId: user.id, type: "deal_created", summary: '${user.name} created deal "${name}" (${STAGE_LABEL[stage]}, ${channel.toLowerCase()})', linkedRecordType: "DEAL", linkedRecordId: deal.id })`.
12. `revalidatePath('/accounts/${accountId}')`; then `redirect('/deals/${deal.id}')`.

> Re-impl (TanStack Start): make this a `createServerFn({ method: "POST" })`. Replace `FormData` parsing with the validated input (or read `FormData` from the request — TanStack server fns can accept `FormData`). Replace `redirect()` from `next/navigation` with TanStack's `redirect({ to: "/deals/$id", params: { id } })` thrown from the server fn. `revalidatePath` has no direct equivalent — instead invalidate the relevant TanStack Query keys (account + deal) on the client after the mutation, or rely on router `invalidate()`. The nested `forecastPeriods: { create: rows }` maps 1:1 to whatever data layer you use (Prisma still works; if moving to Drizzle, insert the deal then bulk-insert rows in a transaction). `currentUser()` becomes a server-side session read (see §8).

---

### 4. Server action: `updateDealStage(formData)` — `app/deals/actions.ts:144-185` (stage-change re-weighting)

1. `user = currentUser()`; if falsy → redirect `/role-switch`.
2. Read `dealId`, `stage` (mutable `let`). Guard: `if (!dealId || !stage) return`.
3. `deal = prisma.deal.findUnique({ where: { id: dealId } })`; if not found → `return`.
4. **Reseller stage rule (enforcement #2):** `if (deal.channel === "RESELLER" && !RESELLER_STAGES.includes(stage)) stage = "CUSTOMER_TEST"`.
5. `probability = probabilityForStage(stage)`.
6. **Status derivation:** `status = stage === "WON" ? "WON" : stage === "LOST" ? "LOST" : "OPEN"`. (Moving to WON/LOST flips `Deal.status`, which removes the deal from all `status: "OPEN"` forecast/pipeline queries.)
7. `prisma.deal.update({ where: { id: dealId }, data: { stage, probability, status, lastActivityAt: new Date() } })`. (Updating `lastActivityAt` resets the stalled-deal clock — see §7.)
8. **Re-weight existing forecast rows:** `rows = prisma.dealForecastPeriod.findMany({ where: { dealId } })`; then `Promise.all(rows.map(r => prisma.dealForecastPeriod.update({ where: { id: r.id }, data: { weightedRevenue: weightedRevenue(probability, r.totalRevenue) } })))`. Each row's `totalRevenue` is unchanged; only `weightedRevenue` is recomputed at the new stage probability. NOTE: device/service/total/units are NOT touched — re-weighting never reshapes the curve, it only re-scales the weighted column.
9. **Activity event:** `type: "deal_stage_changed"`, `summary: '${user.name} moved "${deal.name}" to ${STAGE_LABEL[stage]}'`, linked to the deal.
10. `revalidatePath('/deals/${dealId}')` and `revalidatePath('/accounts/${deal.accountId}')`.

> Re-impl: same `createServerFn` pattern. The `Promise.all` row updates should ideally become a single bulk `UPDATE ... SET weightedRevenue = totalRevenue * prob/100` in a transaction for efficiency, but the exact rounding (`Math.round(total * prob/100)` per row) must be preserved — so either compute per-row in app code (as now) or replicate `ROUND()` in SQL. Prefer the app-side loop to keep identical rounding semantics.

---

### 5. Server action: `addDealNote(formData)` — `app/deals/actions.ts:122-142`

1. `user = currentUser()`; falsy → redirect `/role-switch`.
2. Read `dealId`, `body` (trimmed). Guard: `if (!dealId || !body) return`.
3. `deal = findUnique({ where: { id: dealId } })`; if not found → `return`.
4. `prisma.note.create({ data: { parentType: "DEAL", parentId: dealId, authorId: user.id, body } })` (polymorphic note via `parentType`/`parentId`, NOT a FK).
5. `createActivityEvent({ accountId: deal.accountId, actorId: user.id, type: "deal_note_added", summary: '${user.name} noted on "${deal.name}"', linkedRecordType: "DEAL", linkedRecordId: dealId })`.
6. `revalidatePath('/deals/${dealId}')`.

> Re-impl: `Note` is polymorphic (`parentType` enum `ACCOUNT|DEAL|CASE|OFFER` + `parentId` string, no relation). Preserve that — don't introduce a real FK. No redirect; this is a same-page mutation, so after it resolves invalidate the deal route/query.

---

### 6. Pages & form

#### 6a. `app/deals/new/page.tsx` (server component)
Reads `searchParams.accountId` (a Promise in Next 15 — `await searchParams`). If no `accountId` → `notFound()`. Loads `account = prisma.account.findUnique({ where: { id: accountId } })`; if null → `notFound()`. Renders `<DealForm accountId accountName />`. Re-impl: TanStack route `/deals/new` with a loader that reads `?accountId=` from search params, 404s if missing/not-found, passes account to the form component.

#### 6b. `components/deal-form.tsx` (client component) — channel-driven live stage list (enforcement #3)
- `SELECTABLE(stages)` (line 14) = `stages.filter(s => s !== "WON" && s !== "LOST")` — WON/LOST are NEVER selectable on the create form (you start a deal open).
- `channel` state (default `"DIRECT"`). `stages = SELECTABLE(channel === "RESELLER" ? RESELLER_STAGES : DIRECT_STAGES)`. **This is the third enforcement of the reseller rule: when RESELLER is selected, `CONTRACT_NEGOTIATION` is not even rendered as an option.** When channel toggles, the stage `<select>` re-renders without it; helper text "Reseller deals skip Contract negotiation." appears (line 54).
- Form posts to `createDeal` (Next `<form action={createDeal}>`). Hidden `accountId`. Fields: `name` (required), `channel` (radio DIRECT/RESELLER), `stage` (select, default `INTEREST_SHOWN`), `expectedCloseDate` (date), `serviceModel` (select; options in order: `MONTHLY_RECURRING` "Monthly recurring (scales with active devices)", `FIXED_TERM` "Fixed-term (spread evenly across the term)", `ONE_OFF` "One-off (recognised at delivery)"; default `MONTHLY_RECURRING`).
- **Year-1 forecast grid:** 4 rows (Q1..Q4), 3 number inputs each, names `q{q}_units`, `q{q}_device`, `q{q}_service`, all `type="number" min="0" defaultValue="0"`. Header copy (line 83): "Years 2-3 are projected automatically for the 3-year forecast." This is the UI contract behind §3 steps 7-9.

> Re-impl: this is a controlled React form — port near-verbatim. The only stack change: `<form action={serverFn}>` (Next server-action form) becomes either a TanStack `useServerFn` mutation called from `onSubmit`, or a route action. Keep the `channel`-state → filtered-stage-list logic exactly; it is one of the three places the reseller rule lives. Keep the input `name` attributes identical if you continue to read `FormData` server-side.

#### 6c. `app/deals/[id]/page.tsx` (server component) — deal detail
- Loads deal with `include: { account: true, ownerRep: true, forecastPeriods: { orderBy: { periodLabel: "asc" } } }`; `notFound()` if missing.
- Loads notes: `parentType: "DEAL", parentId: id`, `include author`, `orderBy createdAt desc`.
- `quarters = aggregateByQuarter(deal.forecastPeriods)`; `total = Σ q.totalRevenue`; `weighted = Σ q.weightedRevenue`.
- `stageOptions = deal.channel === "RESELLER" ? RESELLER_STAGES : DIRECT_STAGES` — **the move-stage `<select>` uses the channel-filtered list (this is the same rule surfacing in the detail UI; note it does NOT strip WON/LOST here, so a rep CAN move an existing deal to Won/Lost from the detail page).**
- Header badges: Reseller→outline badge, Direct→secondary badge; shows `STAGE_LABEL[stage]`, `probability%`, owner name, and a service-model label map `{ ONE_OFF:"one-off", FIXED_TERM:"fixed-term", MONTHLY_RECURRING:"monthly recurring" }[serviceModel]`, plus close date `toISOString().slice(0,10)` if set.
- 4 stat tiles: "3-yr total" (`formatEUR(total)`), "Weighted" (`formatEUR(weighted)`), "Quarters" (`quarters.length`), "Stage prob." (`probability%`).
- Move-stage form → `updateDealStage`, hidden `dealId`, select `defaultValue={deal.stage}`, help text "Re-weights the forecast at the new stage probability." "Build offer" button links `/offers/new?accountId=...&dealId=...`.
- Forecast table columns: Quarter, Device units, Device €, Service €, Total €, Weighted € (per `q` in `quarters`, all `formatEUR` except units).
- Notes form → `addDealNote`; list shows body + `author.name · createdAt.toISOString().slice(0,16).replace("T"," ")`.

> Re-impl: TanStack route `/deals/$id` with a loader that does the same `findUnique` + notes query and the in-loader `aggregateByQuarter`. The two `<form action={...}>` become TanStack server-fn calls. `formatEUR` (see §8) ports verbatim.

---

### 7. Downstream consumers of the forecast engine (must keep working — they ARE the 3-year views)

These read stored rows; the engine functions are the contract.

**`lib/reporting.ts → threeYearForecast(filter)`** (line 46): queries `dealForecastPeriod.findMany` where parent `deal.status === "OPEN"` (so WON/LOST deals drop out automatically) plus optional `ownerRepId`/`channel` filters on the parent deal, `orderBy periodLabel asc`. Maps each period to a `ForecastRow`, `aggregateByQuarter(rows).slice(0, 12)` (cap at 12 quarters), then sums to `totals` and attaches `grossMargin(totals.deviceRevenue, totals.serviceRevenue)`. Returns `{ quarters, totals: { deviceUnits, deviceRevenue, serviceRevenue, totalRevenue, weightedRevenue, grossMargin } }`. Used by Finance, Manager, and the CSV export.

**`dealWeighted(deal)`** (reporting.ts line 106) — single-deal weighting with FALLBACK: `total = Σ forecastPeriods.totalRevenue`, `storedWeighted = Σ forecastPeriods.weightedRevenue`. If the deal has periods AND `storedWeighted > 0`, return the stored sum. Otherwise fall back to `weightedRevenue(deal.probability || STAGE_PROBABILITY[deal.stage] || 0, total)`. Drives `pipelineByStage`, `pipelineByOwner`, `stalledDeals`, `pastCloseDeals`.

**`pipelineByStage()`** (line 138): OPEN deals grouped by stage → `{ stage, label: STAGE_LABEL, probability: STAGE_PROBABILITY, count, totalRevenue, weightedRevenue }`, sorted by ascending probability. **`pipelineByOwner()`** (line 180): OPEN deals grouped by `ownerRepId` (+name), sorted by descending weighted. **`stalledDeals()`** (line 259): OPEN deals with `daysStalled = daysSince(lastActivityAt) >= 14`, most stale first. **`pastCloseDeals()`** (line 267): OPEN deals with `expectedCloseDate` in the past, soonest-overdue first. **`dealsByStageOwner()`** (line 368): stage×owner matrix; stage order = `Object.keys(STAGE_PROBABILITY)` minus WON/LOST (so iteration order matters — preserve enum declaration order).

**`lib/targets.ts → forecastCategories()`** (line 19): `TEAM_TARGET_3YR = 30_000_000` (configurable). For each OPEN deal: `weighted = Σ forecastPeriods.weightedRevenue`; `stale = daysSince(lastActivityAt) >= 14 || (expectedCloseDate && expectedCloseDate < now)`; `prob = probability || STAGE_PROBABILITY[stage] || 0`. Bucket: `stale → atRisk`; else `prob >= 70 → committed`; else `→ upside`. Returns `{ committed, atRisk, upside, target: 30M, gapToTarget: max(0, target - committed) }`, all rounded. The `>= 70` threshold means CUSTOMER_TEST/CONTRACT_NEGOTIATION/WON count as committed.

**`app/finance/page.tsx`**: role guard — REP/TAM bounce to their own dashboard (`redirect(dashboardPathForRole(user.role))`); only SALES_MANAGER/FINANCE see it. Reads `?owner=`/`?channel=` search params (channel parsed to `DIRECT|RESELLER|undefined`, owner `"all"`→undefined). Calls `threeYearForecast({ ownerRepId, channel })`. KPI tiles: device/service/total revenue, gross margin, `gmPct = totalRevenue>0 ? grossMargin/totalRevenue*100 : 0`, weighted. Filter links preserve the other dimension. 12-column-capped quarterly table where the **GM column is computed inline per quarter via `grossMargin(q.deviceRevenue, q.serviceRevenue)`** (not stored). Footer references `Math.round(DEVICE_GM_PCT*100)`/`SERVICE_GM_PCT*100` = 35%/55%.

**`app/manager/page.tsx`**: same REP/TAM role guard. Reads `?granularity=` (`quarter|half|year`, default quarter). `buckets = rollUp(forecast.quarters, granularity)`. Renders committed/at-risk/target/gap tiles from `forecastCategories()`, KPI strip, stalled/past-close tables (with inline `reassignDeal`), pipeline funnel, pipeline-by-stage/owner bar tables, and the 3-year weighted table over `buckets` with granularity toggle badges linking `/manager?granularity=...`.

**`app/api/export/forecast/route.ts`**: GET → `threeYearForecast()` (no filter), emits CSV header `quarter,device_units,device_revenue,service_revenue,total_revenue,weighted_revenue`, one row per quarter, a `TOTAL` row, `Content-Disposition: attachment; filename="hmd-forecast.csv"`. Re-impl as a TanStack server route / API route returning the same `text/csv` response.

**`app/rep/intake-actions.ts → applyIntake`** (line 16): AI-intake apply path also touches the deal rule — when keeping a draft deal it does `if (channel === "RESELLER" && !RESELLER_STAGES.includes(stage)) stage = "CUSTOMER_TEST"` (line 64) and sets `probability: probabilityForStage(stage)` — but it creates the deal WITHOUT forecast periods (no `forecastPeriods`), so AI-intake deals contribute via the `dealWeighted` fallback path until a forecast is added. Preserve this asymmetry.

**`components/forecast-chart.tsx`**: dependency-free SVG, stacked device+service bars + weighted line over `quarters.slice(0,12)`. Pure presentational; port as a React component (no stack coupling).

---

### 8. Shared helpers the subsystem depends on

- **`lib/forecast.ts`** — pure; port verbatim (drop the `import type { DealStage }` for a local union if not using Prisma client types).
- **`lib/utils.ts`**: `formatEUR(amount, currency="EUR")` uses `Intl.NumberFormat("en-IE", { style:"currency", currency:"EUR", maximumFractionDigits:0 })`; `daysSince(date)` = `Math.round((Date.now()-date.getTime())/86_400_000)`; `daysFromNow` = inverse. Port verbatim.
- **`lib/activity.ts → createActivityEvent(input)`**: inserts one `ActivityEvent` row (`accountId?, actorId?, type, summary, linkedRecordType?, linkedRecordId?`, all nullable except type/summary). Every deal mutation appends one. Port as a server-side data helper.
- **`lib/session.ts → currentUser()`**: reads the `hmd_demo_user` httpOnly cookie; if missing/invalid, falls back to the first REP by email asc (demo never dead-ends). `dashboardPathForRole` maps REP→`/rep`, TAM→`/tam`, SALES_MANAGER→`/manager`, FINANCE→`/finance`. Re-impl: TanStack Start can read cookies via `getWebRequest()`/`getCookie` inside a server fn; replicate the same fallback-to-first-REP behavior or it breaks the role-switch demo. The four-role enum and the REP/TAM redirect guards on Finance/Manager pages must be preserved.

---

### 9. The four invariants that must NOT be lost in migration

1. **A deal has NO single amount.** Value = SUM of 12 `DealForecastPeriod` rows; device and service revenue are stored and aggregated SEPARATELY everywhere (`aggregateByQuarter`, `rollUp`, `threeYearForecast.totals`, the chart, the CSV). Never collapse to one number or merge the two revenue streams.
2. **Reseller hides `CONTRACT_NEGOTIATION`, enforced in 3 places** (must keep all three): the create-form stage list (`deal-form.tsx:18` via `RESELLER_STAGES`), `createDeal` server action (`actions.ts:44`, coerces to `CUSTOMER_TEST`), and `updateDealStage` (`actions.ts:154`, coerces to `CUSTOMER_TEST`). Plus a 4th, milder, surfacing in `intake-actions.ts:64` and the detail-page `stageOptions`.
3. **12-quarter generation rule:** year-1 entered as 4 quarters; years 2-3 = year-1 pattern × growth (`i<4`→1, `i<8`→1.2, else→1.35), then the service curve is reshaped by `serviceModel` (ONE_OFF=Q1 point, FIXED_TERM=even/12, MONTHLY_RECURRING=device-unit share) with `totalService` preserved (modulo per-quarter rounding), then total + `weightedRevenue=round(total×prob/100)` recomputed per row. Constants `YEAR2_GROWTH=1.2`, `YEAR3_GROWTH=1.35`.
4. **Stage-change re-weighting** never reshapes the curve — it only recomputes `weightedRevenue = round(totalRevenue × newProb/100)` on each existing row, updates `Deal.{stage,probability,status,lastActivityAt}`, and derives `status` (WON/LOST/OPEN) from the new stage.

> Seed parity note (`prisma/seed.ts:271-298`): the seed generates forecast rows with a DIFFERENT trajectory model than the form — year ramp factors `[1, 0.55, 0.4]` (not the form's growth multipliers), `deviceUnits = round(devicesYr1/4 × rampFactor)`, and recurring service grows with `cumulativeDevices = round(devicesYr1/4 × (i+1) × 0.8) × monthlyServicePerDevice × 3`. It still uses `quartersFrom(NOW, 12)` and `weightedRevenue(prob, totalRevenue)`. When re-seeding under TanStack Start, replicate this seed math too (it is what populates the demo's Finance/Manager 3-year views — an empty DB is penalized by the brief).

---

I now have a complete picture, including the seed which confirms defaults (`version: 1`) and the five seeded approval states. Writing the spec.

## Offer Builder + Approval State Machine

This subsystem covers the **creation** of an offer (catalog selection, price snapshotting, discount) and the **full approval state machine** (Rep submit → Sales Manager → Finance → Approved/Rejected). In the current app it spans `app/offers/actions.ts` (create + submit), `lib/approval.ts` (the canonical state machine), the offer-builder UI, the offer detail pages, and the approval queue. The goal of this spec is to let a developer re-build it on **TanStack Start** (Vite full-stack React + server functions) against any data layer without losing a single rule.

---

### 1. The Owner → V handoff contract (authoritative)

This contract is written verbatim in two places in the code and MUST be preserved exactly. Source: `app/offers/actions.ts:5-15` and `lib/approval.ts:4-19`.

| Trigger | Resulting `Offer.status` | `locked` | Approval rows | Notifications | ActivityEvent.type |
|---|---|---|---|---|---|
| submit, `discountPercent > 0` | `PENDING_SM` | `true` | create `Approval{ step: SALES_MANAGER, status: PENDING }` | all `SALES_MANAGER` users | `OFFER_SUBMITTED` |
| submit, `discountPercent == 0` | `APPROVED` | `false` (unlocked) | **none** | **none** (see note) | `OFFER_APPROVED` |
| SM approve | `PENDING_FINANCE` | stays `true` | SM row → `APPROVED`; create `Approval{ step: FINANCE, PENDING }` | all `FINANCE` users | `OFFER_SM_APPROVED` |
| Finance approve | `APPROVED` | `false` | Finance row → `APPROVED` | the rep (`createdById`) | `OFFER_APPROVED` |
| reject (SM **or** Finance) | `REJECTED` | `false` (unlocked for revision) | acting row → `REJECTED` + reason | the rep (`createdById`) | `OFFER_REJECTED` |

**Documented divergence to preserve:** the handoff comment in `actions.ts:8` says zero-discount submit yields `status=APPROVED, locked=true` and "rep notified". The actual implementation in `lib/approval.ts:46-60` is the source of truth and differs: it sets **`locked: false`** and fires **no notification** (only the `OFFER_APPROVED` activity event). Re-implement the *code* behavior (unlocked, no notify), not the stale comment.

**Critical boundary:** the create/submit side never directly mutates status into the chain. `createOffer` ALWAYS persists the offer as `DRAFT` first (`actions.ts:63-65`, `status: "DRAFT"`), then calls `submitForApproval(offer.id)` which is the single owner of every transition. Keep this separation: the "builder" only writes a DRAFT; the "state machine" owns all transitions. Do not let the UI compute or set `PENDING_SM`/`APPROVED` itself.

---

### 2. Data shapes (Prisma models / fields touched)

From `prisma/schema.prisma`. These are the exact fields the subsystem reads/writes.

**`Offer`** (`schema.prisma:316-341`)
- `id` (cuid), `accountId` (req), `dealId` (nullable), `version Int @default(1)`, `status OfferStatus @default(DRAFT)`, `subtotal Float @default(0)`, `discountPercent Float @default(0)`, `discountJustification String?`, `total Float @default(0)`, `locked Boolean @default(false)`, `createdById` (req), `createdAt`, `updatedAt @updatedAt`.
- Relations: `account`, `deal?`, `createdBy` (User, relation `OfferCreatedBy`), `lineItems OfferLineItem[]`, `approvals Approval[]`.
- Indexes: `accountId`, `dealId`, `status`.

**`OfferLineItem`** — immutable price snapshot (`schema.prisma:344-357`)
- `id`, `offerId`, `itemType OfferItemType` (`PRODUCT`|`SERVICE`), `itemId` (the original Product/Service id, **string, not a FK** — deliberately decoupled so retired catalog items can't break the offer), `nameSnapshot String`, `unitPriceSnapshot Float`, `quantity Int @default(1)`, `lineTotal Float @default(0)`. Cascade-deletes with offer.

**`Approval`** (`schema.prisma:359-374`)
- `id`, `offerId`, `step ApprovalStep` (`SALES_MANAGER`|`FINANCE`), `status ApprovalStatus @default(PENDING)` (`PENDING`|`APPROVED`|`REJECTED`), `approverId String?`, `comment String?`, `createdAt @default(now())`, `decidedAt DateTime?`.
- Relations: `offer`, `approver User?`. Indexes: `offerId`, `[step, status]`.

**`OfferStatus` enum** (`schema.prisma:85-94`): `DRAFT, SUBMITTED, PENDING_SM, SM_APPROVED, PENDING_FINANCE, FINANCE_APPROVED, APPROVED, REJECTED`. **Note:** `SUBMITTED`, `SM_APPROVED`, `FINANCE_APPROVED` exist in the enum and have UI labels (`offers/[id]/page.tsx:12-21`, `approvals/[offerId]/page.tsx:19-28`) but are **never produced by the state machine** — the chain only ever sets `DRAFT, PENDING_SM, PENDING_FINANCE, APPROVED, REJECTED`. Keep the unused enum members for label completeness but do not invent transitions into them.

**`Product`** (`schema.prisma:231-242`): read fields `id, name, category, unitPrice, status`. **`Service`** (`schema.prisma:244-257`): read fields `id, name, providerType, invoicingModel, basePrice, status`. Only `status === "ACTIVE"` rows are selectable when building a new offer.

**`User`**: `id, name, email, role` (`Role`: `REP, TAM, SALES_MANAGER, FINANCE`). `Notification` and `ActivityEvent` shapes are in §6.

---

### 3. Offer creation — `createOffer(formData)`  (`app/offers/actions.ts:25-95`)

Next.js server action bound to a `<form action={createOffer}>`. Reads a flat `FormData`. Step-by-step:

1. **Auth.** `user = await currentUser()`. If null → `redirect("/role-switch")`. (`actions.ts:26-27`)
2. **Parse fields** (`actions.ts:29-33`):
   - `accountId = String(formData.get("accountId") ?? "")`
   - `dealId = String(formData.get("dealId") ?? "") || null` (empty string coerced to null)
   - `discountPercent = Math.max(0, Math.min(100, Number(formData.get("discountPercent") ?? 0)))` — **clamped to [0,100]**.
   - `discountJustification = String(formData.get("discountJustification") ?? "").trim()`
   - `intent = String(formData.get("intent") ?? "submit")` — either `"draft"` or `"submit"`. Default when absent is `"submit"`.
3. **Guard: missing account** → `redirect("/rep")`. (`actions.ts:34`)
4. **RULE — discount requires justification (create-side):** if `discountPercent > 0 && !discountJustification` → `redirect(\`/offers/new?accountId=${accountId}${dealId?`&dealId=${dealId}`:""}&error=justification\`)`. (`actions.ts:37-39`) Note this is checked **before** persisting anything; it preserves the `accountId`/`dealId` query params and adds `error=justification`.
5. **Load active catalog** in parallel (`actions.ts:42-45`): `prisma.product.findMany({ where: { status: "ACTIVE" } })` and `prisma.service.findMany({ where: { status: "ACTIVE" } })`. RETIRED items are excluded from new offers.
6. **Resolve selected line items + SNAPSHOT prices** (`actions.ts:46-54`):
   - For each active product `p`: `qty = Number(formData.get(\`qty_PRODUCT_${p.id}\`) ?? 0)`. If `qty > 0`, push `{ itemType:"PRODUCT", itemId:p.id, nameSnapshot:p.name, unitPriceSnapshot:p.unitPrice, quantity:qty }`.
   - For each active service `s`: `qty = Number(formData.get(\`qty_SERVICE_${s.id}\`) ?? 0)`. If `qty > 0`, push `{ itemType:"SERVICE", itemId:s.id, nameSnapshot:s.name, unitPriceSnapshot:s.basePrice, quantity:qty }`.
   - **Field-name convention is load-bearing:** quantity inputs are named `qty_PRODUCT_<id>` / `qty_SERVICE_<id>`. Preserve this exact naming, or change both the form and the parser together.
   - **Snapshot semantics:** `unitPriceSnapshot` copies `product.unitPrice` / `service.basePrice` at offer-build time. This is why a later RETIRED or repriced catalog item leaves historical offers correct.
7. **Guard: empty offer** → if `items.length === 0` → `redirect(\`/offers/new?...&error=empty\`)`. (`actions.ts:55-57`)
8. **Compute totals** (`actions.ts:59-60`):
   - `subtotal = Σ (unitPriceSnapshot * quantity)` (raw float, not rounded).
   - `total = Math.round(subtotal * (1 - discountPercent / 100))` — rounded to whole units.
   - per-line `lineTotal = Math.round(unitPriceSnapshot * quantity)` (`actions.ts:81`).
9. **Persist as DRAFT** with nested line-item create (`actions.ts:63-85`):
   - `status:"DRAFT"`, `locked:false`, `subtotal`, `discountPercent`, `discountJustification: discountPercent > 0 ? discountJustification : null` (justification is **nulled** when no discount, even if the form supplied text), `total`, and `lineItems.create: [...]`. `createdById = user.id`. `version` defaults to 1.
10. **Submit if requested** (`actions.ts:89-91`): if `intent === "submit"`, `await submitForApproval(offer.id)`. If `intent === "draft"`, the offer stays `DRAFT`/unlocked and no chain starts.
11. **Revalidate + redirect** (`actions.ts:93-94`): `revalidatePath(\`/accounts/${accountId}\`)`, then `redirect(\`/offers/${offer.id}\`)`.

**Edge cases to preserve:** discount clamps to 0–100; justification trimmed and only stored when discount > 0; empty/no-account/no-justification each redirect back with a distinct `error` code rather than throwing; `Number(... ?? 0)` means non-numeric qty becomes `NaN` → `NaN > 0` is false → item skipped (defensive).

---

### 4. The state machine — `lib/approval.ts`

This is the single source of truth for every transition. Full diagram (`approval.ts:5-9`):

```
DRAFT --submit(discount>0)--> PENDING_SM --smApprove--> PENDING_FINANCE --financeApprove--> APPROVED
DRAFT --submit(discount==0)--------------------------------------------------------------> APPROVED (no chain)
            PENDING_SM --smReject--> REJECTED            PENDING_FINANCE --financeReject--> REJECTED
```

`usersByRole(role)` helper (`approval.ts:27-29`): `prisma.user.findMany({ where: { role } })` where role ∈ `{SALES_MANAGER, FINANCE}` — the notification fan-out target list.

#### 4.1 `submitForApproval(offerId)` (`approval.ts:37-96`)
1. Load offer by id; throw `"Offer not found"` if missing.
2. **RULE (state-machine side):** if `discountPercent > 0 && !discountJustification?.trim()` → throw `"Discount requires justification"`. (Defense-in-depth; the create-side already redirected, but this guard must also exist here.)
3. **Branch A — `discountPercent === 0`** (`approval.ts:46-60`): single `prisma.offer.update` → `status:"APPROVED", locked:false`. Append ActivityEvent `OFFER_APPROVED`, summary `"Offer auto-approved (no discount) — <€total>"`, `accountId=offer.accountId`, `actorId=offer.createdById`, linked OFFER. **No approval row, no notification.** Return updated offer.
4. **Branch B — `discountPercent > 0`** (`approval.ts:63-95`): **`$transaction([ ... ])` (atomic):**
   - `offer.update → status:"PENDING_SM", locked:true`
   - `approval.create → { offerId, step:"SALES_MANAGER", status:"PENDING" }`
   - After the transaction commits: ActivityEvent `OFFER_SUBMITTED`, summary `"Offer submitted for approval — <discountPercent>% discount, <€total>"`, actor = `offer.createdById`.
   - `notify()` to **every** Sales Manager (`usersByRole("SALES_MANAGER")`, fired via `Promise.all`): title `"Offer awaiting your approval"`, body `"An offer with a <d>% discount (<€total>) needs Sales Manager approval."`, linked OFFER.
   - Return updated offer.

#### 4.2 `smApprove(offerId, approverId, comment?)` (`approval.ts:103-152`)
1. Load offer; throw `"Offer not found"` if missing.
2. **Status guard:** if `status !== "PENDING_SM"` → throw `"Offer is not pending Sales Manager approval"`.
3. Find the pending SM approval: `approval.findFirst({ where:{ offerId, step:"SALES_MANAGER", status:"PENDING" } })`; if none → throw `"No pending Sales Manager approval found"`.
4. **`$transaction` (atomic, 3 writes):**
   - `offer.update → status:"PENDING_FINANCE", locked:true` (stays locked).
   - `approval.update(smApproval.id) → status:"APPROVED", approverId, comment: comment ?? null, decidedAt: new Date()`.
   - `approval.create → { offerId, step:"FINANCE", status:"PENDING" }`.
5. ActivityEvent `OFFER_SM_APPROVED`, summary `"Sales Manager approved offer — routed to Finance"` + `": <comment>"` appended **only if** `comment?.trim()` is non-empty. Actor = `approverId`.
6. `notify()` every Finance user: title `"Offer awaiting Finance approval"`, body `"A Sales-Manager-approved offer (<d>% discount, <€total>) needs Finance approval."`, linked OFFER.
7. Return updated offer.

#### 4.3 `smReject(offerId, approverId, comment)` (`approval.ts:158-200`)
1. Load offer; throw if missing.
2. **Status guard:** `status !== "PENDING_SM"` → throw `"Offer is not pending Sales Manager approval"`.
3. **RULE — reason required:** `if (!comment?.trim()) throw "Rejection requires a reason"`.
4. Find pending SM approval (same query as above); throw if none.
5. **`$transaction` (atomic):** `offer.update → status:"REJECTED", locked:false` (UNLOCKS for revision); `approval.update → status:"REJECTED", approverId, comment, decidedAt: new Date()` (comment stored raw, not nulled).
6. ActivityEvent `OFFER_REJECTED`, summary `"Sales Manager rejected offer: <comment.trim()>"`, actor = `approverId`.
7. `notify()` **the rep only** (`offer.createdById`): title `"Offer rejected by Sales Manager"`, body `"Your offer was rejected and unlocked for revision. Reason: <comment.trim()>"`, linked OFFER.

#### 4.4 `financeApprove(offerId, approverId, comment?)` (`approval.ts:206-247`)
1. Load offer; throw if missing.
2. **HARD FINANCE-AFTER-SM GUARD:** `if (offer.status !== "PENDING_FINANCE") throw "Finance cannot approve before Sales Manager"`. This is the single line that makes Finance structurally unable to jump ahead of SM — the only way to reach `PENDING_FINANCE` is through `smApprove`. Preserve this exact guard and message.
3. Find pending Finance approval: `findFirst({ where:{ offerId, step:"FINANCE", status:"PENDING" } })`; throw `"No pending Finance approval found"` if none.
4. **`$transaction` (atomic):** `offer.update → status:"APPROVED", locked:false` (final approval UNLOCKS); `approval.update → status:"APPROVED", approverId, comment: comment ?? null, decidedAt: new Date()`.
5. ActivityEvent `OFFER_APPROVED`, summary `"Finance approved offer — fully approved"` + `": <comment>"` only if `comment?.trim()`. Actor = `approverId`.
6. `notify()` the rep (`offer.createdById`): title `"Offer approved"`, body `"Your offer (<€total>) was fully approved by Finance."`, linked OFFER.

#### 4.5 `financeReject(offerId, approverId, comment)` (`approval.ts:253-295`)
1. Load offer; throw if missing.
2. **Status guard:** `status !== "PENDING_FINANCE"` → throw `"Offer is not pending Finance approval"`.
3. **RULE — reason required:** `if (!comment?.trim()) throw "Rejection requires a reason"`.
4. Find pending Finance approval; throw if none.
5. **`$transaction`:** `offer.update → status:"REJECTED", locked:false`; `approval.update → status:"REJECTED", approverId, comment, decidedAt: new Date()`.
6. ActivityEvent `OFFER_REJECTED`, summary `"Finance rejected offer: <comment.trim()>"`, actor = `approverId`.
7. `notify()` the rep: title `"Offer rejected by Finance"`, body `"Your offer was rejected and unlocked for revision. Reason: <comment.trim()>"`, linked OFFER.

#### 4.6 `money()` helper (`approval.ts:298-304`)
EUR formatter used in every activity/notification string: `Intl.NumberFormat("en-IE", { style:"currency", currency:"EUR", maximumFractionDigits:0 })`. Locale `en-IE`, no decimals (e.g. `€19,800`). Keep identical so copy matches `formatEUR` in `lib/utils.ts:9-13`.

---

### 5. The locking model (consolidated rules)

`Offer.locked` is the edit guard. Exact rules across the machine:

1. DRAFT (created): `locked:false`.
2. Submit, discount > 0 → `PENDING_SM`, `locked:true`.
3. SM approve → `PENDING_FINANCE`, `locked:true` (stays locked through the whole pending window).
4. SM reject / Finance reject → `REJECTED`, `locked:false` (unlocked so the rep can revise and resubmit).
5. Finance approve → `APPROVED`, `locked:false`.
6. Submit, discount == 0 → `APPROVED`, `locked:false`.

So: **locked is true exactly while status ∈ {PENDING_SM, PENDING_FINANCE}** ("locked while pending"); every terminal/draft state is unlocked. The UI surfaces this as a 🔒 badge (`offers/[id]/page.tsx:56`: `{offer.locked && "🔒 locked while in approval"}`; `approvals/[offerId]/page.tsx:93-97`). Note: the current code does NOT add a separate edit endpoint that reads `locked` — there is no offer-edit action in this subsystem, so `locked` is currently advisory/visual. When re-implementing, if you add an edit path, it MUST refuse when `locked === true`.

---

### 6. Notifications + Activity events fired (full inventory)

Every transition writes one ActivityEvent and zero-or-more Notifications. Helpers: `notify()` (`lib/notify.ts:15-25`) creates a `Notification` row; `createActivityEvent()` (`lib/activity.ts:16-29`) creates an `ActivityEvent` row.

**`Notification` shape** (`schema.prisma:376-390`): `recipientId, title, body, linkedRecordType (e.g. "OFFER"), linkedRecordId, readAt DateTime?, createdAt`.
**`ActivityEvent` shape** (`schema.prisma:299-314`): `accountId?, actorId?, type (string), summary, linkedRecordType?, linkedRecordId?, createdAt`.

| Transition | ActivityEvent.type | actorId | Notification recipients |
|---|---|---|---|
| submit, discount=0 | `OFFER_APPROVED` | rep (`createdById`) | none |
| submit, discount>0 | `OFFER_SUBMITTED` | rep | all `SALES_MANAGER` |
| smApprove | `OFFER_SM_APPROVED` | approver | all `FINANCE` |
| smReject | `OFFER_REJECTED` | approver | rep only |
| financeApprove | `OFFER_APPROVED` | approver | rep only |
| financeReject | `OFFER_REJECTED` | approver | rep only |

All ActivityEvents carry `accountId = offer.accountId`, `linkedRecordType:"OFFER"`, `linkedRecordId:offer.id`. The exact title/body strings are listed per-function in §4 — reproduce them verbatim; the demo narrative depends on this copy.

---

### 7. The approval-queue action wrappers (`app/approvals/actions.ts:17-47`)

Four thin server actions sit between the UI and the state machine. Each: resolves `currentUser()`, enforces a **role check**, delegates to the machine, then `revalidatePath("/approvals")` + `revalidatePath(\`/approvals/${offerId}\`)` (`actions.ts:12-15`).

1. `approveAsSM(offerId, comment)` — requires `user.role === "SALES_MANAGER"` else throw `"Only a Sales Manager can approve this step"`; calls `smApprove(offerId, user.id, comment?.trim() || undefined)`. (`actions.ts:17-23`)
2. `rejectAsSM(offerId, comment)` — same role check (reject message); calls `smReject(offerId, user.id, comment)` (comment passed raw; the machine validates non-empty). (`actions.ts:25-31`)
3. `approveAsFinance(offerId, comment)` — requires `user.role === "FINANCE"`; calls `financeApprove(offerId, user.id, comment?.trim() || undefined)`. (`actions.ts:33-39`)
4. `rejectAsFinance(offerId, comment)` — requires `FINANCE`; calls `financeReject(offerId, user.id, comment)`. (`actions.ts:41-47`)

**Two-layer authorization to preserve:** the action layer checks the *actor's role*; the machine layer checks the *offer's status*. Both must remain. The `approverId` is always derived server-side from the session (`user.id`) — never trusted from the client.

`currentUser()` (`lib/session.ts:15-29`) reads the `hmd_demo_user` cookie; falls back to the first `REP` (ordered by email) so the app never dead-ends. `currentRole()` returns `user?.role ?? null`.

---

### 8. UI read-side (pages) — behaviors to reproduce

- **`/offers/new`** (`app/offers/new/page.tsx`): server-loads `account`, optional `deal`, and active `products`/`services` ordered `name asc`. Maps products → `{id, name, price: unitPrice, meta: category}` and services → `{id, name, price: basePrice, meta: "<3rd-party|internal> · <invoicing label>"}` where the invoicing label comes from `INVOICING_LABEL = {ONE_OFF:"one-off", FIXED_TERM:"fixed-term", MONTHLY_RECURRING:"monthly recurring"}` (`new/page.tsx:8-12`). `notFound()` if no `accountId` or account missing.
- **OfferBuilder** (`components/offer-builder.tsx`): client form computing a **live** subtotal/total client-side (`subtotal = Σ price*qty`, `total = round(subtotal*(1-discount/100))`, `offer-builder.tsx:35-38`) purely for display; the server recomputes authoritatively. Two submit buttons share the form: `name="intent" value="draft"` (Save draft) and `value="submit"` (Submit for approval) (`offer-builder.tsx:136-137`). Justification field shows a red `*` when `discount > 0` (`:109-110`). Renders `error=justification` and `error=empty` banners (`:66-75`). Discount input clamps 0–100 client-side too (`:104`).
- **`/offers/[id]`** (`app/offers/[id]/page.tsx`): read-only detail. Includes `lineItems`, `approvals` (with `approver`, ordered `createdAt asc`). Shows status badge (`STATUS_LABEL` map, `statusVariant`), 🔒 badge when locked, line items from snapshots, subtotal/discount/total, justification (only when discount>0), and approval history (or "No approvals needed (no discount).").
- **`/approvals`** (`app/approvals/page.tsx`): **role-routed queue.** `queueStatus = role==="SALES_MANAGER" ? "PENDING_SM" : role==="FINANCE" ? "PENDING_FINANCE" : null` (`page.tsx:34-35`). Null role → read-only "available to Sales Managers and Finance" card. Otherwise `offer.findMany({ where:{ status: queueStatus }, include:{account,deal,createdBy}, orderBy:{ updatedAt:"asc" } })` — **oldest-waiting first**. Each row shows account, deal, submitter, discount badge (**`destructive` when `discountPercent >= 20` else `warning`**, `:98`), truncated justification (60 chars, `:17-21`), total, "waiting" age via `daysSince`/`submittedAgo` (`:23-28`), and a "Review →" link. `export const dynamic = "force-dynamic"`.
- **`/approvals/[offerId]`** (`app/approvals/[offerId]/page.tsx`): full detail + decision panel. **Gating:** `canActAsSM = role==="SALES_MANAGER" && status==="PENDING_SM"`; `canActAsFinance = role==="FINANCE" && status==="PENDING_FINANCE"` (`:81-82`). Renders `<DecisionPanel step="SM"|"FINANCE">` only when the matching gate is true; otherwise a contextual read-only message per status (`:193-203`). Shows full approval history table with `decidedAt` formatted `en-IE medium/short`.
- **DecisionPanel** (`app/approvals/decision-panel.tsx`): shared comment textarea. **Client-side guard:** reject with empty/whitespace comment → inline error `"A rejection reason is required."` and does not call the server (`:32-35`). Approve allows empty comment. On success clears the textarea and `router.refresh()`. Catches thrown errors and shows `e.message`. Button label for SM approve is "Approve & route to Finance"; Finance is "Approve offer" (`:71`).

---

### 9. Re-implementation notes — Next server actions + Prisma → TanStack Start

**Server functions.** Each Next server action maps 1:1 to a TanStack Start `createServerFn`:
- `createOffer` → `createServerFn({ method: "POST" })`. The current action consumes raw `FormData`; in TanStack Start either keep `FormData` (pass `.formData()` and parse the same `qty_PRODUCT_<id>` keys) or define a validated input object `{ accountId, dealId?, discountPercent, discountJustification, intent, items: [{itemType,itemId,quantity}] }`. If you switch to a typed object, the **server must still re-resolve catalog prices** (do NOT trust client-sent prices) — snapshot `unitPrice`/`basePrice` server-side exactly as in `actions.ts:47-54`. Keep clamping `discountPercent` to [0,100] and the justification/empty guards.
- `submitForApproval`, `smApprove`, `smReject`, `financeApprove`, `financeReject` → keep as plain async functions in a `lib/approval` module called *from* server functions; they are framework-agnostic already (only depend on the data layer + notify/activity helpers). Port them nearly verbatim.
- `approveAsSM/rejectAsSM/approveAsFinance/rejectAsFinance` → server functions that read the session, enforce the role check, delegate, then invalidate queries.

**Redirects.** Next's `redirect()` (`createOffer`) becomes a returned `redirect({ to: "/offers/$id", params })` (TanStack Router) or a `throw redirect(...)` from the server fn. The error-redirect pattern (`?error=justification|empty`) can become either the same query-param redirect or a typed error result the form renders inline — pick one and keep all three error codes distinguishable.

**Cache invalidation.** `revalidatePath("/accounts/...")`, `revalidatePath("/approvals")`, `revalidatePath("/approvals/<id>")` and the `router.refresh()` calls map to TanStack Query `queryClient.invalidateQueries()` on the affected route loaders (offers list, approvals queue, offer detail) and/or `router.invalidate()`. Replicate the same fan-out: after any transition invalidate the queue, the offer detail, and the account timeline.

**`force-dynamic`.** The two `export const dynamic = "force-dynamic"` pages just mean "no static caching"; in TanStack Start this is the default for server-loaded routes — drop the directive, ensure the loader runs per request.

**`$transaction` atomicity (non-negotiable).** Every state-changing branch wraps its multi-row writes in `prisma.$transaction([...])`: submit-with-discount (lock + create SM approval), smApprove (offer update + SM approval update + Finance approval create), and all rejects/finance-approve (offer update + approval update). These MUST stay atomic — a partial write (e.g. offer flips to PENDING_FINANCE but the Finance approval row isn't created) corrupts the machine and the queue. If the new data layer is still Prisma, keep `$transaction`. If it's a different ORM/driver, wrap each branch in a single DB transaction with the same write set. Note `createActivityEvent`/`notify` currently run **after** the transaction commits (not inside it) — they're best-effort side effects; preserve that ordering (state first, then notify/log) so a notification failure can't roll back an approval.

**Session/role.** `currentUser()`/`currentRole()` read a cookie (`hmd_demo_user`) with a REP fallback. In TanStack Start, read the session in the server fn context (cookie/header). Keep `approverId` derived server-side only. Keep the demo-fallback-to-first-REP behavior if the role-switch demo flow is retained.

**Snapshots & retired items.** `OfferLineItem.itemId` is intentionally a plain string, not a foreign key — this is what lets RETIRED catalog items remain correct on historical offers (seed offer #4 deliberately embeds a retired product, `seed.ts:436-450`). Do not add a FK constraint from line item → product/service in the migration.

**Helpers to port verbatim:** `notify()` (creates Notification), `createActivityEvent()` (creates ActivityEvent), and the local `money()`/`formatEUR()` (`en-IE`, EUR, 0 decimals). The exact notification titles/bodies and activity summaries are part of the demo and must be reproduced character-for-character.

**Seed parity.** The seed builds five offers, one per terminal/pending state (`seed.ts:391-460`): DRAFT (no discount, unlocked), PENDING_SM (12%, locked, SM approval PENDING + SM notified), PENDING_FINANCE (8%, locked, SM approval APPROVED + Finance approval PENDING + Finance notified), APPROVED (5%, unlocked, both approvals APPROVED, includes a retired-product snapshot), REJECTED (22%, unlocked, reason stored). `version` defaults to 1 everywhere. Re-create equivalent seed data so the approval queue is non-empty on first load (empty-DB is penalized per project rules).

---

### Relevant files (absolute paths)
- `/Users/huataipan/Wichai/Hackathons/sales-hackathons-prompt/lib/approval.ts` — state machine (canonical)
- `/Users/huataipan/Wichai/Hackathons/sales-hackathons-prompt/app/offers/actions.ts` — createOffer + submit
- `/Users/huataipan/Wichai/Hackathons/sales-hackathons-prompt/components/offer-builder.tsx` — builder UI
- `/Users/huataipan/Wichai/Hackathons/sales-hackathons-prompt/app/offers/new/page.tsx` — build-offer page loader
- `/Users/huataipan/Wichai/Hackathons/sales-hackathons-prompt/app/offers/[id]/page.tsx` — offer detail (read-only)
- `/Users/huataipan/Wichai/Hackathons/sales-hackathons-prompt/app/approvals/page.tsx` — role-routed queue
- `/Users/huataipan/Wichai/Hackathons/sales-hackathons-prompt/app/approvals/[offerId]/page.tsx` — approval detail + gating
- `/Users/huataipan/Wichai/Hackathons/sales-hackathons-prompt/app/approvals/actions.ts` — role-guarded action wrappers
- `/Users/huataipan/Wichai/Hackathons/sales-hackathons-prompt/app/approvals/decision-panel.tsx` — approve/reject panel
- `/Users/huataipan/Wichai/Hackathons/sales-hackathons-prompt/prisma/schema.prisma` — Offer/OfferLineItem/Approval/Notification/ActivityEvent models (lines 85-110, 316-390)
- `/Users/huataipan/Wichai/Hackathons/sales-hackathons-prompt/lib/notify.ts`, `lib/activity.ts`, `lib/session.ts`, `lib/utils.ts` — side-effect + session + format helpers
- `/Users/huataipan/Wichai/Hackathons/sales-hackathons-prompt/prisma/seed.ts:391-460` — five seeded offers across all approval states

---

I now have the complete picture. Let me write the exhaustive migration spec.

## Cases + SLA + TAM Subsystem

This subsystem covers the case (support ticket) lifecycle for HMD Secure's TAM (Technical Account Manager) persona: the TAM work-queue dashboard, the case-detail page with two note tiers and an activity timeline, SLA due-date computation/classification, and the six case mutations (create, add note, change status, close, escalate, reassign). All source paths below are absolute under the repo root `/Users/huataipan/Wichai/Hackathons/sales-hackathons-prompt`.

**Files in scope**

| File | Role |
|---|---|
| `lib/cases.ts` | Read-only Prisma selects: `casesForTam`, `caseDetail`, `caseNotes`, `caseActivity`, `PRIORITY_RANK` |
| `lib/sla.ts` | `SLA_DAYS`, `slaDueDate`, `slaStatus`, `slaLabel`, `SlaStatus` type |
| `app/cases/actions.ts` | Six server actions: `addCaseNote`, `changeCaseStatus`, `closeCase`, `escalateCase`, `createCase`, `reassignCase` |
| `app/cases/new/page.tsx` | "Open a service case" form (Rep persona) |
| `app/cases/[id]/page.tsx` | Case detail page + inline server-action adapters |
| `app/tam/page.tsx` | TAM dashboard (work queue) |
| `lib/activity.ts` | `createActivityEvent` (shared, do not re-implement here but must exist) |
| `lib/notify.ts` | `notify` (shared, in-app notifications only) |
| `lib/session.ts` | `currentUser()` (active demo user) |
| `lib/ai/case-summary.ts` + `components/case-summary-card.tsx` | AI case summary (P2 #22) |
| `prisma/seed.ts` (L303–389) | Seed data: 12 cases, threaded notes, activity events |

---

### 1. Data shapes (Prisma models touched)

From `prisma/schema.prisma`:

**`Case`** (L259–282) — the central entity:
- `id` String (cuid)
- `accountId` String (required, FK → Account, `onDelete: Cascade`)
- `serviceId` String? (nullable, FK → Service)
- `assignedTamId` String? (nullable, FK → User via relation `"CaseAssignedTam"`)
- `title` String (required)
- `description` String? (nullable)
- `status` `CaseStatus` enum, default `OPEN`
- `priority` `Priority` enum, default `MEDIUM`
- `customerContactId` String? (nullable, FK → Contact via relation `"CaseCustomerContact"`)
- `createdAt` DateTime, default now
- `updatedAt` DateTime, @updatedAt
- `closedAt` DateTime? (nullable — set when closed, cleared when reopened)
- `dueDate` DateTime? (nullable — SLA target, P2 #18)
- Indexes: `accountId`, `assignedTamId`, `status`

**Enums:**
- `CaseStatus` (L62): `OPEN | IN_PROGRESS | ESCALATED | CLOSED`
- `Priority` (L69): `LOW | MEDIUM | HIGH | CRITICAL` (note: declared LOW→CRITICAL, but the **semantic** queue order is CRITICAL→LOW; the enum's lexical order is NOT the display order — see §3.1)
- `NoteParentType` (L76): `ACCOUNT | DEAL | CASE | OFFER`

**`Note`** (L284–297) — threaded case notes:
- `id`, `parentType` `NoteParentType`, `parentId` String, `authorId` String (FK → User relation `"NoteAuthor"`), `body` String, `internal` Boolean default `false`, `createdAt` DateTime default now
- Index: `[parentType, parentId]`
- Notes are **polymorphic** (parentType/parentId pattern). Case notes are `parentType = "CASE"`, `parentId = caseId`.

**`ActivityEvent`** (L299–314) — append-only account timeline:
- `id`, `accountId` String? (FK → Account, cascade), `actorId` String? (FK → User), `type` String (free text, e.g. `"CASE_CLOSED"`), `summary` String, `linkedRecordType` String?, `linkedRecordId` String?, `createdAt` DateTime default now
- Indexes: `accountId`, `createdAt`
- Note: events are anchored to the **account**, not the case. The case timeline is reconstructed by querying all events for `accountId` and flagging those whose `linkedRecordId === caseId`.

**`Notification`** (L376–390) — in-app inbox:
- `id`, `recipientId` String (FK → User, cascade), `title` String, `body` String, `linkedRecordType` String?, `linkedRecordId` String?, `readAt` DateTime?, `createdAt` DateTime default now
- Indexes: `recipientId`, `readAt`

**Related models read for joins:** `User` (id, name, email, role), `Account` (id, name, ownerRepId, assignedTamId, region, segment, industry…), `Contact` (id, name, title, email, isPrimary, decisionRole), `Service` (id, name, status `CatalogStatus`).

---

### 2. SLA logic (`lib/sla.ts`)

#### 2a. What it does + why
Cases get an SLA due date derived from priority at creation time. The UI highlights cases that are overdue or about to breach so the TAM works the right queue first. This is a "CONFIGURABLE ASSUMPTION" (the team owns the day windows; HMD did not specify exact numbers).

#### 2b. EXACT business rules
1. **`SLA_DAYS` constant** (L7–12) maps each priority to a day window from `createdAt`:
   - `CRITICAL` → **2** days
   - `HIGH` → **4** days
   - `MEDIUM` → **8** days
   - `LOW` → **15** days
2. **`slaDueDate(createdAt, priority)`** (L17–19): returns `new Date(createdAt.getTime() + SLA_DAYS[priority] * 86400000)`. `86400000` = ms in one day. No timezone math — pure epoch-ms addition.
3. **`slaStatus(dueDate, closedAt)`** (L22–29) returns one of `"overdue" | "approaching" | "ok" | "none"`:
   1. If `dueDate` is null/undefined → `"none"` (case has no SLA target).
   2. Else if `closedAt` is truthy → `"ok"` (closed cases are **never flagged** overdue/approaching, regardless of `dueDate`).
   3. Else compute `days = (dueDate.getTime() - Date.now()) / 86400000` (fractional days, **not** rounded).
   4. If `days < 0` → `"overdue"`.
   5. Else if `days <= 2` → `"approaching"` ("approaching" window is **2 days or fewer remaining**, inclusive of exactly 2).
   6. Else → `"ok"`.
4. **`slaLabel(status)`** (L31–37): `"overdue"` → `"Overdue"`, `"approaching"` → `"Due soon"`, everything else (`ok`/`none`) → `"On track"`.
5. Edge case: `slaStatus` uses `Date.now()` at call time — it is **dynamic**, evaluated on each render. The case-detail page is `force-dynamic` and the TAM dashboard is `force-dynamic`, so this is never cached. Re-implementation must preserve "evaluated server-side per request" — do NOT precompute and cache the status, or overdue badges go stale.

#### 2c. Type
`export type SlaStatus = "overdue" | "approaching" | "ok" | "none"`.

#### 2d. Re-implementation notes
Pure functions, zero dependencies on Prisma or framework. **Port `lib/sla.ts` verbatim** into the TanStack Start codebase (e.g. `src/lib/sla.ts`). The only coupling is the `Priority` type import from `@prisma/client` — replace with whatever enum/union the new data layer exposes (a `"LOW" | "MEDIUM" | "HIGH" | "CRITICAL"` string union is sufficient). Keep the constants exactly: `{ CRITICAL: 2, HIGH: 4, MEDIUM: 8, LOW: 15 }` and the `<= 2` approaching threshold.

---

### 3. Case query helpers (`lib/cases.ts`)

#### 3.1 `PRIORITY_RANK` (L8–13) and queue ordering
- `PRIORITY_RANK` = `{ CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 }`. Lower number = higher priority = sorts first.
- **Rule:** Prisma/SQL cannot order the `Priority` enum semantically (an enum sorts lexically: CRITICAL, HIGH, LOW, MEDIUM — wrong). So the DB query orders by `createdAt asc` and the result is **re-sorted in memory** by `PRIORITY_RANK`.

#### 3.2 `casesForTam(tamId)` (L21–32)
- (a) **What/why:** all cases assigned to one TAM, for their work queue, with account + service joined.
- (b) **Rules:**
  1. Filter: `where: { assignedTamId: tamId }`.
  2. Include: `account` (full) and `service` (full, nullable).
  3. DB order: `orderBy: { createdAt: "asc" }` (oldest first — this is the **stable secondary sort key**).
  4. In-memory re-sort comparator: `PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]` **OR** (when priorities tie) `a.createdAt.getTime() - b.createdAt.getTime()`. Net effect: **primary = priority CRITICAL→LOW, secondary = age oldest-first**.
- (c) Output: array of `Case & { account: Account; service: Service | null }`.
- (d) Re-impl: a server function `casesForTam(tamId)`. The two-stage sort (DB by createdAt, then in-memory by priority rank) MUST be preserved — do not push priority ordering into the SQL `ORDER BY` naively.

#### 3.3 `caseDetail(id)` (L35–45)
- Returns `prisma.case.findUnique({ where: { id }, include: { account, service, customerContact, assignedTam } })`.
- Returns `null` if not found (caller does `notFound()` → 404).
- Output: `Case & { account; service|null; customerContact|null; assignedTam|null }`.

#### 3.4 `caseNotes(caseId)` (L51–57)
- `prisma.note.findMany({ where: { parentType: "CASE", parentId: caseId }, include: { author: true }, orderBy: { createdAt: "desc" } })`.
- **Rules:** (1) only `CASE`-parented notes; (2) **newest first** (`desc`); (3) join the author so the UI shows name + role. NOTE: this is the opposite order from how the AI summary consumes notes (oldest-first) — see §6.
- Output: `Note[] & { author: User }`.

#### 3.5 `caseActivity(accountId, take = 30)` (L64–71)
- `prisma.activityEvent.findMany({ where: { accountId }, include: { actor: true }, orderBy: { createdAt: "desc" }, take })`.
- **Rules:** (1) scoped by **account**, not case — surfaces the broader account timeline for context; (2) newest first; (3) default cap **30** rows; (4) actor joined.
- The case page distinguishes case-specific rows at render time: an event "is on this case" iff `e.linkedRecordType === "CASE" && e.linkedRecordId === id` (page L344–345) — those get a filled primary dot, others a muted dot.

#### Re-implementation notes for §3
These are read queries. Map each to a TanStack Start server function (`createServerFn`) or a server-side loader. The `include`/join shapes must be preserved exactly because the pages destructure `account.name`, `service?.name`, `customerContact.name/title/email`, `assignedTam.name`, `author.name/role`, `actor`. If moving off Prisma, the data layer must return the same nested objects. Preserve: oldest-first DB sort + in-memory priority re-sort in `casesForTam`; newest-first ordering in `caseNotes`/`caseActivity`; the 30-row cap.

---

### 4. Server actions (`app/cases/actions.ts`)

**Shared infrastructure used by every action:**
- `currentUser()` — resolves the active demo user from the `hmd_demo_user` httpOnly cookie; falls back to the first `REP` (Sofia) ordered by email (`lib/session.ts` L15–29). Many actions tolerate a null user (`user?.id ?? null`).
- `createActivityEvent({ accountId, actorId, type, summary, linkedRecordType, linkedRecordId })` — inserts one `ActivityEvent` row (`lib/activity.ts`). All optional fields default to null.
- `notify({ recipientId, title, body, linkedRecordType, linkedRecordId })` — inserts one `Notification` row. **In-app only — BUILD-SPEC hard rule: no outbound email** (`lib/notify.ts` L1).
- `revalidateCase(caseId)` (L24–27) — calls `revalidatePath('/cases/${caseId}')` and `revalidatePath('/tam')`. Every mutation that can change a case re-validates both the detail page and the TAM queue.
- `STATUS_LABEL` (L16–21): `{ OPEN: "Open", IN_PROGRESS: "In progress", ESCALATED: "Escalated", CLOSED: "Closed" }` — used only in the status-change activity summary.

#### 4.1 `addCaseNote(caseId, body, internal)` (L30–64)
- (a) **What:** add a threaded note (working OR internal tier) to a case.
- (b) **Rules:**
  1. `const trimmed = body.trim()`; if empty after trim → **return silently** (no-op, no error). (L35–36)
  2. Resolve `user = currentUser()`. Resolve `kase = case by id`; if not found → return. (L38–40)
  3. The note tier is a single boolean `internal` — `true` = internal note (not shown to customer), `false` = working/visible note.
- (c) **Writes:**
  1. `prisma.note.create({ data: { parentType: "CASE", parentId: caseId, authorId: user!.id, body: trimmed, internal } })`. (L42–50) Note: `authorId: user!.id` — non-null asserted; if `currentUser()` returns null this throws. In practice the demo fallback guarantees a user.
  2. `createActivityEvent` on `kase.accountId`, actor = `user?.id ?? null`, **type = `internal ? "CASE_NOTE_INTERNAL" : "CASE_NOTE_ADDED"`**, summary = `` `${user?.name ?? "Someone"} added ${internal ? "an internal note" : "a note"} to case "${kase.title}"` ``, linked to `CASE`/`caseId`. (L52–61)
- (d) **Notify:** NONE. Adding a note does not notify anyone.
- (e) `revalidateCase(caseId)`. No redirect.

#### 4.2 `changeCaseStatus(caseId, status)` (L67–91)
- (a) **What:** set a case to any of OPEN / IN_PROGRESS / ESCALATED / CLOSED via the status dropdown.
- (b) **Rules:**
  1. Resolve user + case. **Guard:** if `!kase || kase.status === status` → return (no-op when status is unchanged). (L70)
  2. **closedAt side-effect:** `closedAt: status === "CLOSED" ? new Date() : null`. Setting status to CLOSED stamps `closedAt = now`; setting it to ANY other status (including reopening) **clears `closedAt` back to null**. (L76–78) This is the only place that can reopen/clear a closed case's timestamp.
- (c) **Writes:** `prisma.case.update` with `{ status, closedAt }`; then `createActivityEvent` type `"CASE_STATUS_CHANGED"`, summary `` `${user?.name ?? "Someone"} changed case "${kase.title}" status to ${STATUS_LABEL[status]}` ``, linked CASE/caseId. (L72–88)
- (d) **Notify:** NONE.
- (e) `revalidateCase(caseId)`.

#### 4.3 `closeCase(caseId)` (L94–128)
- (a) **What:** dedicated close action (the big "Close case" button), distinct from the status dropdown because it **notifies the account owner**.
- (b) **Rules:**
  1. Resolve user + `case including account`. **Guard:** if `!kase || kase.status === "CLOSED"` → return (idempotent — already-closed is a no-op). (L100)
  2. Sets `status: "CLOSED", closedAt: new Date()`. (Does not touch other fields.)
- (c) **Writes:** `prisma.case.update` → CLOSED + closedAt; `createActivityEvent` type `"CASE_CLOSED"`, summary `` `${user?.name ?? "Someone"} closed case "${kase.title}"` ``. (L102–114)
- (d) **Notify (conditional):** if `kase.account.ownerRepId` is set AND `ownerRepId !== user?.id` (don't notify yourself) → `notify({ recipientId: ownerRepId, title: "Case closed", body: `Case "${kase.title}" on ${kase.account.name} was closed by ${user?.name ?? "the TAM"}.`, linkedRecordType: "CASE", linkedRecordId: caseId })`. (L117–125)
- (e) `revalidateCase(caseId)`.

#### 4.4 `escalateCase(caseId)` (L131–164)
- (a) **What:** escalate the case to a 3rd party (status = ESCALATED). Mirrors `closeCase`'s notify pattern.
- (b) **Rules:**
  1. Resolve user + `case including account`. **Guard:** if `!kase || kase.status === "ESCALATED"` → return (no-op when already escalated). (L137)
  2. Sets `status: "ESCALATED"` only. **Does NOT set or clear `closedAt`.** (L139–142)
- (c) **Writes:** update status; `createActivityEvent` type `"CASE_ESCALATED"`, summary `` `${user?.name ?? "Someone"} escalated case "${kase.title}" to a 3rd party` ``. (L144–151)
- (d) **Notify (conditional):** same owner-guard as close — if `ownerRepId` set AND `!== user?.id` → `notify({ title: "Case escalated", body: `Case "${kase.title}" on ${kase.account.name} was escalated to a 3rd party by ${user?.name ?? "the TAM"}.`, linked CASE/caseId })`. (L153–161)
- (e) `revalidateCase(caseId)`.

> Note: "escalate to 3rd party" is modeled purely as a status flip + activity + owner notification. There is **no** third-party vendor record, ticket number, or external integration in the data model — the vendor ticket detail lives only in free-text notes (seed example: "Opened vendor ticket HMD-4471").

#### 4.5 `createCase(formData)` (L170–224) — create-from-account
- (a) **What:** Rep opens a new service case from inside an account (persona #5). Defaults the TAM + customer contact from the account and computes the SLA due date.
- (b) **Rules / parsing:**
  1. `user = currentUser()`; if `!user` → `redirect("/role-switch")`. (L171–172)
  2. `accountId = String(formData.get("accountId") ?? "")`; `title = String(formData.get("title") ?? "").trim()`. **Guard:** if `!accountId || !title` → `redirect(accountId ? "/accounts/${accountId}" : "/rep")` (bounce back to the account, or to the rep dashboard if even the account is missing). (L174–176)
  3. `description = String(formData.get("description") ?? "").trim() || null` (empty → null). (L178)
  4. `priority = String(formData.get("priority") ?? "MEDIUM") as Priority` — **default MEDIUM**. (L179)
  5. `serviceId = String(formData.get("serviceId") ?? "") || null` (empty string → null). (L180)
  6. Load `account` with `include: { contacts: { where: { isPrimary: true }, take: 1 } }`. If `!account` → `redirect("/rep")`. (L182–186)
- (c) **Defaulting from account (the key logic):**
  - `assignedTamId: account.assignedTamId ?? null` — case inherits the account's TAM.
  - `customerContactId: account.contacts[0]?.id ?? null` — case inherits the account's **primary** contact (the one with `isPrimary: true`).
  - `status: "OPEN"` (always).
  - `dueDate: slaDueDate(now, priority)` where `now = new Date()` — SLA due date from priority via `lib/sla.ts`. (L188–201)
- (d) **Writes / notify / redirect:**
  1. `prisma.case.create` with the data above. (L189–201)
  2. `createActivityEvent({ accountId, actorId: user.id, type: "CASE_OPENED", summary: `${user.name} opened a case: ${title}`, linkedRecordType: "CASE", linkedRecordId: kase.id })`. (L203–210)
  3. **Notify (conditional):** if `account.assignedTamId` is set → `notify({ recipientId: account.assignedTamId, title: "New case assigned", body: `${title} (${priority.toLowerCase()} priority) on ${account.name}.`, linked CASE/kase.id })`. (Notifies the assigned TAM, NOT the rep. No self-check here.) (L211–219)
  4. `revalidatePath('/accounts/${accountId}')` + `revalidatePath('/tam')`, then **`redirect('/cases/${kase.id}')`** — lands on the new case's detail page. (L221–223)

#### 4.6 `reassignCase(formData)` (L227–257) — reassign between TAMs
- (a) **What:** Sales Manager (persona #3) reassigns a case to a different TAM.
- (b) **Rules:**
  1. `user = currentUser()`; if `!user` → `redirect("/role-switch")`. (L228–229)
  2. `caseId`, `tamId` from form. **Guard:** if `!caseId || !tamId` → return. (L231–233)
  3. Load case; if missing → return. (L235–236)
  4. Load target user by `tamId`. **Guard:** if `!tam || tam.role !== "TAM"` → return. **Only users with role TAM can be assigned** — the dropdown is populated with TAMs, but the action re-validates the role server-side. (L237–238)
- (c) **Writes:** `prisma.case.update({ where: { id: caseId }, data: { assignedTamId: tamId } })`; `createActivityEvent({ accountId: kase.accountId, actorId: user.id, type: "CASE_REASSIGNED", summary: `${user.name} reassigned "${kase.title}" to ${tam.name}`, linked CASE/caseId })`. (L240–248)
- (d) **Notify (unconditional):** `notify({ recipientId: tamId, title: "Case reassigned to you", body: `${kase.title} is now yours.`, linked CASE/caseId })` — always notifies the new TAM (no self-check). (L249–255)
- (e) `revalidateCase(caseId)`. No redirect — stays on the case page.

#### 4.7 Activity-type + notification reference table

| Action | Status write | closedAt | Activity `type` | Activity summary | notify recipient / title | Guard |
|---|---|---|---|---|---|---|
| addCaseNote | — | — | `CASE_NOTE_INTERNAL` (if internal) else `CASE_NOTE_ADDED` | "… added an internal note / a note to case …" | none | empty body → noop; case missing → noop |
| changeCaseStatus | any of 4 | now if CLOSED, else **null** | `CASE_STATUS_CHANGED` | "… changed case … status to {label}" | none | same status → noop |
| closeCase | CLOSED | now | `CASE_CLOSED` | "… closed case …" | account ownerRep (if set & not self) / "Case closed" | already CLOSED → noop |
| escalateCase | ESCALATED | untouched | `CASE_ESCALATED` | "… escalated case … to a 3rd party" | account ownerRep (if set & not self) / "Case escalated" | already ESCALATED → noop |
| createCase | OPEN | — | `CASE_OPENED` | "{user} opened a case: {title}" | account assignedTam (if set) / "New case assigned" | no accountId/title → redirect away |
| reassignCase | — | — | `CASE_REASSIGNED` | "{user} reassigned … to {tam}" | new TAM (always) / "Case reassigned to you" | target not role TAM → noop |

---

### 5. Pages

#### 5.1 TAM dashboard — `app/tam/page.tsx`
- `export const dynamic = "force-dynamic"` (L15) — never cached; SLA badges must be live.
- **Load:** `user = currentUser()`; `all = user ? casesForTam(user.id) : []`. (L63–65) The dashboard always shows **the current user's** cases (whatever their role). Non-TAM users see an amber banner: "You are viewing the TAM dashboard as {role}. These are cases assigned to you." (L88–93)
- **Status filter** (`?status=` query param):
  - `STATUS_FILTERS` (L17–23): `ALL, OPEN, IN_PROGRESS, ESCALATED, CLOSED`.
  - `activeFilter` = the query value if it matches a known filter, else `"ALL"`. (L67–69)
  - Filtering is **in-memory** on `all`: `ALL` → everything; otherwise `all.filter(c => c.status === activeFilter)`. (L71–74)
  - Each filter pill shows a count: `ALL` → `all.length`; each status → count of that status in `all`. Links: `ALL` → `/tam`, others → `/tam?status={value}`. (L98–119)
- **Header stats:** `openCount = all.filter(c => c.status !== "CLOSED").length`; subtitle = `Cases assigned to {user.name} — {openCount} open, {all.length} total.` (L76, L84–87)
- **Table columns** (L137–176): Title (link → `/cases/${c.id}`), Account (`c.account.name`), Service (`c.service?.name ?? "—"`), Priority badge, Status badge, SLA badge, Age (`daysSince(c.createdAt)` + "d", right-aligned tabular-nums).
- **Badge variant maps:**
  - `priorityBadge` (L25–35): CRITICAL→`destructive`, HIGH→`warning`, MEDIUM→`secondary`, LOW→`outline`.
  - `statusBadge` (L45–55): CLOSED→`secondary`, ESCALATED→`destructive`, IN_PROGRESS→`default`, OPEN(else)→`warning`. Label = `status.replaceAll("_", " ")`.
  - `slaBadge(dueDate, closedAt)` (L37–43): calls `slaStatus`; `none`→plain "—"; `overdue`→destructive badge "Overdue"; `approaching`→secondary badge "Due soon"; `ok`→plain muted "On track".
- Empty-state copy: "No cases match this filter." (L133–135)

#### 5.2 Case detail — `app/cases/[id]/page.tsx`
- `export const dynamic = "force-dynamic"` (L27).
- **Load:** `kase = caseDetail(id)`; if null → `notFound()` (404). Then `Promise.all([caseNotes(id), caseActivity(kase.accountId), prisma.user.findMany({ where: { role: "TAM" }, orderBy: { name: "asc" }, select: { id, name } })])` — the TAM list feeds the reassign dropdown. (L80–87)
- `isClosed = kase.status === "CLOSED"` (L89).
- **Inline server-action adapters** (L92–115) bind `id` and read FormData:
  - `addNoteAction`: `body = formData.get("body")`, `internal = formData.get("internal") === "on"` (checkbox), then `addCaseNote(id, body, internal)`.
  - `changeStatusAction`: `status = formData.get("status")`; only calls `changeCaseStatus(id, status)` if `STATUS_OPTIONS.includes(status)` (whitelist guard). `STATUS_OPTIONS` = `["OPEN","IN_PROGRESS","ESCALATED","CLOSED"]` (L36–41).
  - `closeAction`: `closeCase(id)`. `escalateAction`: `escalateCase(id)`.
  - Reassign uses the imported `reassignCase` directly as the form action (caseId passed via hidden input, L210–211).
- **Header** (L119–160): breadcrumb "My cases / Case", title, status badge, priority badge, "Opened {daysSince(createdAt)}d ago" + (if closed) "· closed {fmt(closedAt)}". Two buttons: "Escalate to 3rd party" (`variant=outline`, **disabled when status === ESCALATED**) and "Close case" (`variant=destructive`, **disabled when isClosed**).
- **Details card** (L175–270): Account, Linked service (`service?.name ?? "—"`), Customer contact (`name · title` + email block, or "—"), Assigned TAM (`assignedTam?.name ?? "Unassigned"` + inline reassign form), **SLA due** (`kase.dueDate ? dueDate.toISOString().slice(0,10) : "—"` i.e. **YYYY-MM-DD**, plus a `destructive` "Overdue" or `secondary` "Due soon" badge per `slaStatus(dueDate, closedAt)`), Description (`description?.trim() || "No description provided."`), and the change-status form.
  - Reassign form (L210–219): hidden `caseId`, a `<select name="tamId">` defaulted to `assignedTamId ?? ""` with a disabled placeholder "Reassign to…" plus one option per TAM, and a "Reassign" submit button.
- **Notes card** (L272–329): header "Notes ({notes.length})". Add-note form with required `<textarea name="body">`, an `internal` checkbox labeled "Internal note (not shown to customer)", and "Add note" submit. Then the threaded list (newest first per `caseNotes`): each note shows author name, role badge (`ROLE_LABEL`: REP→"Sales Rep", TAM→"TAM", SALES_MANAGER→"Sales Manager", FINANCE→"Finance"), and **if internal** a warning "Internal" badge + amber styling (`border-amber-200 bg-amber-50`), plus formatted timestamp and body. Empty state "No notes yet." (L302–304)
- **Activity card** (right column, L333–367): renders `caseActivity` newest-first. Each row gets a colored dot — **filled `bg-primary` if the event is on this case** (`linkedRecordType === "CASE" && linkedRecordId === id`), else muted `bg-muted-foreground/40`. Shows timestamp + summary. Empty state "No activity yet."
- **AI summary** (L165–174): rendered ONLY if `notes.length >= MIN_NOTES_FOR_SUMMARY` (=5), inside `<Suspense fallback={<CaseSummarySkeleton/>}>`. See §6.
- **Formatting helpers:** `fmt(date)` (L67–72) uses `Intl.DateTimeFormat("en-IE", { dateStyle: "medium", timeStyle: "short" })`. SLA due uses ISO date slice (YYYY-MM-DD). `daysSince` for ages.

#### 5.3 New-case form — `app/cases/new/page.tsx`
- Reads `?accountId=` from searchParams; if absent → `notFound()`. (L14–15)
- `Promise.all([prisma.account.findUnique({ where: { id: accountId }, include: { assignedTam: true } }), prisma.service.findMany({ where: { status: "ACTIVE" }, orderBy: { name: "asc" } })])`. If account null → `notFound()`. **Only ACTIVE services** are selectable. (L16–20)
- Form `action={createCase}` with hidden `accountId`. Fields: Title (required), Description (textarea), Priority `<select>` defaulting to **MEDIUM** with options Low/Medium/High/Critical, Linked service `<select>` defaulting to "" ("— none —") + one option per active service. Helper line: "Will be assigned to {assignedTam?.name ?? 'the account TAM'} with an SLA due date from priority." Submit "Open case". (L30–71)

---

### 6. AI case summary (`lib/ai/case-summary.ts` + `components/case-summary-card.tsx`)

- (a) **What/why:** a one-paragraph AI summary so a colleague can pick up a case cold. Read-only — never mutates the case.
- (b) **Rules:**
  1. `MIN_NOTES_FOR_SUMMARY = 5`. Card renders only when `notes.length >= 5` (gate is in the page, §5.2).
  2. `caseSummary({ title, description, notes })` builds a numbered thread `notes.map((n,i) => "${i+1}. ${n}").join("\n")`. **Notes are passed oldest-first** — the page passes `notes.map(n => n.body)` from `caseNotes` which is newest-first, so the AI receives them newest-first despite the "(oldest first)" label in the prompt. (This is an existing quirk; preserve behavior or fix consciously.)
  3. Calls `aiText({ system, user, maxTokens: 200 })`. System prompt: "You are a TAM assistant for HMD Secure. Summarise this support case in ONE short paragraph (≤3 sentences)… what the issue is, where it stands now, and the next step. Plain prose, no markdown, no lists." User = `Case: {title}\n{description ?? ""}\nNotes (oldest first):\n{thread}`.
  4. If `aiText` returns text → `{ text, source: "ai" }`.
  5. **Deterministic fallback** (no key, or AI failure): `text = `${title}. It began: "${first}" Latest update: "${last}" (${notes.length} notes on file.)`` where `first = notes[0]`, `last = notes[notes.length-1]`; `source: "fallback"`.
- (c) **AI client (`lib/ai/client.ts`):** `hasAI()` = `Boolean(process.env.FEATHERLESS_API_KEY)`. `aiText` returns null when no key or on any error (never throws). Featherless is OpenAI-compatible (`baseURL` default `https://api.featherless.ai/v1`, model default `Qwen/Qwen2.5-7B-Instruct`, temp 0.4). Handles reasoning-models that put output in `message.reasoning` instead of `message.content`.
- (d) **Card:** badge shows "AI" when `source === "ai"`, else "AI · rules". `CaseSummarySkeleton` is the Suspense fallback.

---

### 7. Seed data the migration must reproduce (`prisma/seed.ts` L303–389)

Empty DB is penalized (CLAUDE.md). The migration must seed equivalent realistic data:
1. **12 cases** (`caseSpecs`, L309–322) across all 4 statuses and 4 priorities, assigned to two TAMs (`timo`, `lena`), each with account, service, title, description, `ageDays`, and (for the 2 CLOSED) `closedDaysAgo`.
2. Per case: `createdAt = daysAgo(ageDays)`; `dueDate = createdAt + SLA_DAYS[priority]*86400000` (L329 mirrors `lib/sla.ts`, fallback 8 for unknown); `customerContactId = primary contact of the account`; `closedAt = daysAgo(closedDaysAgo)` for closed cases.
3. Per case: a `CASE_OPENED` activity event at `createdAt`; for closed cases, a `CASE_CLOSED` event at `closedDaysAgo`.
4. **Threaded notes on the first 2 cases** (L357–388): 6 and 5 notes respectively (both ≥5 so the AI summary triggers). Each note's `createdAt = daysAgo(max(0, ageDays - j))` (progressively newer). **Internal-tier heuristic:** `internal = /vendor|engineering|qa|hotfix|internal/i.test(noteBody)` — coordination/vendor notes are flagged internal. Each note also emits a `CASE_NOTE_ADDED` activity event on the account timeline.

---

### 8. Re-implementation notes (Next server actions + Prisma → TanStack Start)

1. **Server actions → server functions.** Each of the six mutations becomes a TanStack Start `createServerFn({ method: "POST" })` with a validator. Next reads `FormData` directly (`createCase`, `reassignCase`) or takes typed args (`addCaseNote(caseId, body, internal)`). In TanStack Start, define explicit input schemas (zod) — `createCase` input = `{ accountId, title, description?, priority?, serviceId? }`; `addCaseNote` = `{ caseId, body, internal }`; etc. The HTML forms in the pages can post to these via `<form>` + a small handler, or be converted to controlled React forms calling the server fn.
2. **`revalidatePath` → router invalidation.** `revalidateCase` calls `revalidatePath('/cases/${id}')` + `revalidatePath('/tam')`. In TanStack Start, after a mutation invalidate the corresponding route loaders (`router.invalidate()` / queryClient invalidation for the case-detail and TAM-queue loaders). Preserve: every mutation refreshes BOTH the case page and the TAM queue.
3. **`redirect()` → TanStack redirects.** `createCase` redirects to `/cases/${kase.id}` on success and bounces to `/accounts/${accountId}` or `/rep` on validation failure; both `createCase` and `reassignCase` redirect to `/role-switch` when there's no user. Use TanStack's `redirect()` thrown from the server fn (or `throw redirect(...)`).
4. **`notFound()` → 404.** `caseDetail` null and missing-account cases throw `notFound()`. Map to TanStack's `notFound()` / a 404 route.
5. **`force-dynamic` → no-cache loaders.** Both pages are `force-dynamic` because `slaStatus`/`daysSince` are time-relative. Ensure the TanStack loaders are not statically cached; SLA classification must run server-side per request.
6. **Prisma → data layer.** If keeping Prisma, server functions can import it directly (Vite SSR supports it). If swapping, the new layer must return the exact nested shapes the pages destructure (see §3). Keep the **two-stage sort** of `casesForTam` (DB `createdAt asc` + in-memory `PRIORITY_RANK` re-sort) — do not naively `ORDER BY priority` since the enum sorts lexically.
7. **Session.** `currentUser()` reads an httpOnly cookie (`hmd_demo_user`) and falls back to the first REP. In TanStack Start, read the cookie in the server fn / `beforeLoad` context. Keep the null-tolerant pattern (`user?.id ?? null`, `user?.name ?? "Someone"/"the TAM"`).
8. **Polymorphic notes.** Notes use `(parentType, parentId)`. Preserve the polymorphic key — case notes are `parentType="CASE"`. Don't introduce a dedicated `caseId` FK unless you migrate every Note parent type.
9. **Activity is account-anchored, not case-anchored.** The case timeline is reconstructed by querying `ActivityEvent` by `accountId` and flagging `linkedRecordId === caseId`. Keep this — don't add a `caseId` column to ActivityEvent; the page logic depends on showing the broader account timeline with case rows highlighted.
10. **Shared `notify`/`createActivityEvent`.** These are cross-subsystem (offers, deals, etc. also call them). Port them once into the shared data layer; do not duplicate per subsystem. `notify` is **in-app only — never send email** (hard rule).
11. **Preserve every guard exactly:** no-op-on-unchanged-status, idempotent close/escalate, empty-note-body noop, `tam.role !== "TAM"` reassign guard, the close/escalate "don't notify yourself" check (`ownerRepId !== user?.id`), and the `closedAt` clear-on-reopen behavior in `changeCaseStatus`. These are load-bearing business rules, not incidental.

**Files referenced (absolute):** `/Users/huataipan/Wichai/Hackathons/sales-hackathons-prompt/lib/cases.ts`, `/lib/sla.ts`, `/lib/activity.ts`, `/lib/notify.ts`, `/lib/session.ts`, `/lib/utils.ts`, `/lib/ai/case-summary.ts`, `/lib/ai/client.ts`, `/app/cases/actions.ts`, `/app/cases/new/page.tsx`, `/app/cases/[id]/page.tsx`, `/app/tam/page.tsx`, `/components/case-summary-card.tsx`, `/prisma/schema.prisma`, `/prisma/seed.ts`.

---

I have everything I need. Let me verify one quirk in role naming — the catalog page guards on `role !== "FINANCE"` and the session Role enum uses `SALES_MANAGER` (not `SM`). Let me confirm the TAM dashboard exists for cases-by-* context and check there's no separate role label mismatch. I have enough. Writing the spec now.

## Catalog + Reporting + Targets + Dashboards

This subsystem covers (1) the Finance-owned product/service **catalog** with retire/reactivate, (2) the **reporting/aggregation** layer (`lib/reporting.ts`) that powers Manager/Finance/Reports, (3) the **targets** decomposition (`lib/targets.ts`), and (4) the four **role dashboards** (`/rep`, `/manager`, `/finance`, `/reports`). All numeric logic ultimately flows through `lib/forecast.ts` (stage probabilities, weighting, gross-margin, quarter math) which is shared and must be ported verbatim. Source files referenced: `lib/catalog.ts`, `lib/reporting.ts`, `lib/targets.ts`, `lib/forecast.ts`, `app/catalog/{page.tsx,actions.ts}`, `app/{rep,manager,finance,reports}/page.tsx`, `app/manager/actions.ts`, `app/api/export/{forecast,cases}/route.ts`, `components/{forecast-chart,pipeline-funnel,forecast-narrative-card}.tsx`, plus `prisma/schema.prisma`, `lib/{utils,activity,session}.ts`.

---

### 0. Shared constants & primitives (`lib/forecast.ts`) — port these EXACTLY first

Everything below depends on these. They are CONFIGURABLE ASSUMPTIONS (the brief does not fix them) but the current app's numbers are load-bearing for the demo.

**0.1 `STAGE_PROBABILITY: Record<DealStage, number>`** (`forecast.ts:8-16`) — percent, integer:
- `INTEREST_SHOWN: 10`
- `RFI_ANSWERED: 25`
- `RFP_OFFER_GIVEN: 45`
- `CUSTOMER_TEST: 70`
- `CONTRACT_NEGOTIATION: 90`
- `WON: 100`
- `LOST: 0`

**0.2 `STAGE_LABEL: Record<DealStage, string>`** (`forecast.ts:19-27`): `INTEREST_SHOWN`→"Interest shown", `RFI_ANSWERED`→"RFI answered", `RFP_OFFER_GIVEN`→"RFP / offer given", `CUSTOMER_TEST`→"Customer test", `CONTRACT_NEGOTIATION`→"Contract negotiation", `WON`→"Won", `LOST`→"Lost".

**0.3 Stage lists** (`forecast.ts:30-47`):
- `RESELLER_STAGES` = `[INTEREST_SHOWN, RFI_ANSWERED, RFP_OFFER_GIVEN, CUSTOMER_TEST, WON, LOST]` — **excludes `CONTRACT_NEGOTIATION`** (reseller rule).
- `DIRECT_STAGES` = all 7 stages (includes `CONTRACT_NEGOTIATION`).

**0.4 `weightedRevenue(stageProb, totalRevenue)`** (`forecast.ts:54-56`): `Math.round(totalRevenue * (stageProb / 100))`. `stageProb` is a percent (e.g. 45). RESULT IS ROUNDED.

**0.5 Gross-margin blended assumptions** (`forecast.ts:63-69`):
- `DEVICE_GM_PCT = 0.35`
- `SERVICE_GM_PCT = 0.55`
- `grossMargin(deviceRevenue, serviceRevenue)` = `Math.round(deviceRevenue * 0.35 + serviceRevenue * 0.55)`. NOTE: this is the **aggregate/blended** GM used by the forecast (forecast rows are not item-linked). Catalog items carry their own per-item `gmPercent` (see §1) which is displayed but NOT used in this aggregate.

**0.6 Quarter math** (`forecast.ts:81-107`), all UTC:
- `quarterOf(date)` = `Math.floor(date.getUTCMonth() / 3) + 1` → 1..4.
- `quarterLabel(date)` = `` `${date.getUTCFullYear()}-Q${quarterOf(date)}` `` → e.g. `"2026-Q3"`.
- `makeQuarter(year, q)` → `{ label, year, quarter, start: Date.UTC(year, (q-1)*3, 1), end: Date.UTC(year, (q-1)*3+3, 0) }` (end = last day of quarter).
- `quartersFrom(from, count)` enumerates `count` consecutive quarters starting at the quarter containing `from`, incrementing year on Q4→Q1 wrap.

**0.7 `aggregateByQuarter(rows: ForecastRow[]): QuarterAggregate[]`** (`forecast.ts:134-155`): group rows by `periodLabel`; per bucket SUM `deviceUnits, deviceRevenue, serviceRevenue, totalRevenue, weightedRevenue`. Output sorted by `label.localeCompare` (lexicographic, which works because labels are `YYYY-Qn`).

**0.8 `rollUp(quarters, granularity)`** (`forecast.ts:160-191`), `Granularity = "quarter" | "half" | "year"`:
- `"quarter"`: return input unchanged.
- Split each label on `"-Q"` → `[yearStr, qStr]`, `qNum = Number(qStr)`.
- `"year"`: bucket key = `yearStr`.
- `"half"`: bucket key = `` `${yearStr}-H${qNum <= 2 ? 1 : 2}` `` (Q1/Q2→H1, Q3/Q4→H2).
- SUM all five metrics into the bucket; sort by `label.localeCompare`.

**0.9 `daysSince(date)`** (`utils.ts:32-34`): `Math.round((Date.now() - date.getTime()) / 86_400_000)`. **`daysFromNow(date)`** (`utils.ts:26-29`): `Math.round((date.getTime() - Date.now()) / 86_400_000)`.

**0.10 `formatEUR(amount, currency="EUR")`** (`utils.ts:9-23`): `Intl.NumberFormat("en-IE", { style:"currency", currency, maximumFractionDigits:0 })`. No decimals anywhere. Re-implement identically so demo numbers match.

---

### 1. Catalog query helpers (`lib/catalog.ts`)

**What/why:** The offer builder MUST reuse `activeProducts()/activeServices()` so RETIRED items never appear in NEW offers, while the catalog "all" view and historical offer snapshots keep retired items visible. **Retire ≠ hard-delete.**

Prisma models: `Product { id, sku@unique, name, category, unitPrice:Float, gmPercent:Float@default(0.35), currency@default("EUR"), status:CatalogStatus@default(ACTIVE), createdAt, updatedAt }`; `Service { id, name, providerType:ProviderType, invoicingModel:InvoicingModel, basePrice:Float, gmPercent:Float@default(0.55), currency@default("EUR"), status:CatalogStatus@default(ACTIVE), createdAt, updatedAt, cases:Case[] }`. Enums: `CatalogStatus = ACTIVE|RETIRED`, `ProviderType = INTERNAL|THIRD_PARTY`, `InvoicingModel = ONE_OFF|FIXED_TERM|MONTHLY_RECURRING`.

**Business rules / exact queries:**
1. `activeProducts()` (`catalog.ts:10-15`): `where status="ACTIVE"`, `orderBy [{category:asc},{name:asc}]`.
2. `activeServices()` (`catalog.ts:18-23`): `where status="ACTIVE"`, `orderBy {name:asc}`.
3. `allProducts()` (`catalog.ts:26-30`): no filter, `orderBy [{status:asc},{category:asc},{name:asc}]`. `status:asc` puts `ACTIVE` before `RETIRED` (alphabetical on the enum string).
4. `allServices()` (`catalog.ts:33-37`): no filter, `orderBy [{status:asc},{name:asc}]`.

**Re-impl note:** these are pure reads → TanStack Start server functions (or loader queries) returning the rows. Keep the exact `orderBy` tuples; the UI relies on the ACTIVE-before-RETIRED ordering and on `gmPercent` being a 0..1 fraction.

---

### 2. Catalog management page (`app/catalog/page.tsx`) — Finance-only

**What/why:** Finance can Add/Edit/Retire/Reactivate products & services WITHOUT a developer. Route `/catalog`.

**Business rules:**
1. **Role guard** (`page.tsx:60-63`): `currentRole()`; if `role !== "FINANCE"` → `redirect("/role-switch")`. (Only FINANCE.)
2. **`showRetired` toggle** (`page.tsx:65-66`): from `searchParams.retired`; `showRetired = (retired === "1")`. Link toggles between `/catalog` and `/catalog?retired=1`.
3. Load `allProducts()` + `allServices()` in parallel (`page.tsx:68`).
4. **Visible filtering** (`page.tsx:70-75`): if `showRetired` show all; else filter to `status==="ACTIVE"` only.
5. **Retired counts** (`page.tsx:77-78`): count `status==="RETIRED"` for products and services separately; header shows `retiredProductCount + retiredServiceCount` + "retired".
6. Card titles show `visibleProducts.length` and append `" active"` only when NOT showing retired (`page.tsx:106-107,180-181`).
7. **Product columns:** SKU, Name (editable input), Category (editable), Unit price (editable number + currency input, with a `formatEUR` preview line), GM % = `Math.round(p.gmPercent * 100)` + "%" (read-only, right-aligned, `page.tsx:305-307`), Status badge, Actions.
8. **Service columns:** Name (editable), Provider (`<select>` INTERNAL/THIRD_PARTY), Invoicing (`<select>` ONE_OFF/FIXED_TERM/MONTHLY_RECURRING), Base price (editable + currency), GM % = `Math.round(s.gmPercent * 100)` + "%", Status badge, Actions.
9. **Status badge** (`page.tsx:47-53`): RETIRED → outline "Retired"; else success "Active". Retired rows render at `opacity-60`.
10. **Provider/invoicing labels** (`page.tsx:33-42`): `INTERNAL`→"Internal", `THIRD_PARTY`→"3rd-party"; `ONE_OFF`→"One-off", `FIXED_TERM`→"Fixed term", `MONTHLY_RECURRING`→"Monthly recurring". This INTERNAL/3rd-party tag is the only "provider type" concept.
11. **Inline-edit form pattern (HTML quirk to preserve behaviorally):** each editable input uses `form={...}` to associate with a separate hidden `<form id="prod-<id>" action={updateProduct}>` that carries `<input hidden name="id">` and the Save button. Edit and Retire/Reactivate are separate forms per row. Add-new is a 6-col grid form at the bottom of each card.
12. Add-product form fields: `sku` (required, placeholder "HMD-XXX"), `name` (required), `category` (required), `unitPrice` (number, step 0.01, min 0, required), `currency` (defaultValue "EUR"). Add-service form: `name` (required), `providerType` (default INTERNAL), `invoicingModel` (default ONE_OFF), `basePrice` (number, required), `currency` (default "EUR"). **GM % and SKU are NOT editable from the UI** — `gmPercent` is never set by these forms, so created items get the schema defaults (0.35 product / 0.55 service); SKU is set only at create.

---

### 3. Catalog mutations (`app/catalog/actions.ts`) — 8 server actions

Pattern for **every** action (`actions.ts:4-6`): parse FormData → prisma write → `createActivityEvent(...)` → `revalidatePath("/catalog")`. `actor = await currentUser()` at the top of each. Helpers: `str(fd,key)=String(fd.get(key) ?? "").trim()`; `num(fd,key)=Number(fd.get(key) ?? 0)`.

**Enum coercion** (`actions.ts:25-42`): `parseProviderType(v)` → `v` if in `["INTERNAL","THIRD_PARTY"]` else `"INTERNAL"`. `parseInvoicingModel(v)` → `v` if in `["ONE_OFF","FIXED_TERM","MONTHLY_RECURRING"]` else `"ONE_OFF"`. (Defensive — invalid values silently fall back to default, not error.)

| Action | Guards | Write | ActivityEvent type / summary |
|---|---|---|---|
| `createProduct` (`46-71`) | `if (!sku\|\|!name\|\|!category) return` (silent no-op) | `product.create({ sku, name, category, unitPrice, currency:currency\|\|"EUR" })` — gmPercent/status defaulted | `PRODUCT_CREATED` · `Added product {name} ({sku}) at {formatEUR(unitPrice,currency)}`; linkedRecordType `PRODUCT` |
| `updateProduct` (`73-101`) | `if(!id) return`; `if(!name\|\|!category) return` | `product.update({where:{id}, data:{name,category,unitPrice,currency}})` | `PRODUCT_UPDATED` · `Updated product {name} ({sku}) — {formatEUR}` |
| `retireProduct` (`103-124`) | `if(!id) return` | `update({where:{id}, data:{status:"RETIRED"}})` | `PRODUCT_RETIRED` · `Retired product {name} ({sku}) — hidden from new offers` |
| `reactivateProduct` (`126-147`) | `if(!id) return` | `update({status:"ACTIVE"})` | `PRODUCT_REACTIVATED` · `Reactivated product {name} ({sku}) — available for new offers` |
| `createService` (`151-176`) | `if(!name) return` | `service.create({ name, providerType, invoicingModel, basePrice, currency })` | `SERVICE_CREATED` · `Added service {name} ({providerType}) at {formatEUR(basePrice,currency)}` |
| `updateService` (`178-207`) | `if(!id) return`; `if(!name) return` | `update({name,providerType,invoicingModel,basePrice,currency})` | `SERVICE_UPDATED` · `Updated service {name} — {formatEUR}` |
| `retireService` (`209-230`) | `if(!id) return` | `update({status:"RETIRED"})` | `SERVICE_RETIRED` · `Retired service {name} — hidden from new offers` |
| `reactivateService` (`232-253`) | `if(!id) return` | `update({status:"ACTIVE"})` | `SERVICE_REACTIVATED` · `Reactivated service {name} — available for new offers` |

All ActivityEvents use `accountId: null`, `actorId: actor?.id ?? null`, `linkedRecordType: "PRODUCT"|"SERVICE"`, `linkedRecordId: <created/updated id>`. `createActivityEvent` (`lib/activity.ts:16-29`) just inserts one `ActivityEvent` row.

**Re-impl notes (catalog → TanStack Start):**
- Each `"use server"` action becomes a `createServerFn({ method: "POST" })` handler. FormData is currently used; in TanStack you'll likely pass a typed object validator instead — preserve the `.trim()`, `Number()` coercion, the empty-required-field SILENT no-op (return without throwing), and the enum fallback-to-default behavior.
- Replace `revalidatePath("/catalog")` with TanStack Start router `invalidate()` / query invalidation of the catalog loader after mutation.
- Replace `redirect()` role guard with a route `beforeLoad` guard that throws a redirect to `/role-switch` when role≠FINANCE.
- Keep the activity-event side effect: the summaries are user-visible in the activity timeline; their exact wording is load-bearing.

---

### 4. Reporting layer (`lib/reporting.ts`)

Powers Manager + Finance + Reports. Reuses `forecast.ts` for ALL bucketing/weighting. Hard rules baked in: forecast is TIME-PHASED (per-period rows, never a single deal amount); device vs service revenue stay SEPARATE in every aggregate; weighted by stage probability (prefer stored `weightedRevenue`, stage fallback); stalled = OPEN deal not updated in 14+ days.

**4.1 `threeYearForecast(filter?: {ownerRepId?, channel?}): ThreeYearForecast`** (`reporting.ts:46-96`)
- Reads `prisma.dealForecastPeriod.findMany` where `deal.status="OPEN"` AND (optionally) `deal.ownerRepId = filter.ownerRepId` AND/OR `deal.channel = filter.channel`; `orderBy periodLabel:asc`. **Filters apply to the parent deal, not the period row.**
- Map each period → `ForecastRow {periodLabel, deviceUnits, deviceRevenue, serviceRevenue, totalRevenue, weightedRevenue}`.
- `quarters = aggregateByQuarter(rows).slice(0, 12)` — **CAP AT 12 QUARTERS** (3 years).
- `totals` = SUM of the five metrics across `quarters` (NOT across raw rows — i.e. across the capped 12).
- `totals.grossMargin = grossMargin(totals.deviceRevenue, totals.serviceRevenue)` (blended 0.35/0.55, §0.5).
- Output: `{ quarters: QuarterAggregate[], totals: {deviceUnits, deviceRevenue, serviceRevenue, totalRevenue, weightedRevenue, grossMargin} }`.

**4.2 `dealWeighted(deal)` private helper** (`reporting.ts:106-124`) — single-deal weighted value:
1. `total = Σ forecastPeriods.totalRevenue`; `storedWeighted = Σ forecastPeriods.weightedRevenue`.
2. **If** `forecastPeriods.length > 0 && storedWeighted > 0` → return `{ weighted: storedWeighted, total }` (use the time-phased, already-stage-weighted-at-write-time values).
3. **Else fallback**: `prob = deal.probability || STAGE_PROBABILITY[deal.stage] || 0`; return `{ weighted: weightedRevenue(prob, total), total }`. (`deal.probability` is an Int 0-100 on the Deal model, default 10; `||` means a 0 probability falls through to the stage table.)

**4.3 `pipelineByStage(): StagePipelineRow[]`** (`reporting.ts:138-167`)
- `deal.findMany({where:{status:"OPEN"}, include:{forecastPeriods:{select:{totalRevenue,weightedRevenue}}}})`.
- Group by `stage` into rows `{stage, label:STAGE_LABEL[stage], probability:STAGE_PROBABILITY[stage]??0, count, totalRevenue, weightedRevenue}`; per deal add `dealWeighted` → `count+=1, totalRevenue+=total, weightedRevenue+=weighted`.
- **Sort ASCENDING by `probability`** (`reporting.ts:166`). WON(100)/LOST(0) appear only if such deals had `status:"OPEN"` (normally none, since WON/LOST imply non-OPEN status).

**4.4 `pipelineByOwner(): OwnerPipelineRow[]`** (`reporting.ts:180-208`)
- OPEN deals, include `ownerRep:{id,name}` + forecastPeriods. Group by `ownerRepId` into `{ownerRepId, ownerName, count, totalRevenue, weightedRevenue}` using `dealWeighted`.
- **Sort DESCENDING by `weightedRevenue`** (`reporting.ts:207`).

**4.5 `openDealRows()` private + `stalledDeals()` / `pastCloseDeals()`** (`reporting.ts:226-281`)
- `openDealRows()`: OPEN deals, include `account:{name}`, `ownerRep:{name}`, forecastPeriods; `orderBy lastActivityAt:asc` (oldest first). Map → `DealRow {id,name,stage,stageLabel:STAGE_LABEL[stage],channel,accountName,ownerName,expectedCloseDate,lastActivityAt,daysStalled:daysSince(lastActivityAt),weightedRevenue:dealWeighted(d).weighted}` plus a private `_expectedCloseDate`.
- `stalledDeals()`: filter `daysStalled >= 14`; **sort DESC by `daysStalled`** (most stale first).
- `pastCloseDeals()`: `now = Date.now()`; filter `_expectedCloseDate !== null && _expectedCloseDate.getTime() < now`; sort ASC by `_expectedCloseDate` (most overdue first by date). Deals with null close date are EXCLUDED.

**4.6 `closeRate(): CloseRate`** (`reporting.ts:294-302`)
- Three parallel counts: `deal.count` WON, LOST, OPEN.
- `decided = won + lost`; `rate = decided === 0 ? 0 : won / decided` (0..1). Output `{won, lost, open, decided, rate}`. **Open deals are EXCLUDED from the rate denominator.**

**4.7 `casesByStatus(): CountRow[]`** (`reporting.ts:313-325`)
- `case.groupBy({by:["status"], _count:{_all:true}})`. Map → `{key:status, label:status.replaceAll("_"," "), count}`. **Sort DESC by count.** (CaseStatus = OPEN|IN_PROGRESS|ESCALATED|CLOSED.)

**4.8 `casesByService(): CountRow[]`** (`reporting.ts:328-353`)
- `case.groupBy({by:["serviceId"], _count:{_all:true}})`. Collect non-null serviceIds, fetch `service.findMany({where:{id:{in:ids}}, select:{id,name}})` → name map.
- Map each group → `{key: serviceId ?? "none", label: serviceId ? (name ?? "Unknown service") : "Unassigned", count}`. **Sort DESC by count.** Cases with no service group under key `"none"` / label `"Unassigned"`.

**4.9 `dealsByStageOwner(): {rows, stages}`** (`reporting.ts:368-413`)
- OPEN deals select `{stage, ownerRepId, ownerRep:{name}}`.
- `stageOrder` = `Object.keys(STAGE_PROBABILITY)` filtered to exclude WON & LOST → the 5 active stages in object-insertion order: `[INTEREST_SHOWN, RFI_ANSWERED, RFP_OFFER_GIVEN, CUSTOMER_TEST, CONTRACT_NEGOTIATION]`.
- `emptyByStage()` builds a `Record<stage,0>` for all 5 (0-filled so every cell renders).
- Group by owner → `{ownerRepId, ownerName, byStage, total}`; increment `byStage[stage]` and `total`.
- `rows` **sorted DESC by `total`**; `stages` = `stageOrder.map(s => {stage, label:STAGE_LABEL[s]})`.

**4.10 `listReps(): {id,name}[]`** (`reporting.ts:418-424`): `user.findMany({where:{role:"REP"}, select:{id,name}, orderBy:{name:asc}})`. Used as deal-reassignment target list.

**Re-impl notes (reporting):** All ten are pure reads → TanStack Start server functions (or route loaders), one per dashboard need. Three rely on `prisma.groupBy` (casesByStatus/casesByService/the implicit count in closeRate) — in a non-Prisma data layer reproduce with `GROUP BY` SQL or in-memory grouping; preserve every sort direction and the WON/LOST exclusion in `dealsByStageOwner`. The `dealWeighted` "stored-weighted-preferred, stage-fallback" rule (4.2) is the single most important formula — port it as a shared util because targets.ts re-derives a simpler version of it (see §5).

---

### 5. Targets / forecast categories (`lib/targets.ts`)

**What/why:** Powers the Sales Manager "committed vs at-risk vs gap-to-target" tiles. Standalone (does NOT call reporting.ts; recomputes weighted from forecastPeriods directly).

**Constant:** `TEAM_TARGET_3YR = 30_000_000` (`targets.ts:9`) — €30M, configurable assumption (no quota field in brief).

**`forecastCategories(): ForecastCategories`** (`targets.ts:19-41`):
1. Read OPEN deals, `include forecastPeriods:{select:{weightedRevenue}}`. `now = Date.now()`.
2. Init `committed=0, atRisk=0, upside=0`.
3. Per deal:
   - `weighted = Σ forecastPeriods.weightedRevenue` (NOTE: simpler than `dealWeighted` — NO stored>0 guard, NO stage fallback; a deal with no forecast periods contributes 0 here).
   - `stale = daysSince(d.lastActivityAt) >= 14 || (d.expectedCloseDate ? d.expectedCloseDate.getTime() < now : false)`.
   - `prob = d.probability || STAGE_PROBABILITY[d.stage] || 0`.
   - **Classification (mutually exclusive, in this order):** if `stale` → `atRisk += weighted`; else if `prob >= 70` → `committed += weighted` (i.e. CUSTOMER_TEST=70 / CONTRACT_NEGOTIATION=90 / WON=100); else → `upside += weighted`.
4. Return (all rounded): `committed: round(committed)`, `atRisk: round(atRisk)`, `upside: round(upside)`, `target: 30_000_000`, `gapToTarget: round(max(0, 30_000_000 - committed))`.

**Edge cases:** stale takes precedence over the ≥70 commit threshold (a stalled CONTRACT_NEGOTIATION deal counts as at-risk, not committed). `gapToTarget` floored at 0. `upside` is computed but NOT shown on the Manager tiles (see §7).

**Re-impl note:** server function returning the 5 numbers. Keep the exact 14-day threshold, the 70 commit threshold, the €30M target, and the stale-first precedence.

---

### 6. Rep dashboard (`app/rep/page.tsx`) — route `/rep`

**Role/persona:** the Sales Rep's home (scoped to `user.id`). Guard: `currentUser()`; if null → `redirect("/role-switch")`. (No role-type restriction beyond login — any logged-in user lands here.)

**Reads (parallel, `page.tsx:20-42`), all scoped to the current rep:**
1. `account.findMany({where:{ownerRepId:user.id}, include:{_count:{deals,cases,offers}}, orderBy:{name:asc}})`.
2. `deal.findMany({where:{ownerRepId:user.id, status:"OPEN"}, include:{account}, orderBy:{lastActivityAt:desc}})`.
3. `offer.findMany({where:{createdById:user.id, status:{in:["PENDING_SM","PENDING_FINANCE","SM_APPROVED"]}}, include:{account,deal}, orderBy:{updatedAt:desc}})` — "offers in approval".
4. `activityEvent.findMany({where:{account:{ownerRepId:user.id}}, include:{account}, orderBy:{createdAt:desc}, take:8})`.

**Derived:**
- **At-risk deals** (`page.tsx:44-46`): from the rep's OPEN deals, filter `daysSince(lastActivityAt) >= 14 || (expectedCloseDate && expectedCloseDate.getTime() < Date.now())`. (Local recomputation — same 14-day rule as reporting, but here OR-combined with past-close in a single list.)
- **Pipeline by stage** (`page.tsx:49-52`): `DIRECT_STAGES` minus WON/LOST → for each of the 5 active stages, `deals.filter(stage===)`. Counts only.

**Renders:** header (first name + counts "{n} accounts · {n} open deals · {n} offers in approval"); the AI `IntakePanel` (HERO, out of this subsystem's scope); at-risk callout card (only if `atRisk.length>0`) with per-row reason badge — "past close" if past close date else `{daysSince}d stale`; My accounts table (name, region, deal/case/offer counts); Offers-in-approval list (deal name or account name + `v{version}`, account, `formatEUR(total)`, status badge with `_`→space); Open-pipeline-by-stage 5-tile grid (label + count); Recent-activity list (summary + account link + `createdAt.toISOString().slice(0,10)`).

---

### 7. Manager dashboard (`app/manager/page.tsx`) — route `/manager`, `dynamic = "force-dynamic"`

**Role guard** (`page.tsx:44-47`): `currentUser()`; if null → `/role-switch`; if `role === "REP" || role === "TAM"` → `redirect(dashboardPathForRole(role))`. So only `SALES_MANAGER` and `FINANCE` see it.

**Query param:** `granularity` ∈ {quarter, half, year}, default "quarter" (`page.tsx:33-37`).

**Reads (parallel, `page.tsx:52-61`):** `threeYearForecast()` (no filter), `pipelineByStage()`, `pipelineByOwner()`, `stalledDeals()`, `pastCloseDeals()`, `listReps()`, `forecastCategories()`.

**Derived:** `buckets = rollUp(forecast.quarters, granularity)`; `stageMax = Math.max(1, ...byStage.map(weightedRevenue))`; `ownerMax = Math.max(1, ...byOwner.map(weightedRevenue))` (for bar widths).

**Renders, in order:**
1. Header + link to `/approvals`.
2. AI `<ForecastNarrativeCard>` in `<Suspense fallback={<ForecastNarrativeSkeleton/>}>` (see §11).
3. **"Forecast vs target (3-yr weighted)"** — 4 tiles from `forecastCategories`: **Committed** `formatEUR(committed)` (emerald, "on-track, ≥70% stage"), **At risk** `formatEUR(atRisk)` (destructive, "stalled / past close"), **Target** `formatEUR(target)` ("3-yr team target" = €30M), **Gap to target** `formatEUR(gapToTarget)` (amber, "target − committed"). NOTE: `upside` is intentionally NOT shown. Then a `<ForecastChart quarters={forecast.quarters}>`.
4. **KPI strip** (4 cards): `formatEUR(totals.weightedRevenue)` "Weighted pipeline (3yr)"; `Σ byStage.count` "Open deals"; `stalled.length` (amber) "Stalled (14+ days)"; `pastClose.length` (red) "Past close date".
5. **Stalled deals table** — header badge `{stalled.length} flagged`; columns Deal, Account, Owner, Stage, Stalled (`{daysStalled}d` destructive badge), Weighted (`formatEUR`), **Reassign** (inline `<form action={reassignDeal}>` with hidden `dealId` + `<select name="newRepId">` of `reps` + "Go"). Empty state "No stalled deals…".
6. **Deals past expected close** — badge `{pastClose.length}`; columns Deal, Account, Owner, Stage, Expected close (`toISOString().slice(0,10)`, red), Weighted.
7. **Pipeline funnel** — `<PipelineFunnel rows={byStage}>` (§10).
8. Two-column grid: **Pipeline by stage (weighted)** table (Stage + a bar `width = weighted/stageMax*100%`, Prob `{probability}%`, Deals count, Weighted) and **Pipeline by owner (weighted)** table (Rep + bar `weighted/ownerMax`, Deals, Weighted).
9. **3-year weighted pipeline** table with granularity toggle (Badge links `/manager?granularity={g}`): rows from `buckets` (Period, Device €, Service €, Total € muted, Weighted € bold) + a **Total row** that uses `forecast.totals` (the UNgranular totals, always quarter-summed). Footnote: "Time-phased rows, weighted by stage probability. Device and service revenue kept separate."

**`reassignDeal` server action** (`app/manager/actions.ts:13-56`):
1. Parse `dealId`, `newRepId`; `if(!dealId||!newRepId) return`.
2. Parallel: `currentUser()`, `deal.findUnique({include:{account:{id,name}, ownerRep:{id,name}}})`, `user.findUnique({id:newRepId})`.
3. Guards: `if(!deal||!newRep) return`; `if(deal.ownerRepId === newRepId) return` (no-op).
4. `deal.update({data:{ownerRepId:newRepId}})`.
5. `createActivityEvent({accountId:deal.accountId, actorId:actor?.id, type:"DEAL_REASSIGNED", summary:'Deal "{name}" reassigned from {oldOwner} to {newRep}', linkedRecordType:"DEAL", linkedRecordId:deal.id})`.
6. `notify({recipientId:newRep.id, title:"Deal reassigned to you", body:'{actor?.name ?? "A manager"} assigned "{name}" ({account.name}) to you.', linkedRecordType:"DEAL", linkedRecordId:deal.id})` (creates a Notification row for the new rep).
7. `revalidatePath("/manager")`.

---

### 8. Finance dashboard (`app/finance/page.tsx`) — route `/finance`, `dynamic = "force-dynamic"`

**Role guard** (`page.tsx:36-39`): same as Manager — null→`/role-switch`; REP/TAM→`dashboardPathForRole`. So SALES_MANAGER + FINANCE see it.

**Query params:** `owner` (rep id, or absent/"all"), `channel` (DIRECT|RESELLER, else undefined) (`page.tsx:25-43`).

**Reads (parallel):** `threeYearForecast({ownerRepId, channel})` (FILTERED) + `user.findMany({where:{role:"REP"}, select:{id,name}, orderBy:{name:asc}})` for the owner filter chips.

**Derived:** `{quarters, totals} = forecast`; **`gmPct = totals.totalRevenue > 0 ? (totals.grossMargin / totals.totalRevenue) * 100 : 0`** (`page.tsx:55`). Filter-link builders (`ownerHref`, `channelHref`) preserve the OTHER dimension via `URLSearchParams`; "all" clears that dimension.

**Renders:**
1. Header + export buttons (`/api/export/forecast`, `/api/export/cases`), link to `/approvals`, link to `/catalog`. Subtitle maps to HMD funnel "Opportunity → Pipeline → Committed → Confirmed".
2. AI `<ForecastNarrativeCard>` (Suspense).
3. **Grand-total KPI cards (6):** Device revenue `formatEUR(deviceRevenue)`; Service revenue; Net sales (total) `formatEUR(totalRevenue)`; Gross margin `formatEUR(grossMargin)`; **GM %** `gmPct.toFixed(1)+"%"`; Weighted total.
4. **Filters card:** Channel chips (All / Direct / Reseller) and Owner chips (All reps / each rep), active chip = "default" variant.
5. **3-year forecast chart** `<ForecastChart quarters={quarters}>`.
6. **3-year quarterly forecast table:** columns Quarter, Device units, Device €, Service €, Net sales € (muted), **GM €** = `formatEUR(grossMargin(q.deviceRevenue, q.serviceRevenue))` (per-quarter, recomputed via the blended 0.35/0.55), Weighted € (bold). Grand-total row from `totals` (uses `totals.grossMargin`). Empty state when no quarters match filters. Footnote: "Showing {n} quarter(s). … GM uses blended device 35% / service 55% margins (configurable assumption)" — printed via `Math.round(DEVICE_GM_PCT*100)` / `Math.round(SERVICE_GM_PCT*100)`.

**Key GM distinction to preserve:** per-quarter GM in the table is computed on demand from that quarter's device/service split via `grossMargin()`. Because `grossMargin` rounds, the sum of per-quarter GMs may differ by a euro or two from `totals.grossMargin` (which rounds once on the summed device/service totals). Both are shown — do not "fix" this; match it.

---

### 9. Reports page (`app/reports/page.tsx`) — route `/reports`, `dynamic = "force-dynamic"`

**Guard:** `currentUser()`; null→`/role-switch`. (No role-type restriction — any logged-in user.)

**Reads (parallel):** `casesByStatus()`, `casesByService()`, `dealsByStageOwner()`, `closeRate()`, `pipelineByStage()`.

**Derived:** `statusMax = Math.max(1, ...byStatus.count)`, `serviceMax = Math.max(1, ...byService.count)`, `ratePct = Math.round(close.rate * 100)`. `<Bar value max>` = `width = value/max(1,max)*100%`.

**Renders:**
1. **KPI strip (4):** Close rate `{ratePct}%` ("won / decided"); Won (green); Lost (red); Open.
2. **Cases by status** table (Status capitalized-lowercased, Share bar, Count).
3. **Cases by service** table (Service label incl. "Unassigned", Share bar, Count).
4. **Open deals by stage × owner** matrix: header = Rep + the 5 active stage labels + Total; each cell `row.byStage[stage] || "·"` (the `||` renders a muted middot for 0). Empty state "No open deals."
5. **Pipeline value by stage (weighted)** table: badge `Σ count` open deals; columns Stage, Deals, Total € (muted), Weighted € (bold), in ascending-probability order from `pipelineByStage`.

---

### 10. SVG components (dependency-free — port to React + inline SVG, no chart lib)

**`ForecastChart` (`components/forecast-chart.tsx`)** — stacked device+service bars per quarter + weighted line:
- `data = quarters.slice(0,12)`; if empty, render nothing.
- Geometry: `W=760, H=260, padL=8, padR=8, padT=16, padB=28`; `plotW=W-padL-padR`, `plotH=H-padT-padB`. `max = Math.max(1, ...totalRevenue)`. `band = plotW/data.length`, `barW = band*0.6`. `y(v)=padT+plotH-(v/max)*plotH`. `xCenter(i)=padL+band*i+band/2`.
- Per quarter: device rect height `(deviceRevenue/max)*plotH` at bottom; service rect stacked above; quarter label `q.label.replace("20","'")` (e.g. `'26-Q3`).
- Weighted polyline over `xCenter,y(weightedRevenue)` + dot circles. Legend: Device/Service swatches + "Stage-weighted" line. Colors via CSS vars `--chart-device #0284c7`, `--chart-service #2dd4bf`, `--chart-weighted #f59e0b`. `eur(n)="€"+round(n/1000)+"k"` for the max label.

**`PipelineFunnel` (`components/pipeline-funnel.tsx`)** — funnel of active stages by deal count:
- `ACTIVE = DIRECT_STAGES minus WON/LOST` (5 stages). `by = Map(rows by stage)`. `maxCount = Math.max(1, ...ACTIVE counts)`.
- `W=760, rowH=46, gap=8, padT=8`; `maxBarW=W*0.62`, `minBarW=W*0.14`. Per stage bar width `w = minBarW + (maxBarW-minBarW)*(count/maxCount)`, centered. **Fill opacity** `0.25 + 0.6*(STAGE_PROBABILITY[stage]/100)` (later stages darker). Label = `STAGE_LABEL[stage]` + (if `CONTRACT_NEGOTIATION`) `"  ·  direct only"`. Sub-line `{count} deal(s) · {formatEUR(weighted)} weighted`. Color var `--chart-funnel #4f46e5`. Footnote: "Reseller deals skip Contract negotiation — Customer test goes straight to Won/Lost."

**Re-impl note:** both are pure presentational components — copy the SVG math 1:1; only the import paths and the CSS-var fallback mechanism change.

---

### 11. AI forecast narrative (`components/forecast-narrative-card.tsx` + `lib/ai/forecast-narrative.ts`)

Shown on both Manager and Finance (Suspense-wrapped so the page paints first; skeleton = 3 pulsing bars).

**`ForecastNarrativeCard`** (server component): parallel `threeYearForecast()`, `stalledDeals()`, `pastCloseDeals()`. `nearTermWeighted = Σ forecast.quarters.slice(0,2).weightedRevenue` (next 2 quarters). Calls `forecastNarrative({weightedTotal:totals.weightedRevenue, totalRevenue, deviceRevenue, serviceRevenue, nearTermWeighted, quartersCount:quarters.length, stalledCount, pastCloseCount})`. Renders the text; badge "AI" if `source==="ai"` else "AI · rules".

**`forecastNarrative(s)`** (`lib/ai/forecast-narrative.ts:20-49`): builds a facts string, calls `aiText({system, user, maxTokens:220})` (Featherless/OpenAI-compatible). System prompt: "finance analyst for HMD Secure… 2-3 short sentences… cite the biggest risk… end with one recommended managerial action. No markdown." **If `aiText` returns falsy** (no key/model), returns the deterministic templated fallback string interpolating the same numbers, with risk clause depending on `stalledCount+pastCloseCount>0`. Read-only — never mutates.

**Re-impl note:** in TanStack Start, render this as a deferred/streamed loader (TanStack's `defer`/`Await`) to keep the Suspense behavior. The AI call → server function hitting Featherless; **keep the deterministic fallback** so a narrative always renders when the AI key is absent (this is a demo-safety rule).

---

### 12. CSV export endpoints (Next route handlers → TanStack Start API routes / server routes)

**`GET /api/export/forecast`** (`app/api/export/forecast/route.ts`): `threeYearForecast()` (no filter) → CSV. Header `quarter,device_units,device_revenue,service_revenue,total_revenue,weighted_revenue`; one row per quarter; final `TOTAL` row from `totals`. `Content-Type: text/csv; charset=utf-8`, `Content-Disposition: attachment; filename="hmd-forecast.csv"`. NOTE: raw numbers (no euro formatting), comma-joined, NO field escaping (safe here — all numeric/label values).

**`GET /api/export/cases`** (`app/api/export/cases/route.ts`): `case.findMany({include:{account,service,assignedTam}, orderBy:{createdAt:desc}})` → CSV. Header `title,account,status,priority,service,tam,created,closed`; per case `[title, account.name, status, priority, service?.name ?? "", assignedTam?.name ?? "", createdAt.slice(0,10), closedAt?.slice(0,10) ?? ""]` each wrapped via `esc(v)='"'+String(v??"").replace(/"/g,'""')+'"'` (CSV double-quote escaping). filename `hmd-cases.csv`.

**Re-impl note:** map to TanStack Start server routes (`createServerFileRoute` / API handler) returning a `Response` with the same headers. Keep the cases-export quote-escaping (titles contain free text) and the forecast-export raw-number format.

---

### 13. Cross-cutting migration notes

1. **Role naming quirk:** the `Role` enum is `REP | TAM | SALES_MANAGER | FINANCE` (`schema.prisma:16-21`). Catalog guards on `"FINANCE"`; Manager/Finance guard against `"REP"|"TAM"` (so SALES_MANAGER + FINANCE pass); Reports/Rep only require a logged-in user. Preserve these exact guard predicates as route `beforeLoad` checks.
2. **`force-dynamic`:** Manager, Finance, Reports are `dynamic = "force-dynamic"` (no caching — always live). In TanStack Start, ensure their loaders are not statically cached (these read mutable pipeline state).
3. **Session:** `currentUser()` reads cookie `hmd_demo_user`, falling back to the first REP by email (`session.ts:15-29`). `dashboardPathForRole`: REP→`/rep`, TAM→`/tam`, SALES_MANAGER→`/manager`, FINANCE→`/finance`. Re-implement as a request-context helper + redirect map.
4. **No hard deletes anywhere in catalog** — retire/reactivate flip `status` only. The offer-builder/active-list separation (§1) is the rule that makes this safe; keep `activeProducts/Services` as the ONLY source for new offers.
5. **Rounding discipline:** `weightedRevenue`, `grossMargin`, and all of `forecastCategories` round; `formatEUR` shows 0 decimals. Aggregate totals sum already-stored period values (themselves rounded at write time in the forecast engine). Match the rounding points exactly or demo numbers drift.
6. **Two weighted-value formulas coexist:** reporting's `dealWeighted` (stored-preferred + stage fallback, §4.2) vs targets' inline `Σ weightedRevenue` (no fallback, §5). They are intentionally different; do not unify them.
7. **`prisma.groupBy` usage** (casesByStatus, casesByService, and the three counts in closeRate) is the main thing a non-Prisma data layer must reproduce — either via SQL `GROUP BY`/`COUNT` or in-memory aggregation, preserving every DESC-by-count / ASC-by-probability / DESC-by-total / DESC-by-weighted / ASC-by-daysStalled sort.

---

I now have full context, including the important detail that `caseNotes` orders `createdAt: "desc"` (newest first) while the case-summary prompt claims "oldest first". I have everything needed to write the exhaustive spec.

## AI Subsystem (the HERO differentiators) — Migration Spec

This subsystem covers every AI-powered feature of the HMD Secure CRM. There are **five AI features** plus a shared **LLM client**:

1. Shared LLM client (`lib/ai/client.ts`) — Featherless OpenAI-compatible wrapper, `hasAI`, `aiJSON`, `aiText`.
2. **HERO #1 — AI-assisted intake** (`lib/ai/intake.ts`, route, `applyIntake` action, `IntakePanel`).
3. **HERO #2 — AI Next Best Action / NBA** (`lib/ai/nba.ts`, `NbaPanel`).
4. **HERO #3 supplement — AI forecast narrative** (`lib/ai/forecast-narrative.ts`, `ForecastNarrativeCard`).
5. **AI case summary** (`lib/ai/case-summary.ts`, `CaseSummaryCard`).
6. **"Aino" AI assistant** (`lib/ai/assistant.ts`, route, `AiAssistant`).

The single most important invariant across all of them: **every feature has a deterministic fallback that runs with no API key, and no AI failure ever throws to the user or blocks the demo.** A second hard invariant: **AI never mutates the database; the only write path is the explicit `applyIntake` Apply action, which goes through normal data-layer writes.**

---

### 0. Shared LLM client — `lib/ai/client.ts`

#### 0.1 What it does + why
A thin server-only wrapper over the OpenAI SDK pointed at Featherless (an OpenAI-compatible endpoint). It exposes three things: a capability check (`hasAI`), a robust JSON-completion helper (`aiJSON`), and a plain-text-completion helper (`aiText`). Production target per the HMD brief is Azure OpenAI in EU; Featherless is the hackathon stand-in (documented assumption; the model only ever sees seeded/demo CRM text, never real PII).

#### 0.2 Business rules (exact)
1. **`server-only`** import at top (`client.ts:15`) — this module must never be bundled to the browser; the API key must never reach the client.
2. **Env read at runtime, never at module top-level** (`cfg()`, `client.ts:20-26`). Reason documented in code: Next dev/build can evaluate the module before `.env` is loaded, which would wrongly latch `hasAI()` to `false`. **Re-implementation must preserve lazy env reads** — read `process.env` inside the function, not as a module-level const.
3. Env vars (all optional):
   - `FEATHERLESS_API_KEY` — Bearer key. **Its presence is the only thing `hasAI()` checks** (`client.ts:28-30`: `Boolean(process.env.FEATHERLESS_API_KEY)`).
   - `FEATHERLESS_MODEL` — default `"Qwen/Qwen2.5-7B-Instruct"` (`client.ts:23`).
   - `FEATHERLESS_BASE_URL` — default `"https://api.featherless.ai/v1"` (`client.ts:24`).
4. `hasAI()` is the gate. If it returns false, `aiJSON`/`aiText` **return `null` immediately without any network call** (`client.ts:60`, `client.ts:89`). Callers MUST treat `null` as "use the deterministic fallback".
5. **Never throws.** Every network/parse error is caught, logged via `console.error("[ai] … failed, falling back:", err)`, and returns `null` (`client.ts:77-80`, `client.ts:102-105`).
6. **Reasoning-model handling**: some Featherless models (e.g. GLM-4.6) return the answer in `message.reasoning` with empty `message.content`. Both helpers read `msg?.content || msg?.reasoning` (`client.ts:73`, `client.ts:101`). **Must preserve** — the SDK's typed `message` does not include `reasoning`, so it is cast to `{ content?: string; reasoning?: string }`.
7. `aiJSON` parameters: `temperature: 0.2`, `max_tokens: opts.maxTokens ?? 800` (`client.ts:68-69`). System message is **augmented**: the caller's `system` string has `"\nRespond with ONLY a single JSON object, no prose, no code fences."` appended (`client.ts:65`).
8. `aiText` parameters: `temperature: 0.4`, `max_tokens: opts.maxTokens ?? 400` (`client.ts:97-98`). Output is `.trim()`-ed; returns `null` if empty.
9. **Robust JSON extraction** — `extractJsonObject(text)` (`client.ts:38-49`):
   a. First strip a ```` ```json … ``` ```` (or plain ```` ``` ```` ) fence if present, using regex `/```(?:json)?\s*([\s\S]*?)```/i`; operate on the fenced body if matched, else the whole text.
   b. Find the first `{`. If none, return `null`.
   c. Walk forward tracking brace depth; return the substring from the first `{` to the matching closing `}` (first balanced object). This tolerates trailing chatter after the JSON.
   d. `aiJSON` then `JSON.parse`s that substring; any parse error is caught → `null`.

#### 0.3 Data shapes
- `aiJSON<T>({ system, user, maxTokens? }) => Promise<T | null>`
- `aiText({ system, user, maxTokens? }) => Promise<string | null>`
- `hasAI() => boolean`

#### 0.4 Re-implementation notes (→ TanStack Start)
- Put this in a server-only module (TanStack Start: import inside `createServerFn` handlers or a `*.server.ts` file). The `openai` npm package works unchanged with a custom `baseURL`.
- Keep the lazy `cfg()` env read — Vite/Vinxi also evaluate modules eagerly; reading env at call time avoids the same latch bug.
- `extractJsonObject`, the reasoning fallback, the temperature/token defaults, and the system-prompt JSON suffix are pure logic — port them verbatim. Do NOT replace with the OpenAI `response_format: json_object` param: the original deliberately tolerates chatter/fences/reasoning models, which a stricter mode would not match.

---

### 1. HERO #1 — AI-assisted intake (paste → draft → Apply)

Files: `lib/ai/intake.ts`, `app/api/ai/intake/route.ts`, `app/rep/intake-actions.ts` (`applyIntake`), `components/intake-panel.tsx`. Mounted on the Rep dashboard (`app/rep/page.tsx:67`).

#### 1.1 What it does + why
The demo opener. A rep pastes an email thread / meeting notes; the AI extracts a **draft** set of CRM records (account, contact, deal, case, follow-up task) shown as a checklist preview. **Nothing is written until the rep clicks "Apply selected".** Apply creates real records through the same Prisma paths used for manual creation, then redirects to a fully-populated Account 360 (the demo payoff). Two-stage by design: extract is read-only; only Apply mutates.

#### 1.2 Extraction (`lib/ai/intake.ts`)

##### 1.2.1 Output schema (Zod, `intake.ts:11-49`) — `IntakeDraftSchema` / `IntakeDraft`
```
{
  summary: string,                                  // one-line summary of pasted text
  contact: { name: string|null, title: string|null, email: string|null, phone: string|null } | null,
  account: { name: string|null, region: string|null } | null,
  deal: {
    name: string|null,
    channel: "DIRECT" | "RESELLER" | null,
    stage: "INTEREST_SHOWN"|"RFI_ANSWERED"|"RFP_OFFER_GIVEN"|"CUSTOMER_TEST"|"CONTRACT_NEGOTIATION"|"WON"|"LOST" | null,
    expectedCloseDate: string|null                  // free-form date string, parsed later with new Date()
  } | null,
  case: { title: string|null, priority: "LOW"|"MEDIUM"|"HIGH"|"CRITICAL" | null } | null,
  task: { body: string } | null                     // note: body is REQUIRED string when task present
}
```
The `stage`/`channel`/`priority` enums must match the Prisma `DealStage`/`Channel`/`Priority` enums exactly.

##### 1.2.2 EXACT system prompt (`intake.ts:52-70`)
```
You are a CRM intake assistant for HMD Secure (sells smart devices + services to enterprises).
Read the pasted email thread or meeting notes and extract DRAFT CRM records.

Output ONLY a JSON object with EXACTLY these keys and shapes (use null when not clearly present — do NOT invent, do NOT rename keys, do NOT add keys):
{
  "summary": string,
  "contact": { "name": string|null, "title": string|null, "email": string|null, "phone": string|null } | null,
  "account": { "name": string|null, "region": string|null } | null,
  "deal": { "name": string|null, "channel": "DIRECT"|"RESELLER", "stage": "INTEREST_SHOWN"|"RFI_ANSWERED"|"RFP_OFFER_GIVEN"|"CUSTOMER_TEST"|"CONTRACT_NEGOTIATION"|"WON"|"LOST", "expectedCloseDate": string|null } | null,
  "case": { "title": string, "priority": "LOW"|"MEDIUM"|"HIGH"|"CRITICAL" } | null,
  "task": { "body": string } | null
}

Rules:
- "account.name" = the customer company name. "contact" is an OBJECT (not a string).
- deal.stage: "evaluate/pilot/test/POC" => CUSTOMER_TEST; "interested/exploring" => INTEREST_SHOWN; "sent RFP/quote/offer" => RFP_OFFER_GIVEN; "answered RFI/questionnaire" => RFI_ANSWERED; "negotiating contract/legal/pricing terms" => CONTRACT_NEGOTIATION.
- "case" ONLY if the customer reports a problem/issue/incident/support need; case.title is a short label; map "urgent/blocking/critical" => HIGH or CRITICAL priority.
- channel: RESELLER only if a partner/reseller/distributor is clearly the buyer, else DIRECT.
- "task" is the single most useful follow-up; task.body is a short imperative sentence.
```
(Recall `aiJSON` also appends `"\nRespond with ONLY a single JSON object, no prose, no code fences."`)

##### 1.2.3 EXACT user message (`intake.ts:78`)
```
Extract draft CRM records from:

"""
${pasted}
"""
```
`maxTokens: 700`.

##### 1.2.4 Extraction logic (`extractIntake`, `intake.ts:72-87`)
1. Call `aiJSON<IntakeDraft>` with the system + user above.
2. If a result returned, run `IntakeDraftSchema.safeParse(ai)`.
3. If parse **succeeds** → return `{ draft: parsed.data, source: "ai" }`.
4. If AI returned something but parse **fails** → `console.warn("[ai] intake schema mismatch, using fallback:", <joined error paths>)` (`intake.ts:83-85`) and fall through.
5. Otherwise (no AI, or parse failed) → return `{ draft: fallbackExtract(pasted), source: "fallback" }`.

##### 1.2.5 Deterministic fallback — `fallbackExtract(text)` (`intake.ts:90-127`)
Pure regex/keyword extraction, no network:
1. **email**: first match of `/[\w.+-]+@[\w-]+\.[\w.-]+/`; else `null`. **domain** = part after `@` (the full host, e.g. `nordsec.fi`), else `null`.
2. **name**: try `/(?:from:|regards,|best,|thanks,)\s*\n?\s*([A-Z][a-z]+ [A-Z][a-z]+)/i` (capitalised pair near a sign-off / `From:`); else first `/\b([A-Z][a-z]+ [A-Z][a-z]+)\b/`; else `null`.
3. Lowercase the text; `has(...words)` = any substring present.
4. **stage** (first match wins, this priority order — `intake.ts:105-110`):
   - `"contract" | "legal review" | "terms" | "negotiat"` → `CONTRACT_NEGOTIATION`
   - else `"pilot" | "poc" | "proof of concept" | "evaluate" | "trial" | "testing"` → `CUSTOMER_TEST`
   - else `"rfp" | "quote" | "offer" | "proposal"` → `RFP_OFFER_GIVEN`
   - else `"rfi" | "questionnaire"` → `RFI_ANSWERED`
   - else `"interested" | "exploring" | "looking into" | "evaluate"` → `INTEREST_SHOWN`
   - else `null` (no deal drafted). (Note `"evaluate"` appears in both the CUSTOMER_TEST and INTEREST_SHOWN lists; CUSTOMER_TEST wins by order.)
5. **isCase** = `has("issue","problem","broken","down","not working","error","incident","outage","bug","support")`.
6. **priority** = `has("urgent","critical","asap","outage","down") ? "HIGH" : "MEDIUM"` (fallback never emits CRITICAL/LOW).
7. Build the draft:
   - `summary`: first 120 chars of trimmed text, whitespace collapsed (`replace(/\s+/g," ")`).
   - `contact`: `{ name, title:null, email, phone:null }` if name OR email found, else `null`.
   - `account`: if domain found, `{ name: <first label of domain, first letter uppercased>, region: null }` (e.g. `nordsec.fi` → `Nordsec`), else `null`.
   - `deal`: if stage found, `{ name:null, channel:"DIRECT", stage, expectedCloseDate:null }`, else `null`. **Fallback always uses DIRECT.**
   - `case`: if isCase, `{ title: first sentence (split on `.`/newline) sliced to 80 chars, priority }`, else `null`.
   - `task`: **always present** — `{ body: isCase ? "Acknowledge the issue and assign a TAM." : "Follow up to confirm next step." }`.

#### 1.3 API route — `app/api/ai/intake/route.ts`
- `POST { pasted }`. Reads body, coerces `pasted = String(body?.pasted ?? "").trim()`. Returns `400 {error:"bad request"}` on JSON parse failure, `400 {error:"empty"}` if `pasted` empty (`route.ts:12-16`).
- Calls `extractIntake(pasted)`, returns `{ draft, source }` as JSON (`route.ts:18-19`).
- Server-only; the LLM key never reaches the browser.

#### 1.4 Apply path — `applyIntake(formData)` (`app/rep/intake-actions.ts`)
This is the **only** AI-originated DB write, and it is explicit + user-gated. `"use server"`.

1. `user = currentUser()`; if none → `redirect("/role-switch")`.
2. Parse `draft = JSON.parse(formData.get("draft"))`; on parse failure → `redirect("/rep")`.
3. `keep(k)` helper: `formData.get("keep_"+k) === "on"` (checkbox semantics).
4. **Account (always created — the anchor)** (`intake-actions.ts:30-43`):
   - `domain` = `draft.contact?.email?.split("@")[1]?.split(".")[0]` (first label of host).
   - `accountName` = `draft.account?.name?.trim()` OR (domain ? capitalised domain : "") OR `"New account"`.
   - `prisma.account.create({ name: accountName, region: draft.account?.region?.trim() || "Unknown", segment: "Enterprise", industry: "Unknown", ownerRepId: user.id })`. (`status` defaults to `"ACTIVE"`.)
   - `summaryParts = ["account"]`.
5. **Contact** — only if `keep("contact")` AND `draft.contact` AND (`draft.contact.name` OR `draft.contact.email`) (`intake-actions.ts:47-59`):
   - `name`: `draft.contact.name?.trim()` || `email-local-part` (`email.split("@")[0]`).
   - `title`/`email`/`phone`: trimmed-or-null. `isPrimary: true`. `accountId: account.id`. Push `"contact"`.
6. **Deal** — only if `keep("deal")` AND `draft.deal` (`intake-actions.ts:61-78`):
   - `channel = draft.deal.channel ?? "DIRECT"`.
   - `stage = draft.deal.stage ?? "INTEREST_SHOWN"`.
   - **Reseller guard**: `if (channel === "RESELLER" && !RESELLER_STAGES.includes(stage)) stage = "CUSTOMER_TEST"` — i.e. a reseller deal whose extracted stage is `CONTRACT_NEGOTIATION` (the only stage not in `RESELLER_STAGES`) is rewritten to `CUSTOMER_TEST`. (`RESELLER_STAGES` = all stages except `CONTRACT_NEGOTIATION`, `lib/forecast.ts:30-37`.)
   - `name`: `draft.deal.name?.trim()` || `` `${accountName} opportunity` ``.
   - `probability: probabilityForStage(stage)` (lookup in `STAGE_PROBABILITY`, `lib/forecast.ts:8-16`: INTEREST_SHOWN 10, RFI_ANSWERED 25, RFP_OFFER_GIVEN 45, CUSTOMER_TEST 70, CONTRACT_NEGOTIATION 90, WON 100, LOST 0).
   - `expectedCloseDate`: `draft.deal.expectedCloseDate ? new Date(...) : null`. `status: "OPEN"`. `ownerRepId: user.id`. Push `"deal"`. (No `DealForecastPeriod` rows are created — this deal has no time-phased forecast until edited.)
7. **Case** — only if `keep("case")` AND `draft.case?.title` (`intake-actions.ts:80-91`):
   - `{ accountId, title: trimmed, priority: draft.case.priority ?? "MEDIUM", status:"OPEN", assignedTamId:null }`. Push `"case"`. (No `dueDate` set.)
8. **Task → Note** — only if `keep("task")` AND `draft.task?.body` (`intake-actions.ts:93-98`):
   - `prisma.note.create({ parentType:"ACCOUNT", parentId: account.id, authorId: user.id, body: "Follow-up: "+trimmed })`. Push `"task"`.
9. **Activity event** (`intake-actions.ts:100-107`): `createActivityEvent({ accountId, actorId:user.id, type:"ai_intake_applied", summary: \`${user.name} applied AI-assisted intake (${summaryParts.join(", ")})\`, linkedRecordType:"ACCOUNT", linkedRecordId: account.id })`.
10. **`redirect(\`/accounts/${account.id}\`)`** — lands on Account 360.

Edge cases: account is created even if every checkbox is unchecked (only `["account"]` in the summary). Empty/garbage draft JSON redirects to `/rep` before any write.

#### 1.5 UI — `components/intake-panel.tsx`
- Client component. Textarea + "Generate draft" (disabled while loading or `pasted.trim().length < 10`) + "Use sample email" (fills the hard-coded `SAMPLE` NordSec email, `intake-panel.tsx:22-29` — keep it; it's the demo script's input).
- `generate()` POSTs to `/api/ai/intake`, sets `draft` + `source`.
- When a draft exists, renders a `<form action={applyIntake}>` with a hidden `name="draft"` field = `JSON.stringify(draft)`, a badge showing `source==="ai" ? "AI" : "rules fallback"`, and four `DraftRow` checkboxes (`keep_contact`, `keep_deal`, `keep_case`, `keep_task`, each `defaultChecked`). A row renders only if its data is present (`enabled` prop). Submit = "Apply selected updates →".
- Display formatting: deal line shows `name ?? "Opportunity"` · channel-lowercased · stage with `_`→space lowercased; case shows a destructive badge for priority.

#### 1.6 Re-implementation notes
- Replace the `/api/ai/intake` route with a TanStack Start **server function** `extractIntakeFn({ pasted })` returning `{ draft, source }`. Keep the same 400-equivalent guards (empty/parse).
- Replace `applyIntake(formData)` with a server function `applyIntakeFn({ draft, keep })` where `keep` is `{contact,deal,case,task: boolean}`. Re-implement the exact field defaults, the reseller-stage guard, the account-name derivation, the activity event, and the post-write navigation (TanStack Router `redirect`/`router.navigate` to `/accounts/$id`). **Keep the rule that AI never writes outside this function.** Port the Zod schema and both prompts verbatim. Map `prisma.*.create` to the new data layer; preserve enum string values exactly.
- The "draft as hidden JSON field + checkbox keep flags" pattern can become typed state passed to the server fn — but the semantics (account always created, each section gated by its keep flag + presence) must be identical.

---

### 2. HERO #2 — AI Next Best Action (NBA)

Files: `lib/ai/nba.ts`, `components/nba-panel.tsx`. Mounted on Account 360 (`app/accounts/[id]/page.tsx:237-238`) inside `<Suspense fallback={<NbaSkeleton/>}>`.

#### 2.1 What it does + why
The "magic moment" on the account page: given one account's live state (open deals, open cases, offers, latest note), output the single best next action for the rep, with 1–3 reasons and optionally a draft email. Read-only; must never mutate. Always renders (deterministic fallback).

#### 2.2 Input context — `NbaContext` (built by the panel, `nba.ts:9-21`)
```
{
  accountName: string,
  deals:  { name, stage, channel:"DIRECT"|"RESELLER", daysSinceActivity:number, pastExpectedClose:boolean }[],
  cases:  { title, priority:"LOW"|"MEDIUM"|"HIGH"|"CRITICAL", status }[],
  offers: { status, pendingApproval:boolean }[],
  latestNote?: string | null
}
```
How the panel assembles it (`nba-panel.tsx:30-51`), in parallel:
- `account = prisma.account.findUnique({ where:{id} })`.
- `deals = prisma.deal.findMany({ where:{ accountId, status:"OPEN" } })` → each: `daysSinceActivity = daysSince(d.lastActivityAt)`, `pastExpectedClose = !!d.expectedCloseDate && d.expectedCloseDate.getTime() < Date.now()`.
- `cases = prisma.case.findMany({ where:{ accountId, status:{ not:"CLOSED" } } })` → `{ title, priority, status }`.
- `offers = prisma.offer.findMany({ where:{ accountId } })` → `pendingApproval = status==="PENDING_SM" || status==="PENDING_FINANCE"`.
- `latestNote = prisma.note.findFirst({ where:{ parentType:"ACCOUNT", parentId: accountId }, orderBy:{ createdAt:"desc" } })?.body ?? null`.

`daysSince(date)` = `Math.round((Date.now() - date)/86_400_000)` (`lib/utils.ts:32-34`).

#### 2.3 Output schema — `NbaSchema` / `Nba` (`nba.ts:23-28`)
```
{ recommendation: string, reasons: string[]  (min 1, max 3), draftEmail: string | null }
```

#### 2.4 EXACT system prompt (`nba.ts:30-35`)
```
You are a sales analyst embedded in HMD Secure's CRM.
Given one account's current state, output the single best next action for the sales rep.
Return STRICT JSON: { "recommendation": string, "reasons": string[1..3], "draftEmail": string|null }.
Be concrete and specific to the data. Prefer unblocking deals: an open high-priority case blocks a close;
a stalled deal (>14 days) needs a follow-up; an offer pending approval needs a nudge; a deal in customer
test needs a decision meeting. Only include draftEmail if an outbound email is the recommended action.
```

#### 2.5 EXACT user message (`nba.ts:41`)
```
Account state:
${JSON.stringify(ctx, null, 2)}
```
`maxTokens: 450`.

#### 2.6 Logic — `nextBestAction(ctx)` (`nba.ts:37-46`)
1. `aiJSON<Nba>` with the prompt above.
2. If result, `NbaSchema.safeParse`; on success → `{ nba: parsed.data, source:"ai" }`.
3. Else → `{ nba: fallbackNba(ctx), source:"fallback" }`.

#### 2.7 Deterministic fallback — `fallbackNba(ctx)` (`nba.ts:49-92`) — BUILD-SPEC priority order
Compute these signals first:
- `hotCase` = first case with `(priority==="HIGH"||priority==="CRITICAL") && status!=="CLOSED"`.
- `pendingOffer` = first offer with `pendingApproval`.
- `staleDeal` = first deal with `daysSinceActivity >= 14`.
- `pastClose` = first deal with `pastExpectedClose`.
- `inTest` = first deal with `stage==="CUSTOMER_TEST"`.

Then return the **first** matching branch (priority order is strict):
1. **hotCase** → recommendation `` `Resolve the open ${priority.toLowerCase()}-priority case "${title}" before pushing any deal.` ``; reasons `["An unresolved high-priority service case erodes trust and blocks the close.", "TAM should be engaged so sales can keep momentum."]`; `draftEmail: null`.
2. **pendingOffer** → `"Chase the pending offer approval so the deal can move forward."`; reasons `["An offer is stuck awaiting approval.", "Approvals left idle slip the close date."]`; `draftEmail: null`.
3. **inTest** → `` `Schedule a decision meeting — "${inTest.name}" is in Customer Test.` ``; reasons `["Customer test is the highest-win-signal stage before close.", "A decision meeting converts evaluation into commitment."]`; `draftEmail` = the verbatim "Thanks for evaluating HMD Secure…" template (`nba.ts:77`).
   - **Note the ordering nuance**: `inTest` is checked *before* `pastClose`/`staleDeal`, so a customer-test deal that is also stale yields the decision-meeting advice.
4. **pastClose || staleDeal** → let `d = pastClose ?? staleDeal`. recommendation `` `Follow up on "${d.name}" — it's ${pastClose ? "past its expected close date" : \`stalled (${d.daysSinceActivity} days no activity)\`}.` ``; reasons `[pastClose ? "The expected close date has passed." : "No activity for 14+ days signals risk.", "A timely touch keeps the deal alive."]`; `draftEmail` = the verbatim "Checking in on where things stand with ${d.name}…" template (`nba.ts:84`).
5. **default** → `"Log your latest conversation and confirm the next concrete step with the customer."`; reasons `["Keeping the timeline current makes every later analysis accurate."]`; `draftEmail: null`.

The two email templates are load-bearing demo copy — port verbatim:
- inTest: `"Hi,\n\nThanks for evaluating HMD Secure. Now that testing is underway, could we set up a short call this week to review results and outline next steps toward rollout?\n\nBest regards"`
- follow-up: `"Hi,\n\nChecking in on where things stand with ${d.name}. Happy to answer any open questions or adjust the proposal — what would help you move forward?\n\nBest regards"`

#### 2.8 UI — `components/nba-panel.tsx`
- Server component (async). `NbaSkeleton` is a pulsing placeholder shown via Suspense.
- Badge: `source==="ai" ? "AI" : "AI · rules"`. Renders `recommendation` (bold), reasons as a bulleted list, and `draftEmail` (if present) inside a collapsible `<details>` with a `<pre>` block.

#### 2.9 Re-implementation notes
- The panel is a server-rendered component that builds the context from 5 parallel queries, then calls `nextBestAction`. In TanStack Start, do the 5 reads + `nextBestAction` inside a `createServerFn` (or route loader) and stream the result; preserve `Promise.all` parallelism and the Suspense/skeleton UX.
- Port `fallbackNba` exactly — the branch order, the literal strings, and the two email templates are the demo's guaranteed output when no key is set.
- Map Prisma reads to the data layer; keep the `daysSince` and `pastExpectedClose` derivations identical (UTC-agnostic, `Date.now()`-based).

---

### 3. HERO #3 supplement — AI forecast narrative

Files: `lib/ai/forecast-narrative.ts`, `components/forecast-narrative-card.tsx`. Mounted on Manager (`app/manager/page.tsx:84-85`) and Finance (`app/finance/page.tsx:105-106`) in `<Suspense fallback={<ForecastNarrativeSkeleton/>}>`.

#### 3.1 What it does + why
A 2–3 sentence natural-language "Pipeline health" summary for Finance/Manager readers, citing the biggest risk and one recommended action. Read-only. Always renders (templated fallback).

#### 3.2 Input — `ForecastSummary` (`forecast-narrative.ts:7-16`)
```
{ weightedTotal, totalRevenue, deviceRevenue, serviceRevenue,
  nearTermWeighted, quartersCount, stalledCount, pastCloseCount }   // all numbers
```
Built by the card (`forecast-narrative-card.tsx:27-44`), in parallel:
- `forecast = threeYearForecast()` (`lib/reporting.ts:46`) → totals `{ weightedRevenue, totalRevenue, deviceRevenue, serviceRevenue, grossMargin }` and `quarters[]`.
- `stalled = stalledDeals()` (OPEN deals idle ≥14d) → `stalledCount = stalled.length`.
- `pastClose = pastCloseDeals()` (OPEN deals past `expectedCloseDate`) → `pastCloseCount`.
- `nearTermWeighted = forecast.quarters.slice(0,2).reduce((s,q)=>s+q.weightedRevenue,0)` (next 2 quarters, weighted).
- `quartersCount = forecast.quarters.length`.

Currency helper: `eur(n) = "€" + Math.round(n).toLocaleString("en-IE")` (`forecast-narrative.ts:18`).

#### 3.3 EXACT system prompt (`forecast-narrative.ts:30-31`)
```
You are a finance analyst for HMD Secure. In 2-3 short sentences, summarise pipeline health for a Sales Manager / Finance reader. Be concrete, cite the biggest risk, and end with one recommended managerial action. No markdown, no bullet points, plain prose.
```

#### 3.4 EXACT user message (`forecast-narrative.ts:21-32`)
The `facts` string is built by joining these five with `"; "`:
```
weighted 3-year pipeline ${eur(weightedTotal)} (unweighted ${eur(totalRevenue)})
device revenue ${eur(deviceRevenue)} vs service revenue ${eur(serviceRevenue)}
near-term (next 2 quarters) weighted ${eur(nearTermWeighted)}
${quartersCount} quarters of coverage
${stalledCount} stalled deals, ${pastCloseCount} past expected close
```
User message = `` `Pipeline facts: ${facts}.` ``. `maxTokens: 220`.

#### 3.5 Logic — `forecastNarrative(s)` (`forecast-narrative.ts:20-49`)
1. `aiText` with the prompt above. If non-null → `{ text, source:"ai" }`.
2. Else templated fallback:
   - `risk` = if `stalledCount + pastCloseCount > 0`: `` `${stalledCount} stalled and ${pastCloseCount} past-close deals put part of this at risk — chase those first.` `` else `"No deals are stalled or past close, so the forecast is currently clean."`.
   - `text` = `` `The weighted 3-year pipeline stands at ${eur(weightedTotal)} across ${quartersCount} quarters, split ${eur(deviceRevenue)} device and ${eur(serviceRevenue)} service revenue. Near-term (next two quarters) weighted value is ${eur(nearTermWeighted)}. ${risk}` ``; `source:"fallback"`.

#### 3.6 UI — `components/forecast-narrative-card.tsx`
Async server component; `ForecastNarrativeSkeleton` for Suspense. Title "Pipeline health"; badge `source==="ai" ? "AI" : "AI · rules"`; renders `text` as a paragraph.

#### 3.7 Re-implementation notes
- This card depends on `threeYearForecast`/`stalledDeals`/`pastCloseDeals` from the reporting subsystem — re-use whatever those become in the new stack; do not duplicate the aggregation. Compute the 8-field `ForecastSummary` in a server fn / loader, then call `forecastNarrative`. Keep `eur()` formatting (`en-IE`, `€` prefix, rounded) so AI and fallback text match the dashboards.

---

### 4. AI case summary (P2 #22)

Files: `lib/ai/case-summary.ts`, `components/case-summary-card.tsx`. Mounted on case detail (`app/cases/[id]/page.tsx:166-174`) inside Suspense.

#### 4.1 What it does + why
A one-paragraph (≤3 sentence) summary of a support case for a colleague picking it up cold, **rendered only when the case has ≥ `MIN_NOTES_FOR_SUMMARY` (5) notes** (`case-summary.ts:7`, gate at `page.tsx:166`). Read-only.

#### 4.2 Input
`caseSummary({ title: string, description?: string|null, notes: string[] })` → `{ text, source }` (`case-summary.ts:9-13`).
- The card receives `notes = notes.map(n => n.body)` (`page.tsx:171`).
- **Important ordering bug-to-preserve-or-fix**: `caseNotes(caseId)` (`lib/cases.ts:51`) orders `createdAt: "desc"` (**newest first**), but the prompt user message labels them "Notes (oldest first)" and the fallback treats `notes[0]` as "It began" / last as "Latest update". In the current build the array is newest-first, so `notes[0]` is actually the *latest* note. When re-implementing, **either keep the exact same wiring (newest-first array)** or, if you fix it, do so consciously — the constants and prompt text below are verbatim from the current code.

#### 4.3 EXACT system prompt (`case-summary.ts:17`)
```
You are a TAM assistant for HMD Secure. Summarise this support case in ONE short paragraph (≤3 sentences) for a colleague picking it up cold: what the issue is, where it stands now, and the next step. Plain prose, no markdown, no lists.
```
(The `≤` is a literal Unicode character in the source.)

#### 4.4 EXACT user message (`case-summary.ts:18`)
`thread` = notes joined as `` `${i+1}. ${note}` `` per line. User =
```
Case: ${title}
${description ?? ""}
Notes (oldest first):
${thread}
```
`maxTokens: 200`.

#### 4.5 Logic (`case-summary.ts:14-29`)
1. `aiText` with the above → if non-null, `{ text, source:"ai" }`.
2. Fallback: `first = notes[0] ?? ""`, `last = notes[notes.length-1] ?? ""`; `text = \`${title}. It began: "${first}" Latest update: "${last}" (${notes.length} notes on file.)\``; `source:"fallback"`.

#### 4.6 UI — `components/case-summary-card.tsx`
Async server component; `CaseSummarySkeleton` for Suspense. Title "Case summary"; badge `source==="ai" ? "AI" : "AI · rules"`; paragraph of `text`. **Render gate (`MIN_NOTES_FOR_SUMMARY`) lives in the page, not the component** — the component will summarise any note count it's given.

#### 4.7 Re-implementation notes
- Keep the `MIN_NOTES_FOR_SUMMARY = 5` constant and gate the card render on `notes.length >= 5` in the route/page (not inside the summariser). Compute the summary in a server fn / loader and stream via Suspense.

---

### 5. "Aino" AI assistant (in-app analyst)

Files: `lib/ai/assistant.ts`, `app/api/ai/assistant/route.ts`, `components/ai-assistant.tsx`. The floating chat is mounted globally in the root layout (`app/layout.tsx:17`).

#### 5.1 What it does + why
A floating bottom-right chat ("Aino, AI analyst"). On open it shows a **personalised, role-aware greeting + up to 4 proactive action chips**; the user can ask free-form questions answered against a **live, role-scoped data snapshot** plus usage help. Read-only. Always responds (keyword fallback).

#### 5.2 Role-aware snapshot — `snapshot(userId, role)` (`assistant.ts:16-50`)
Builds a multi-line plain-text snapshot of live data; the lines depend on role. `eur(n) = "€" + Math.round(n).toLocaleString("en-IE")`.

- **REP** (`assistant.ts:18-32`): parallel reads of owned accounts (`ownerRepId`), open deals (`ownerRepId, status:"OPEN"`, include account), pending offers count (`createdById`, status in `["PENDING_SM","PENDING_FINANCE"]`), and won/lost groupBy. Computes `won`/`lost`, `atRisk` = open deals where `daysSince(lastActivityAt) >= 14 || (expectedCloseDate && expectedCloseDate < now)`, and a `byStage` count map. Lines:
  - `My book: N accounts — <first 8 names>.`
  - `My open deals: N (by stage: STAGE n, …). Offers awaiting approval: P.`
  - `Closed so far: W won, L lost.`
  - `At-risk deals (K): <first 5: name [account, Nd idle]>.`
- **SALES_MANAGER** (`assistant.ts:33-39`): parallel `stalledDeals()`, `pastCloseDeals()`, pending-SM offer count (`status:"PENDING_SM"`), `forecastCategories()`, and all reps; then per-rep open-deal counts. Lines:
  - `My team: <rep (n open), …>.`
  - `Stalled deals (>14d): N. Past expected close: M. Offers awaiting MY (SM) approval: P.`
  - `Forecast: committed €…, at-risk €…, target €…, gap €….` (from `forecastCategories()`, `lib/targets.ts`: committed/atRisk/target/gapToTarget; `TEAM_TARGET_3YR = 30_000_000`).
  - `Top stalled: <first 4 names>.`
- **FINANCE** (`assistant.ts:40-42`): `threeYearForecast()` + pending-Finance offer count. Line:
  - `3-yr weighted pipeline: €… (device €… / service €…). Offers awaiting MY (Finance) approval: P.`
- **TAM** (`assistant.ts:43-48`): open cases (`assignedTamId`, status not CLOSED); `overdue` = cases with `dueDate && dueDate < now`. Lines:
  - `My open cases: N. Overdue (SLA): K.`
  - `Open cases: <first 5: title [PRIORITY]>.`

#### 5.3 Static HELP text (`assistant.ts:52-57`) — verbatim, used by guidance answers and the fallback
```
How the CRM works (for guidance answers):
- Apply a discount: open a deal → "Build offer" → add catalog items → set discount % + a justification → Submit. It routes to the Sales Manager, then Finance.
- Open a service case: open the account → "New case".
- Move a deal stage: open the deal → "Move stage". Reseller deals have no Contract-negotiation stage.
- See the forecast: Finance/Manager dashboards (3-year, device vs service, stage-weighted).
- Notifications are in-app (bell, top-right).
```

#### 5.4 Greeting + proactive actions — `assistantGreeting({ userId, role, name })` (`assistant.ts:62-105`)
Returns `{ greeting, actions: AinoAction[] }` where `AinoAction = { label, prompt }`. `first = name.split(" ")[0]`. Builds a role-specific `situational` string + actions, then:
- Final greeting = `` `Hi ${first} 👋 — ${situational} Where do you want to start?` ``.
- `actions` is sliced to the first 4 (`assistant.ts:103`).

Per role:
- **REP**: read open deals + pending-offer count. `atRisk` (same predicate as snapshot) sorted by most-idle. `situational` = `` `you have N at-risk deal(s)[ and P offer(s) in approval].` ``. Actions: if `atRisk[0]`, `{ label:\`Follow up: ${atRisk[0].name}\`, prompt:\`How should I follow up on the deal "${atRisk[0].name}" at ${account.name}? Draft a short email.\` }`; if `pending`, `{ label:"Check offers in approval", prompt:"What's the status of my offers in approval and what should I do about them?" }`; always `{ label:"Plan my day", prompt:"What are the top 3 things I should do today, most urgent first?" }`.
- **SALES_MANAGER**: `stalledDeals()` + pending-SM count. `situational` = `` `N stalled deal(s) need attention[ and P offer(s) awaiting your approval].` ``. Actions: if `pendingSM`, `{ "Review approvals", "Which offers are waiting for my approval and should I approve them?" }`; if `stalled[0]`, `{ \`Unstick: ${stalled[0].name}\`, \`The deal "${stalled[0].name}" is stalled — what should I do and who should own it?\` }`; always `{ "Where's my gap to target?", "What's my committed vs at-risk vs gap to target, and how do I close the gap?" }`.
- **FINANCE**: pending-Finance count. `situational` = `P discounted offer(s) need your second approval.` or `the pipeline forecast is ready for you.`. Actions: if `pendingFin`, `{ "Review Finance approvals", "Which offers need my Finance approval and are the discounts justified?" }`; always `{ "Pipeline health", "Summarise the 3-year weighted pipeline health and the biggest risk." }` and `{ "Plan my day", "What are the top 3 things I should do today?" }`.
- **TAM** (else branch): open cases. `situational` = `` `you have N open case(s)[, K past SLA].` ``. `worst` = cases sorted so CRITICAL first. Actions: if `worst`, `{ \`Tackle: ${worst.title}\`, \`What should I do about the case "${worst.title}"? Summarise where it stands and the next step.\` }`; always `{ "My day", "Which cases should I work first today, most urgent first?" }`.

(Singular/plural suffixes — `deal`/`deals`, `offer`/`offers`, `case`/`cases`, `needs`/`need` — are computed inline; preserve them, they show in the UI.)

#### 5.5 Ask — `askAino(question, { userId, role, name })` (`assistant.ts:107-134`)
1. `snap = snapshot(userId, role)`.
2. `aiText` with this **EXACT system message** (`assistant.ts:111-117`), interpolating `name`, `role`, `snap`, and `HELP`:
```
You are "Aino", the AI analyst built into HMD Secure's CRM. The user is ${name} (role: ${role}). Talk to them like a proactive colleague who already knows their book of business — lead with WHAT TO DO, not how the tool works. Answer concisely and CONCRETELY using the live data snapshot below, naming specific deals/cases/accounts and numbers. If they ask what to do / to plan their day / where to start, give a SHORT PRIORITISED list (most urgent first, ~3 items) of concrete next actions tied to specific records. Only explain how-to steps if they explicitly ask how. 1-4 sentences (or a tight 3-item list), plain prose, no markdown.

LIVE DATA:
${snap}

${HELP}
```
   User message = the raw `question`. `maxTokens: 280`. If non-null → `{ answer, source:"ai" }`.
3. **Deterministic keyword fallback** (`assistant.ts:124-133`), `q = question.toLowerCase()`, first match wins:
   - `/risk|stalled|stuck|overdue|past close/` → the snapshot line matching `/at-risk|stalled|overdue/i`, else whole `snap`.
   - `/forecast|pipeline|committed|target|gap|revenue/` → line matching `/forecast|weighted|pipeline/i`, else `snap`.
   - `/approv|offer|discount|pending/` → if also `/how|apply|create|build/`, the HELP line matching `/discount/i` (else HELP); otherwise whole `snap`.
   - `/case|ticket|issue|support|sla/` → line matching `/case/i`, else HELP.
   - `/how|where|do i|guide|help/` → whole HELP.
   - default → `` `Here's where things stand:\n${snap}` ``.
   All fallback returns carry `source:"fallback"`.

#### 5.6 API route — `app/api/ai/assistant/route.ts`
- **GET** = greeting. `user = currentUser()`; if none → `{ greeting:"Pick a demo user first (top-right → Switch role).", actions:[] }`. Else `assistantGreeting({ id, role, name })` → `{ greeting, actions }`.
- **POST** = ask. If no user → `{ answer:"Pick a demo user first…", source:"fallback" }`. Reads `question = String(body?.question ?? "").trim()`; if empty → `{ answer:"Ask me anything about your accounts, deals, pipeline, or how to use the CRM.", source:"fallback" }`. Else `askAino(question, user)` → `{ answer, source }`.

#### 5.7 UI — `components/ai-assistant.tsx`
- Client component, fixed bottom-right "Ask Aino" pill → opens a 28rem×22rem panel.
- On first open (once): `GET /api/ai/assistant` → seeds messages with the greeting + stores `actions`.
- `send(question)`: appends a user message, `POST /api/ai/assistant {question}`, appends Aino's `answer`; shows "Aino is thinking…" while busy; network error → `"I couldn't reach the server just now — try again."`.
- Action chips render only while `msgs.length <= 1` (i.e. just the greeting); each chip sends its `prompt`. There's also a static `"How do I use this?"` chip sending `"How do I use this CRM?"`.

#### 5.8 Re-implementation notes
- `snapshot`, `assistantGreeting`, `askAino` are `server-only` and depend heavily on the data layer + reporting/targets (`stalledDeals`, `pastCloseDeals`, `threeYearForecast`, `forecastCategories`) and the demo session (`currentUser`). In TanStack Start: one server fn `ainoGreetingFn()` (reads current user from request context / session cookie) and one `ainoAskFn({ question })`. Keep the cookie-based demo `currentUser` semantics (fallback to first REP by email) or re-map to the new auth.
- Port all snapshot line templates, the HELP block, the `situational` strings (with plural logic), the action labels/prompts, and the keyword fallback regexes verbatim — they are the assistant's guaranteed offline behaviour and visible UI copy.
- The greeting chip gating (`msgs.length <= 1`) and the "fetch greeting once on open" behaviour are pure client logic — straightforward to port to a React component in the new stack.

---

### 6. Cross-cutting re-implementation checklist
1. **Keep `hasAI()` as the single gate**; every feature must degrade to its deterministic fallback with no key and never throw.
2. **AI never writes to the DB** except `applyIntake`, which is user-gated (checkboxes) and goes through normal data-layer creates + an activity event + redirect.
3. **Server-only boundary**: the API key, all prompts, and all snapshot reads stay server-side (Featherless calls + Prisma reads). In TanStack Start use `createServerFn` / `*.server.ts`; never ship the key or the OpenAI client to the browser.
4. **Suspense/streaming** is used for NBA, case summary, and forecast narrative so the AI call never blocks first paint — preserve with TanStack Router loaders/`<Await>` or Suspense.
5. **Verbatim assets to port**: every system prompt, every user-message template, the two NBA email templates, the HELP block, all `situational`/snapshot strings, all fallback strings, the intake `SAMPLE` email, the keyword-fallback regexes, and these constants — `MIN_NOTES_FOR_SUMMARY=5`, `STAGE_PROBABILITY` map, `RESELLER_STAGES`, `TEAM_TARGET_3YR=30_000_000`, `DEVICE_GM_PCT=0.35`/`SERVICE_GM_PCT=0.55`, default model `Qwen/Qwen2.5-7B-Instruct`, base URL `https://api.featherless.ai/v1`, temperatures 0.2 (JSON)/0.4 (text), and token caps (intake 700, NBA 450, forecast 220, case 200, Aino ask 280, defaults 800/400).
6. **Enum string values** (`DealStage`, `Channel`, `Priority`, `CaseStatus`, `OfferStatus`, `Role`, `NoteParentType`) must remain byte-identical between the prompts, Zod schemas, and the data layer.
7. **Known wiring quirk** (decide consciously): case-summary notes arrive **newest-first** (`caseNotes` orders `createdAt: "desc"`) while the prompt/fallback assume oldest-first — see §4.2.

**Relevant files (absolute paths):**
- `/Users/huataipan/Wichai/Hackathons/sales-hackathons-prompt/lib/ai/client.ts`
- `/Users/huataipan/Wichai/Hackathons/sales-hackathons-prompt/lib/ai/intake.ts`
- `/Users/huataipan/Wichai/Hackathons/sales-hackathons-prompt/lib/ai/nba.ts`
- `/Users/huataipan/Wichai/Hackathons/sales-hackathons-prompt/lib/ai/case-summary.ts`
- `/Users/huataipan/Wichai/Hackathons/sales-hackathons-prompt/lib/ai/forecast-narrative.ts`
- `/Users/huataipan/Wichai/Hackathons/sales-hackathons-prompt/lib/ai/assistant.ts`
- `/Users/huataipan/Wichai/Hackathons/sales-hackathons-prompt/app/api/ai/intake/route.ts`
- `/Users/huataipan/Wichai/Hackathons/sales-hackathons-prompt/app/api/ai/assistant/route.ts`
- `/Users/huataipan/Wichai/Hackathons/sales-hackathons-prompt/app/rep/intake-actions.ts`
- `/Users/huataipan/Wichai/Hackathons/sales-hackathons-prompt/components/intake-panel.tsx`
- `/Users/huataipan/Wichai/Hackathons/sales-hackathons-prompt/components/nba-panel.tsx`
- `/Users/huataipan/Wichai/Hackathons/sales-hackathons-prompt/components/forecast-narrative-card.tsx`
- `/Users/huataipan/Wichai/Hackathons/sales-hackathons-prompt/components/case-summary-card.tsx`
- `/Users/huataipan/Wichai/Hackathons/sales-hackathons-prompt/components/ai-assistant.tsx`
- Dependencies: `/Users/huataipan/Wichai/Hackathons/sales-hackathons-prompt/lib/forecast.ts`, `lib/reporting.ts`, `lib/targets.ts`, `lib/utils.ts`, `lib/session.ts`, `lib/activity.ts`, `lib/cases.ts`, `prisma/schema.prisma`
- Mount points: `app/layout.tsx:17`, `app/rep/page.tsx:67`, `app/accounts/[id]/page.tsx:237`, `app/cases/[id]/page.tsx:166`, `app/manager/page.tsx:84`, `app/finance/page.tsx:105`

---

I now have full coverage of the PLATFORM subsystem. Here is the migration spec.

## PLATFORM (auth/roles, notifications, search, activity, navigation)

This subsystem covers the cross-cutting foundation of the HMD Secure CRM: the demo session/auth model, role-based access + default-view routing, the in-app notification system, global search, the account activity timeline, and the preset "smart views". None of it depends on Azure/Featherless AI — it is pure session + Prisma data access + server-rendered pages. The whole thing must survive the move from Next.js App Router (server components + server actions + `next/headers` cookies + `redirect()`) to TanStack Start (server functions / route loaders + the framework's request/cookie helpers + `redirect()`).

---

### 1. Auth / Session model (demo role-switch)

**File:** `lib/session.ts`

#### 1a. What it does + why
There is **no real auth** in the demo. Production auth is intended to be Microsoft Entra ID SSO (deferred per BUILD-SPEC). The whole app runs as "whichever seeded user the demo cookie points at." This makes the role-switch-heavy demo work: one click changes the active identity and every page re-renders for the new role.

#### 1b. Exact business rules
1. The session is a single **httpOnly cookie** named `hmd_demo_user` (constant `SESSION_COOKIE`, `lib/session.ts:9`). Its value is a `User.id` (cuid).
2. Cookie attributes when set (`lib/session.ts:39-44`): `httpOnly: true`, `sameSite: "lax"`, `path: "/"`, `maxAge: 60*60*24*7` (7 days = 604800 s). No `secure` flag is set in source (add behind TLS in prod).
3. `currentUser()` (`lib/session.ts:15-29`): reads the cookie; if a value exists, looks up `prisma.user.findUnique({ where: { id } })`. If that returns a user, return it.
4. **Demo fallback (critical, never dead-end):** if there is no cookie, OR the cookie's id does not resolve to a user, fall back to the first Sales Rep: `prisma.user.findFirst({ where: { role: "REP" }, orderBy: { email: "asc" } })` (`lib/session.ts:24-28`). With seed data this is **Raj Rep** (`raj@hmd.demo`) because `raj` < `sofia` alphabetically — note: despite the demo intent of "Sofia", `orderBy email asc` actually selects Raj. Preserve `orderBy email asc` exactly; do not "fix" it silently or the default landing identity changes.
5. `currentUser()` can still return `null` only if there are **zero** REP users in the DB. Callers must handle null (they redirect to `/role-switch`).
6. `currentRole()` (`lib/session.ts:31-34`): returns `currentUser()?.role ?? null`. It re-runs the full user lookup (no caching). Returns a `Role` enum value or null.
7. `setDemoUser(userId)` (`lib/session.ts:37-45`): writes the cookie. **Must only be called from a server action / route handler** (mutating cookies from a render is illegal in Next; same constraint applies to TanStack server functions vs loaders).
8. `clearDemoUser()` (`lib/session.ts:48-51`): deletes the cookie. (Defined but **not currently called anywhere** — there is no "sign out" button; switching role just overwrites the cookie. Keep it for parity / future sign-out.)
9. `dashboardPathForRole(role)` (`lib/session.ts:54-67`) is a **pure** function mapping role → default route:
   - `REP` → `/rep`
   - `TAM` → `/tam`
   - `SALES_MANAGER` → `/manager`
   - `FINANCE` → `/finance`
   - default → `/`

#### 1c. Data shapes
- **Reads:** `User` model (`prisma/schema.prisma:114-130`): `{ id, name, email (unique), role: Role, createdAt, ...relations }`.
- **Role enum** (`schema.prisma:16-21`): `REP | TAM | SALES_MANAGER | FINANCE`.
- **Seed users** (`prisma/seed.ts:102-117`) — the demo user set selectable on `/role-switch`:
  | name | email | role |
  |---|---|---|
  | Sofia Rep | sofia@hmd.demo | REP |
  | Raj Rep | raj@hmd.demo | REP |
  | Timo TAM | timo@hmd.demo | TAM |
  | Lena TAM | lena@hmd.demo | TAM |
  | Mira Sales Manager | mira@hmd.demo | SALES_MANAGER |
  | Fiona Finance | fiona@hmd.demo | FINANCE |

#### 1d. Re-implementation notes (TanStack Start)
- Replace `cookies()` from `next/headers` with TanStack Start's request/response cookie access (e.g. `getCookie`/`setCookie` from `@tanstack/react-start/server` or `vinxi/http`'s `getCookie`/`setCookie`/`deleteCookie`). Keep the exact cookie name `hmd_demo_user` and the same attributes.
- `currentUser()` / `currentRole()` become **server-only** helpers callable from route loaders and server functions. They are async and hit the DB on every call; safe to call multiple times per request, but you may want a per-request memo.
- `setDemoUser` / `clearDemoUser` must run inside a **server function** (the mutation path), not a loader.
- `dashboardPathForRole` is pure — copy verbatim.

---

### 2. Role-switch flow

**File:** `app/role-switch/page.tsx`

#### 2a. What it does
Renders a card grid of every seeded user; clicking "Continue as <FirstName>" sets the session cookie and lands the user on their role's dashboard. This is the demo's "login screen."

#### 2b. Exact rules / logic
1. **Page render** (`role-switch/page.tsx:40-41`): lists all users via `prisma.user.findMany({ orderBy: [{ role: "asc" }, { email: "asc" }] })`. So users are grouped by role enum order, then email ascending within a role.
2. Each card shows `ROLE_LABEL[role]` and `ROLE_BLURB[role]` (`role-switch/page.tsx:13-25`):
   - REP → "Sales Rep" / "Accounts, deals, offers, next best action."
   - TAM → "Technical Account Manager" / "Assigned cases and service history."
   - SALES_MANAGER → "Sales Manager" / "Team pipeline, stalled deals, approvals."
   - FINANCE → "Finance" / "3-year forecast, catalog, finance approvals."
   - (Note: `ROLE_LABEL` here differs from `components/nav.tsx`'s label for TAM — nav says "TAM", this page says "Technical Account Manager". Keep both labels as-is per file.)
3. Button text: `Continue as {u.name.split(" ")[0]}` (first word of name).
4. The form posts hidden `userId` and `role` fields; only `userId` is consumed.
5. **`switchTo(formData)` server action** (`role-switch/page.tsx:27-38`):
   a. Read `userId = String(formData.get("userId"))`.
   b. `await setDemoUser(userId)` — writes cookie.
   c. `revalidatePath("/", "layout")` — **busts the cache for every route under the root layout** so the new role sees fresh per-user data everywhere (approval queues, notification badge, dashboards). The inline comment flags this as critical for the role-switch-heavy demo (`role-switch/page.tsx:31-34`).
   d. Look up the user again: `prisma.user.findUnique({ where: { id: userId } })`.
   e. `redirect(user ? dashboardPathForRole(user.role) : "/")`.

#### 2c. Re-implementation notes
- The server action becomes a TanStack **server function** (POST). After setting the cookie, throw `redirect({ to: dashboardPathForRole(role) })`.
- `revalidatePath("/", "layout")` has **no direct TanStack equivalent** — TanStack doesn't have Next's segment cache. Equivalent behavior: ensure loaders are not over-cached and invalidate the router after the mutation (e.g. `router.invalidate()` on the client, or rely on a redirect causing fresh loader runs). The intent to preserve: **after switching role, every visible piece of per-user data (nav badge, dashboards, approval queues) must reflect the new user, never the previous role's cached view.** If using TanStack Query, invalidate all queries keyed on the current user.

---

### 3. Role-based access + default-view routing (guards)

Guards are **inline per-page**, not a shared middleware. There are two patterns. Re-implement each gated route with the same logic in its TanStack loader (`beforeLoad`/`loader`), throwing `redirect()` on failure.

#### 3a. Pattern A — "bounce Rep/TAM to their own dashboard" (manager + finance)
- `app/manager/page.tsx:45-47`:
  1. `const user = await currentUser()`
  2. `if (!user) redirect("/role-switch")`
  3. `if (user.role === "REP" || user.role === "TAM") redirect(dashboardPathForRole(user.role))`
  4. Only `SALES_MANAGER` and `FINANCE` proceed to the org-wide pipeline.
- `app/finance/page.tsx:37-39`: **identical** logic (only `SALES_MANAGER` + `FINANCE` see the org-wide forecast; Rep/TAM bounce to their own dashboard via `dashboardPathForRole`).

#### 3b. Pattern B — "FINANCE-only, else /role-switch" (catalog)
- `app/catalog/page.tsx:60-63`:
  1. `const role = await currentRole()`
  2. `if (role !== "FINANCE") redirect("/role-switch")`
  3. Only Finance sees the product/service catalog.

#### 3c. Pattern C — login gate only (rep, tam, reports, notifications)
- `app/rep/page.tsx:18`: `if (!user) redirect("/role-switch")` — no role restriction beyond being signed in (any role that navigates to `/rep` sees the rep desk).
- `app/reports/page.tsx:33`: `if (!user) redirect("/role-switch")` — login gate only (nav exposes Reports to SM+Finance, but the page itself only requires a user).
- `app/notifications/page.tsx:25`: `if (!user) redirect("/role-switch")`.
- `app/tam/page.tsx`: **no redirect guard** — header comment says "Non-TAM users still see it, flagged as the TAM view." Renders the current user's assigned cases regardless of role.

#### 3d. Pattern D — soft, content-level role gating (approvals)
The approval queue is **not** a hard redirect; it shows a friendly empty state for non-actors.
- `app/approvals/page.tsx:31-54`:
  1. `const role = await currentRole()`
  2. `queueStatus = role === "SALES_MANAGER" ? "PENDING_SM" : role === "FINANCE" ? "PENDING_FINANCE" : null`
  3. If `queueStatus` is null (Rep/TAM/no role), render an info card: "The approval queue is available to Sales Managers and Finance. Your current role has no offers to act on." + a "Switch role" link. No redirect.
  4. Otherwise query offers in that status.
- `app/approvals/[offerId]/page.tsx:61-80`: computes `canActAsSM = role === "SALES_MANAGER" && offer.status === "PENDING_SM"` and `canActAsFinance = role === "FINANCE" && offer.status === "PENDING_FINANCE"`. These flags gate the action buttons (not page access). `notFound()` if the offer id doesn't exist.

#### 3e. Re-implementation notes
- Implement each guard in the **route's loader / `beforeLoad`**. `redirect("/x")` → `throw redirect({ to: "/x" })`.
- There is **no central auth middleware** today; you may centralize, but you MUST preserve the per-route differences: manager/finance bounce Rep+TAM (not to /role-switch but to their *own* dashboard); catalog hard-redirects non-Finance to /role-switch; approvals does a soft content gate (no redirect); rep/tam/reports/notifications only require a logged-in user. Do not collapse these into one uniform rule.
- The nav link visibility (section 7) is **cosmetic only** — it does not enforce access. Real enforcement is the loader guards above. Both must be reproduced.

---

### 4. In-app Notification system

**Files:** `lib/notify.ts`, `app/notifications/page.tsx`, `app/notifications/actions.ts`. Badge in `components/nav.tsx`.

#### 4a. What it does + why
A purely in-app inbox. **BUILD-SPEC hard rule: no outbound email** (`lib/notify.ts:1`). Every cross-role event (offer submitted, approved, rejected; case assigned/escalated/commented; deal reassigned) creates a `Notification` row for a recipient user. The nav bell shows an unread count; the inbox lists them and deep-links to the linked record.

#### 4b. Exact business rules
1. `notify(input)` (`lib/notify.ts:15-25`) creates one `Notification` row. `linkedRecordType` / `linkedRecordId` default to `null` if omitted.
2. `listNotifications(recipientId, take=30)` (`lib/notify.ts:27-33`): `findMany` where `recipientId`, `orderBy createdAt desc`, `take` (default 30; the inbox page passes **50**).
3. `unreadCount(recipientId)` (`lib/notify.ts:35-39`): `count` where `recipientId` AND `readAt: null`.
4. `markRead(id)` (`lib/notify.ts:41-46`): set `readAt = new Date()` on one notification by id. No ownership check — any id can be marked read.
5. `markAllRead(recipientId)` (`lib/notify.ts:48-53`): `updateMany` where `recipientId` AND `readAt: null`, set `readAt = new Date()`.
6. **Read state is a timestamp, not a boolean**: `readAt = null` ⇒ unread; non-null ⇒ read (and is the time it was read).

#### 4c. Inbox page logic (`app/notifications/page.tsx`)
1. Guard: `if (!user) redirect("/role-switch")`.
2. `items = await listNotifications(user.id, 50)`.
3. `unread = items.filter(n => !n.readAt).length` (counted from the fetched 50, not a separate count query).
4. Header shows `${unread} unread · in-app only`. "Mark all read" button (posts `markAllReadAction`) renders only when `unread > 0`.
5. Each row is a `<form>` posting `openNotification` with hidden `id` and hidden `href`. The `href` is computed by `recordHref(type, id)` (`notifications/page.tsx:12-21`):
   - case-insensitive on `type.toUpperCase()`:
     - `OFFER` → `/offers/${id}`
     - `DEAL` → `/deals/${id}`
     - `CASE` → `/cases/${id}`
     - `ACCOUNT` → `/accounts/${id}`
     - missing type/id or unknown → `/`
6. Row visual: unread rows show a filled primary dot + bold title + a "new" badge; read rows show a transparent dot + normal weight. Timestamp formatting: `n.createdAt.toISOString().slice(0,16).replace("T"," ")` → e.g. `2026-06-14 09:30`.

#### 4d. Inbox actions (`app/notifications/actions.ts`)
1. `openNotification(formData)` (`actions.ts:11-16`): read `id` and `href`; `if (id) await markRead(id)`; then `redirect(href)`. So **clicking a notification marks it read and navigates to the record in one action.**
2. `markAllReadAction()` (`actions.ts:18-22`): `user = await currentUser()`; if user, `markAllRead(user.id)`; `revalidatePath("/notifications")`.

#### 4e. Nav badge (`components/nav.tsx:32-34, 81-85`)
- `unread = user ? await unreadCount(user.id) : 0`.
- Renders a red (`bg-destructive`) pill on the bell with the raw `unread` number only when `unread > 0`. No "9+" cap — shows the literal count.

#### 4f. Notification producers (must keep firing in the new stack)
`notify()` is called from these locations (the platform layer just stores/serves; these producers belong to other subsystems but MUST keep wiring into the same `notify()` contract):
- `app/cases/actions.ts:118, 154, 212, 249` (case create/assign/escalate/comment).
- `app/manager/actions.ts:47` (deal reassignment).
- `lib/approval.ts:85, 141, 191, 238, 286` (offer state-machine transitions).

#### 4g. Data shapes
- **Notification model** (`schema.prisma:376-389`): `{ id, recipientId, title, body, linkedRecordType?: String, linkedRecordId?: String, readAt?: DateTime, createdAt: DateTime }`. Relation `recipient -> User` with `onDelete: Cascade`. Indexes on `recipientId` and `readAt`.
- `NotifyInput` (`lib/notify.ts:7-13`): `{ recipientId, title, body, linkedRecordType?, linkedRecordId? }`.

#### 4h. Re-implementation notes
- `lib/notify.ts` is pure Prisma — port verbatim to your TanStack data layer (Prisma can stay).
- The inbox `<form action={serverFn}>` POST pattern maps to TanStack server functions. `openNotification` is a mutation that ends in `throw redirect({ to: href })`. `markAllReadAction` is a mutation followed by router/loader invalidation (replace `revalidatePath("/notifications")`).
- `recordHref` is pure — copy verbatim, including the lowercase route prefixes and the `/` fallback.
- Keep "no email" as a hard constraint; do not add any email/webhook side effect to `notify()`.

---

### 5. Global search

**Files:** `lib/search.ts`, `app/search/page.tsx`. Search box also in `components/nav.tsx`.

#### 5a. What it does
Universal free-text search (BUILD-SPEC P1 #11) across accounts, deals, cases, contacts. **No role gate** — every signed-in user searches everything. Case-insensitive substring; each group capped at 10 for a fast, demo-dense page.

#### 5b. Exact rules (`lib/search.ts:6-42`)
1. `q = rawQuery.trim()`. If empty → return `{ query: "", accounts: [], deals: [], cases: [], contacts: [] }` (no DB hit).
2. Match predicate: `like = { contains: q, mode: "insensitive" }` (Postgres ILIKE).
3. Four queries run in parallel (`Promise.all`):
   - **accounts**: where `OR` on `name`, `region`, `segment`, `industry`; `include ownerRep`; `orderBy name asc`; `take 10`.
   - **deals**: where `OR` on `name`, `notes`; `include account`; `orderBy lastActivityAt desc`; `take 10`.
   - **cases**: where `OR` on `title`, `description`; `include account`; `orderBy createdAt desc`; `take 10`.
   - **contacts**: where `OR` on `name`, `email`, `title`; `include account`; `orderBy name asc`; `take 10`.
4. Returns `{ query, accounts, deals, cases, contacts }`. Type exported as `SearchResults`.

#### 5c. Search page logic (`app/search/page.tsx`)
1. **No auth guard** (universal).
2. Reads `q` from `searchParams` (default `""`), calls `globalSearch(q)`.
3. `total = accounts.length + deals.length + cases.length + contacts.length`.
4. Empty-state branches: no `query` → prompt to type; `query` but `total === 0` → "No matches for "{query}". Try a shorter or different term."; else → "{total} result(s) for "{query}"." with correct singular/plural.
5. Each group renders only if non-empty, as a table:
   - Accounts: Name (→ `/accounts/${a.id}`), Region, Segment, Owner (`a.ownerRep.name`).
   - Deals: Deal (→ `/deals/${d.id}`), Account, Stage (`STAGE_LABEL[d.stage]` from `lib/forecast`), Status (badge).
   - Cases: Title (→ `/cases/${c.id}`), Account, Status badge (variant: CLOSED→secondary, ESCALATED→destructive, else warning; label = `status.replaceAll("_"," ")`), Priority.
   - Contacts: Name (→ `/accounts/${c.accountId}` — note: links to the **account**, not a contact page), Title (or "—"), Account, Email (or "—").
6. The search form `GET`s to `/search` with field `name="q"` (both the nav box `nav.tsx:65-74` and the page form `search/page.tsx:25-43`). `autoFocus` + `defaultValue={query}` on the page input.

#### 5d. Re-implementation notes
- `globalSearch` is pure Prisma — port verbatim. Postgres `mode: "insensitive"` ⇒ keep using ILIKE-equivalent; if your data layer changes, preserve case-insensitive substring on the **exact same fields**.
- The search box is a plain HTML `GET` form to `/search?q=...`; replicate as a TanStack route with a `q` search param validated in the route's `validateSearch`, and a loader that calls `globalSearch`. Keep `name="q"`.
- Keep the per-group `take: 10` caps and the per-group orderings (they affect what shows in the demo).
- Preserve the contact-row linking to `/accounts/${accountId}` (there is no standalone contact route).

---

### 6. Activity timeline

**Files:** `lib/activity.ts`; rendered on `app/accounts/[id]/page.tsx:180-202`.

#### 6a. What it does
An append-only audit log. Every meaningful mutation across the app appends one `ActivityEvent`, optionally tied to an account and an actor. The account detail page renders a reverse-chronological timeline panel.

#### 6b. Exact rules
1. `createActivityEvent(input)` (`lib/activity.ts:16-29`): creates one row. `accountId`, `actorId`, `linkedRecordType`, `linkedRecordId` default to `null` if omitted. `type` and `summary` are required strings.
2. `accountTimeline(accountId, take=30)` (`lib/activity.ts:32-39`): `findMany` where `accountId`, `orderBy createdAt desc`, `take` (default 30), `include actor`.
3. The account page does **not** call `accountTimeline`; it eager-loads inline: `activityEvents: { include: { actor: true }, orderBy: { createdAt: "desc" }, take: 15 }` (`accounts/[id]/page.tsx:60`). So the account view caps at **15** events; `accountTimeline`'s default 30 is for other callers.
4. Render (`accounts/[id]/page.tsx:184-200`): empty → "No activity yet."; else a bulleted list, each showing `e.summary`, then `actor?.name ? name + " · " : ""` followed by the timestamp `createdAt.toISOString().slice(0,16).replace("T"," ")`.

#### 6c. Producers (must keep firing)
`createActivityEvent` is called from many subsystems — port them all to call the same helper:
- `app/cases/actions.ts:52, 81, 107, 144, 203, 241`
- `app/catalog/actions.ts:61, 91, 114, 137, 166, 197, 220, 243`
- `app/deals/actions.ts:109, 133, 174`
- `app/rep/intake-actions.ts:100`
- `app/manager/actions.ts:38`
- `app/accounts/[id]/actions.ts:23`
- `lib/approval.ts:51, 73, 129, 182, 229, 277`

#### 6d. Data shapes
- **ActivityEvent model** (`schema.prisma:299-314`): `{ id, accountId?: String, actorId?: String, type: String, summary: String, linkedRecordType?: String, linkedRecordId?: String, createdAt: DateTime }`. Relations: `account -> Account` (`onDelete: Cascade`), `actor -> User`. Indexes on `accountId` and `createdAt`.
- `CreateActivityInput` (`lib/activity.ts:7-14`): `{ accountId?, actorId?, type, summary, linkedRecordType?, linkedRecordId? }`.
- `type` is a **free-form string convention**, not an enum: examples in source `"DEAL_CREATED"`, `"OFFER_SUBMITTED"`, `"CASE_CLOSED"` (`lib/activity.ts:11`).

#### 6e. Re-implementation notes
- Pure Prisma — port verbatim. Keep `type` as a string (no enum migration).
- `actorId` should be wired to `currentUser().id` at each call site (the producers already pass it). Keep the nullable account/actor so system-level events without an account still log.
- Timeline display caps differ by caller (account page = 15, helper default = 30) — preserve both.

---

### 7. Navigation

**File:** `components/nav.tsx`; mounted in `app/layout.tsx:15` (root layout renders `<Nav/>` above all pages, plus `<AiAssistant/>` below).

#### 7a. What it does
A sticky top bar showing brand, role-aware nav links, a search box, the notification bell with unread badge, and the current user/role chip (which links to role-switch).

#### 7b. Exact rules
1. Server component: `user = await currentUser()`; `unread = user ? await unreadCount(user.id) : 0`.
2. `initials` = first letters of up to 2 name words, uppercased (`nav.tsx:35-37`); empty string if no user.
3. **Role-aware links** (`ROLE_LINKS`, `nav.tsx:18-27`) — each shown only if `user.role` is in its `roles` array (`nav.tsx:54-59`):
   | label | href | roles |
   |---|---|---|
   | My desk | `/rep` | REP |
   | Manager | `/manager` | SALES_MANAGER |
   | Finance | `/finance` | FINANCE |
   | Approvals | `/approvals` | SALES_MANAGER, FINANCE |
   | Catalog | `/catalog` | FINANCE |
   | My cases | `/tam` | TAM |
   | Reports | `/reports` | SALES_MANAGER, FINANCE |
   | Smart views | `/views` | REP, SALES_MANAGER, FINANCE |
4. Always-present links: "Overview" (`/`) and "Switch role" (`/role-switch`), regardless of role (`nav.tsx:53, 60`).
5. `ROLE_LABEL` for the user chip (`nav.tsx:10-15`): REP→"Sales Rep", TAM→"TAM", SALES_MANAGER→"Sales Manager", FINANCE→"Finance".
6. Search box: `GET` form to `/search`, field `name="q"` (`nav.tsx:65-74`).
7. Bell links to `/notifications`; badge (red pill, raw `unread` count) shown only when `unread > 0` (`nav.tsx:75-86`).
8. User chip links to `/role-switch`; if no user, shows "Sign in" link to `/role-switch` (`nav.tsx:87-102`).
9. **Important:** nav link filtering is **cosmetic only** — e.g. "Smart views" is hidden from TAM in the nav, but `/views` has no role guard, so a TAM hitting the URL still sees it. Real enforcement lives in the page loaders (section 3). Reproduce both layers but don't conflate them.

#### 7c. Re-implementation notes
- `<Nav/>` is an async server component rendered in the root layout. In TanStack Start, render it from the root route (`__root.tsx`) and fetch `user` + `unreadCount` in the root route's loader (or a server function), passing them to the component. It re-runs per navigation, so the unread badge stays live.
- Links are role-filtered from `user.role` — port the `ROLE_LINKS` table verbatim.
- The bell badge depends on `unreadCount(user.id)` — ensure the root loader is invalidated after any `notify()`/`markRead`/`markAllRead` so the count is fresh (same concern as the role-switch `revalidatePath`).

---

### 8. Smart views (preset query chips)

**Files:** `lib/views.ts`, `app/views/page.tsx`.

#### 8a. What it does + why
BUILD-SPEC P1a: 3 one-click "smart views" = predefined filters. A lightweight, demo-visible substitute for conversational/NLP querying — **not** open-ended NLP (`lib/views.ts:1-2`). Each chip runs a fixed query and renders a table.

#### 8b. Exact rules — the 3 views
`SMART_VIEWS` (`lib/views.ts:6-10`), each `{ key, label, hint }`:

**1. `at-risk-dach` — "At-risk DACH enterprise deals"** (`atRiskDachEnterprise`, `lib/views.ts:16-26`):
- `prisma.deal.findMany` where: `status: "OPEN"` AND `account.region contains "DACH" (insensitive)` AND `account.segment === "Enterprise"` AND `OR[ lastActivityAt < (now − 14 days), expectedCloseDate < now ]`.
- The 14-day threshold: `since14d = new Date(Date.now() - 14*86400000)` (`lib/views.ts:14`).
- `include account, ownerRep`; `orderBy lastActivityAt asc` (stalest first).
- Table cols: Deal (→`/deals/${id}`), Account (`name · region`), Stage (`STAGE_LABEL`), Owner, Last activity (warning badge `{daysSince(lastActivityAt)}d ago`).

**2. `offers-finance` — "Offers pending Finance"** (`offersPendingFinance`, `lib/views.ts:28-34`):
- `prisma.offer.findMany` where `status: "PENDING_FINANCE"`; `include account`; `orderBy updatedAt asc` (oldest waiting first).
- Table cols: Account, Discount (`{discountPercent}%`), Total (`formatEUR(total)`), Submitted (`{daysSince(updatedAt)}d ago`), and a "Review" link → `/approvals/${o.id}`.

**3. `cases-blocking` — "Cases blocking customer tests"** (`casesBlockingCustomerTests`, `lib/views.ts:36-47`):
- Step 1: find deals where `stage: "CUSTOMER_TEST"` AND `status: "OPEN"`, select `accountId`.
- Step 2: `accountIds = [...new Set(...)]` (dedupe).
- Step 3: `prisma.case.findMany` where `accountId in accountIds` AND `status NOT "CLOSED"`; `include account, service`; `orderBy [priority desc, createdAt asc]`.
- Table cols: Case (→`/cases/${id}`), Account, Service (`service?.name ?? "—"`), Status badge (ESCALATED→destructive else warning; label `status.replaceAll("_"," ")`), Priority.

Hints (`lib/views.ts:7-9`) — displayed under the chip when active:
- at-risk-dach: "Open enterprise deals in DACH that are stalled >14 days or past their close date."
- offers-finance: "Discounted offers that passed Sales Manager and await Finance sign-off."
- cases-blocking: "Open cases on accounts that have a deal in the Customer test stage."

#### 8c. Page logic (`app/views/page.tsx`)
1. **No auth guard on the page** (but nav only shows the link to REP/SM/FINANCE).
2. Reads `view` from `searchParams`. `isViewKey(view)` (`views/page.tsx:19-21`) validates it is one of the 3 keys; otherwise `active = null`.
3. Renders all 3 chips as pill links to `/views?view=<key>`; the active one is highlighted (primary fill).
4. If no active view → "Pick a view above to run it." If active → render the matching component (`AtRiskDach` / `OffersFinance` / `CasesBlocking`), each calling its `lib/views.ts` function and showing `<Empty/>` ("No records match this view right now.") when zero rows.

#### 8d. Data shapes touched
- `Deal` (status, stage, lastActivityAt, expectedCloseDate, accountId, ownerRep, account.region, account.segment).
- `Offer` (status, discountPercent, total, updatedAt, account).
- `Case` (status, priority, createdAt, accountId, service).
- Enums: `DealStatus.OPEN`, `DealStage.CUSTOMER_TEST`, `OfferStatus.PENDING_FINANCE`, `CaseStatus` (`"CLOSED"`), `Priority` ordering for `orderBy priority desc`.

#### 8e. Re-implementation notes
- All 3 view functions are pure Prisma — port verbatim, including the `since14d` 14-day constant (`14*86400000` ms), the dedupe `Set` in `casesBlockingCustomerTests`, the two-step query (cannot be a single join because it filters cases by accounts-with-open-CUSTOMER_TEST-deals), and the exact orderings.
- `mode: "insensitive"` on `account.region contains "DACH"` must stay case-insensitive.
- The page is a TanStack route with a `view` search param; `isViewKey` validation belongs in `validateSearch`. The chip links are plain navigation (`/views?view=<key>`).
- `Priority` `orderBy desc` relies on the enum declaration order `LOW < MEDIUM < HIGH < CRITICAL` (`schema.prisma:69-74`), so `desc` yields CRITICAL→LOW. Preserve enum order if the DB-side ordering is to match.

---

### 9. Cross-cutting porting checklist (Next → TanStack Start)

1. **Cookie session** (`hmd_demo_user`, httpOnly/lax/7d) — swap `next/headers` cookies for TanStack/vinxi cookie helpers; keep name + attributes; keep the REP-by-email-asc fallback so the app never dead-ends.
2. **`redirect()`** in guards/actions → `throw redirect({ to })`.
3. **Server actions** (`"use server"` form actions: `switchTo`, `openNotification`, `markAllReadAction`) → TanStack **server functions**; mutations end in redirect or router invalidation.
4. **`revalidatePath("/", "layout")`** (role switch) and **`revalidatePath("/notifications")`** have no 1:1 equivalent — replace with router/query invalidation so post-mutation views (nav badge, dashboards, approval queues, inbox) are never stale for the previous role.
5. **Per-route guards are not centralized** — reproduce each variant exactly (manager/finance bounce Rep+TAM to *their own* dashboard; catalog hard-redirect non-Finance to /role-switch; approvals soft content gate; rep/tam/reports/notifications login-only; tam ungated).
6. **Nav link visibility ≠ access control** — reproduce both the cosmetic `ROLE_LINKS` filter and the loader guards.
7. **No outbound email** anywhere — `notify()` is in-app only; keep it that way.
8. All of `lib/notify.ts`, `lib/activity.ts`, `lib/search.ts`, `lib/views.ts`, and the pure helpers in `lib/session.ts` (`dashboardPathForRole`) are framework-agnostic Prisma/logic — they can be copied with near-zero changes; only the cookie + redirect + cache-invalidation glue changes.

**Files referenced (all absolute):**
- `/Users/huataipan/Wichai/Hackathons/sales-hackathons-prompt/lib/session.ts`
- `/Users/huataipan/Wichai/Hackathons/sales-hackathons-prompt/lib/notify.ts`
- `/Users/huataipan/Wichai/Hackathons/sales-hackathons-prompt/lib/search.ts`
- `/Users/huataipan/Wichai/Hackathons/sales-hackathons-prompt/lib/activity.ts`
- `/Users/huataipan/Wichai/Hackathons/sales-hackathons-prompt/lib/views.ts`
- `/Users/huataipan/Wichai/Hackathons/sales-hackathons-prompt/components/nav.tsx`
- `/Users/huataipan/Wichai/Hackathons/sales-hackathons-prompt/app/layout.tsx`
- `/Users/huataipan/Wichai/Hackathons/sales-hackathons-prompt/app/role-switch/page.tsx`
- `/Users/huataipan/Wichai/Hackathons/sales-hackathons-prompt/app/notifications/page.tsx`
- `/Users/huataipan/Wichai/Hackathons/sales-hackathons-prompt/app/notifications/actions.ts`
- `/Users/huataipan/Wichai/Hackathons/sales-hackathons-prompt/app/search/page.tsx`
- `/Users/huataipan/Wichai/Hackathons/sales-hackathons-prompt/app/views/page.tsx`
- `/Users/huataipan/Wichai/Hackathons/sales-hackathons-prompt/app/accounts/[id]/page.tsx` (timeline consumer, lines 60, 180-202)
- Guards: `/app/manager/page.tsx:45-47`, `/app/finance/page.tsx:37-39`, `/app/catalog/page.tsx:60-63`, `/app/approvals/page.tsx:31-54`, `/app/approvals/[offerId]/page.tsx:61-80`, `/app/reports/page.tsx:33`, `/app/rep/page.tsx:18`, `/app/tam/page.tsx` (ungated)
- `/Users/huataipan/Wichai/Hackathons/sales-hackathons-prompt/prisma/schema.prisma` (User 114-130, Role 16-21, ActivityEvent 299-314, Notification 376-389, enums 16-100)
- `/Users/huataipan/Wichai/Hackathons/sales-hackathons-prompt/prisma/seed.ts:102-117` (demo users)

---

I now have complete coverage of the Account 360 subsystem. Here is the migration spec.

## Account 360 + Customer/Contact Model

### Purpose & role in the product

The Account 360 page (`app/accounts/[id]/page.tsx`) is the single most important screen in the CRM ("the most important page — Owner / SA-O1", per the file header comment). It is the hub of demo step 2 ("open the account → see deals + cases together"). It aggregates **everything** related to one customer onto one screen: customer basics, contacts with decision-role badges, open deals AND active cases shown together, offers, an activity timeline, free-form notes (with inline add), an AI Next Best Action (NBA) panel slot, and three create-entity launch buttons (New deal / New offer / New case).

It is a Next.js **async Server Component** (RSC). All data is fetched server-side with Prisma at render time; there is exactly **one mutating server action on this page**: `addAccountNote` (`app/accounts/[id]/actions.ts`). The NBA panel is a separate async server component streamed via React `<Suspense>`.

---

### A. Page composition (what renders, top to bottom)

Route: `/accounts/:id`. Param is a `Promise<{ id: string }>` (Next 15) and is `await`ed (`page.tsx:48-49`).

Layout: outer `<main class="mx-auto max-w-6xl px-4 py-8">`; below the header, a `grid gap-6 lg:grid-cols-3` with a **main column** (`lg:col-span-2`) and a **sidebar** (`space-y-6`).

**Header block (`page.tsx:76-103`):**
1. "← Back to dashboard" link → hardcoded `/rep` (NOTE: always `/rep`, not role-aware).
2. `<h1>` = `account.name`.
3. Subtitle line = `account.industry · account.segment · account.region` (joined by " · ").
4. Customer-basics line — rendered **only if** `account.domain || account.address || account.vatId` is truthy. Builds an array `[domain, address, vatId ? "VAT "+vatId : null]`, filters falsy, joins with " · " (`page.tsx:86-92`). So VAT is prefixed with the literal `VAT ` and the others are raw.
5. Right side: `Owner: {account.ownerRep.name}` always; `TAM: {account.assignedTam.name}` only if `assignedTam` is non-null (`page.tsx:95-96`).
6. Three action buttons (`page.tsx:97-101`), each a `<Link>` wrapping a `<Button>`:
   - `New deal` → `/deals/new?accountId={account.id}` (`size="sm"`, default variant)
   - `New offer` → `/offers/new?accountId={account.id}` (`size="sm" variant="secondary"`)
   - `New case` → `/cases/new?accountId={account.id}` (`size="sm" variant="outline"`)

**Main column (order matters for the demo):**
1. **Open deals** card (`page.tsx:109-131`) — title `Open deals ({openDeals.length})`. Empty state: "No open deals." Otherwise a table, columns: Deal, Channel, Stage, Close, Stale (right-aligned).
2. **Active cases** card (`page.tsx:133-154`) — title `Active cases ({activeCases.length})`. Empty: "No active cases." Table columns: Case, Priority, Status, Service. (These two cards are deliberately adjacent — the inline comment says "deals + cases TOGETHER (demo step)".)
3. **Offers** card (`page.tsx:157-178`) — title `Offers ({account.offers.length})`. Empty: "No offers yet." Table columns: Offer, Status, Discount (right), Total (right).
4. **Activity timeline** card (`page.tsx:181-202`) — title `Activity timeline`. Empty: "No activity yet." Otherwise `<ul>` of events, each a bullet dot + `e.summary` + a metadata line.
5. **Notes** card (`page.tsx:205-230`) — title `Notes`. Inline add-note `<form>` at top, then `<ul>` of notes newest-first.

**Sidebar:**
1. **NBA panel** (`page.tsx:237-239`) — `<Suspense fallback={<NbaSkeleton/>}><NbaPanel accountId={account.id}/></Suspense>`. Streams in so the page paints instantly while the LLM resolves.
2. **Contacts** card (`page.tsx:242-265`) — title `Contacts ({account.contacts.length})`. Empty: "No contacts." Otherwise `<ul>` of contacts.

---

### B. EXACT business rules (numbered)

**B1 — Data fetch (single `findUnique` + one `findMany`, `page.tsx:51-69`):**
1. `prisma.account.findUnique({ where: { id } })` with `include`:
   - `ownerRep: true`
   - `assignedTam: true`
   - `contacts: { orderBy: [{ isPrimary: "desc" }, { name: "asc" }] }` — **primary contact first, then alphabetical by name.**
   - `deals: { orderBy: { lastActivityAt: "desc" } }` — **most recently touched deal first.** (Fetches ALL deals; open-filtering happens in JS.)
   - `cases: { include: { service: true, assignedTam: true }, orderBy: { createdAt: "desc" } }` — **newest case first.** (Fetches ALL cases.)
   - `offers: { include: { deal: true }, orderBy: { updatedAt: "desc" } }` — **most recently updated offer first.**
   - `activityEvents: { include: { actor: true }, orderBy: { createdAt: "desc" }, take: 15 }` — **newest 15 events only.**
2. If `account` is null → `notFound()` (Next 404). Re-implement as a 404 response / not-found route.
3. Notes are fetched **separately** because they are not a relation on `Account` (the `Note` model is a generic polymorphic table keyed by `parentType`+`parentId`, not a FK): `prisma.note.findMany({ where: { parentType: "ACCOUNT", parentId: id }, include: { author: true }, orderBy: { createdAt: "desc" } })` — **newest note first, ALL notes (no take limit).**

**B2 — Derived/filtered lists (`page.tsx:71-72`):**
4. `openDeals = account.deals.filter(d => d.status === "OPEN")` — only `DealStatus.OPEN`; `WON`/`LOST` are hidden. Order is inherited (lastActivityAt desc).
5. `activeCases = account.cases.filter(c => c.status !== "CLOSED")` — shows `OPEN`, `IN_PROGRESS`, `ESCALATED`; hides `CLOSED`. Order inherited (createdAt desc).
6. Offers and the timeline are NOT filtered — all are shown (timeline already capped at 15 by the query).

**B3 — Open-deals row rendering (`page.tsx:118-126`):**
7. Deal name links to `/deals/{d.id}`.
8. Channel cell = `channelBadge(d.channel)`: `RESELLER` → `<Badge variant="outline">Reseller</Badge>`; anything else (i.e. `DIRECT`) → `<Badge variant="secondary">Direct</Badge>` (`page.tsx:36-38`).
9. Stage cell = `STAGE_LABEL[d.stage]` (human label, see B8).
10. Close cell = `d.expectedCloseDate ? d.expectedCloseDate.toISOString().slice(0,10) : "—"` (ISO date `YYYY-MM-DD`, em-dash if null).
11. **Stale rule:** `daysSince(d.lastActivityAt)`. If `>= 14` → render `<Badge variant="destructive">{n}d</Badge>`; else plain text `{n}d` (`page.tsx:124`). `daysSince` = `Math.round((Date.now() - date)/86_400_000)` (`lib/utils.ts:32-34`). The `14`-day threshold is the staleness cutoff.

**B4 — Active-cases row rendering (`page.tsx:142-148`):**
12. Case title links to `/cases/{c.id}`.
13. Priority badge variant from `PRIORITY_VARIANT` (`page.tsx:18-23`): `LOW→outline`, `MEDIUM→secondary`, `HIGH→destructive`, `CRITICAL→destructive`. Badge text = raw priority value (`LOW`/`MEDIUM`/`HIGH`/`CRITICAL`).
14. Status cell = `c.status.replace("_", " ")` → `IN_PROGRESS` displays as `IN PROGRESS` (single replace, only first underscore).
15. Service cell = `c.service?.name ?? "—"`.

**B5 — Offers row rendering (`page.tsx:166-173`):**
16. Offer label = `{o.deal?.name ?? "Offer"} v{o.version}` linking to `/offers/{o.id}` (e.g. "NordSec fleet rollout v1"; falls back to "Offer v1" if no deal).
17. Status badge variant: `APPROVED → default`; `REJECTED → destructive`; **everything else → secondary** (`page.tsx:169`). Badge text = `OFFER_LABEL[o.status] ?? o.status` (`page.tsx:25-34`): `DRAFT→"Draft"`, `SUBMITTED→"Submitted"`, `PENDING_SM→"Pending SM"`, `SM_APPROVED→"SM approved"`, `PENDING_FINANCE→"Pending Finance"`, `FINANCE_APPROVED→"Finance approved"`, `APPROVED→"Approved"`, `REJECTED→"Rejected"`.
18. Discount cell = `o.discountPercent > 0 ? "{n}%" : "—"` (right-aligned).
19. Total cell = `formatEUR(o.total)` (right-aligned). `formatEUR` uses `Intl.NumberFormat("en-IE", { style:"currency", currency:"EUR", maximumFractionDigits:0 })` (`lib/utils.ts:9-23`) — **no decimals**, e.g. `€1,234`.

**B6 — Activity timeline rendering (`page.tsx:188-198`):**
20. Each event: a `<li>` with a 2×2px bullet, then `e.summary`, then a meta line.
21. Meta line = `{e.actor?.name ? e.actor.name + " · " : ""}{e.createdAt.toISOString().slice(0,16).replace("T"," ")}` → e.g. `Sofia Lindqvist · 2026-06-12 14:30`. If actor is null, no name prefix.

**B7 — Notes rendering (`page.tsx:218-227`):**
22. Empty state `<li>`: "No notes yet."
23. Each note `<li>`: body text, then meta line `{n.author.name} · {n.createdAt.toISOString().slice(0,16).replace("T"," ")}`.
24. Add-note form posts to `addAccountNote` action; hidden input `accountId = account.id`; text input `name="body"` is `required` with placeholder "Add a note…"; submit button "Add".

**B8 — Stage labels (`lib/forecast.ts:19-27`), used in deal rows:**
25. `INTEREST_SHOWN→"Interest shown"`, `RFI_ANSWERED→"RFI answered"`, `RFP_OFFER_GIVEN→"RFP / offer given"`, `CUSTOMER_TEST→"Customer test"`, `CONTRACT_NEGOTIATION→"Contract negotiation"`, `WON→"Won"`, `LOST→"Lost"`.

**B9 — Contacts rendering + decision-role badge (`page.tsx:249-261`):**
26. Per contact `<li>`: name, then a `Primary` badge (`variant="secondary"`) **only if** `c.isPrimary`.
27. **Decision-role badge:** rendered **only if** `c.decisionRole && c.decisionRole !== "OTHER"` (i.e. null and `OTHER` are both suppressed). Variant `outline`, text = `CONTACT_ROLE_LABEL[c.decisionRole]` (`page.tsx:40-46`): `FINANCIAL→"Financial decision maker"`, `BUDGET→"Budget owner"`, `TECH→"Tech decision maker"`, `INFLUENCER→"Influencer"`, `OTHER→"Contact"` (the `OTHER` label exists in the map but is never shown because of the guard).
28. Below the name: `c.title`, `c.email`, `c.phone` — each rendered only if present (`xs muted` lines).

---

### C. Data shapes (models/fields touched)

**`Account` (`schema.prisma:140-166`)** — the hub record:
- Identity/basics: `id` (cuid), `name`, `domain String?`, `address String?`, `vatId String?` (the three "customer basics" HMD asked for — comment `schema.prisma:143`), `region`, `segment`, `industry` (all required strings), `status String @default("ACTIVE")`, `createdAt`, `updatedAt`.
- Ownership FKs: `ownerRepId String` → `ownerRep User` (relation `"AccountOwnerRep"`, required); `assignedTamId String?` → `assignedTam User?` (relation `"AccountAssignedTam"`, optional).
- Relations aggregated on the page: `contacts Contact[]`, `deals Deal[]`, `cases Case[]`, `offers Offer[]`, `activityEvents ActivityEvent[]`. **Notes are NOT a relation** — they live in the polymorphic `Note` table.
- Indexes: `@@index([ownerRepId])`, `@@index([assignedTamId])`.

**`Contact` (`schema.prisma:168-182`):**
- `id`, `accountId String`, `name String`, `title String?`, `decisionRole ContactRole?` (nullable), `email String?`, `phone String?`, `isPrimary Boolean @default(false)`.
- `account Account @relation(onDelete: Cascade)` — contacts are deleted with the account.
- `casesAsContact Case[] @relation("CaseCustomerContact")` (a contact can be the customer contact on cases — used by seed to set `Case.customerContactId`).
- `@@index([accountId])`.

**`ContactRole` enum (`schema.prisma:132-138`):** `FINANCIAL | BUDGET | TECH | INFLUENCER | OTHER`.

**`Deal`** — page reads `id, name, channel, stage, status, expectedCloseDate, lastActivityAt`. `status` is `DealStatus { OPEN | WON | LOST }`; `channel` is `Channel { DIRECT | RESELLER }`; `stage` is `DealStage`.

**`Case`** — page reads `id, title, status, priority, service.name`. `status` is `CaseStatus { OPEN | IN_PROGRESS | ESCALATED | CLOSED }`; `priority` is `Priority { LOW | MEDIUM | HIGH | CRITICAL }`. (Page does not use `dueDate`, `assignedTam`, etc., though they are `include`d.)

**`Offer`** — page reads `id, version, status, discountPercent, total, deal.name`. `status` is `OfferStatus` (8-state machine).

**`ActivityEvent` (`schema.prisma:299-314`):** `id, accountId?, actorId?, type String, summary String, linkedRecordType?, linkedRecordId?, createdAt`. Page reads `summary, actor.name, createdAt`. `actor` relation may be null.

**`Note` (`schema.prisma:284-297`)** — polymorphic: `id, parentType NoteParentType, parentId String, authorId String, body String, internal Boolean @default(false), createdAt`. `NoteParentType { ACCOUNT | DEAL | CASE | OFFER }`. Indexed `@@index([parentType, parentId])`. For this page `parentType="ACCOUNT"`, `parentId=account.id`. The `internal` flag exists but is not used on the account page.

---

### D. Server action / function step-by-step logic

**`addAccountNote(formData: FormData)` (`app/accounts/[id]/actions.ts:12-33`)** — the only mutation on this page. It is a Next `"use server"` action invoked directly via `<form action={addAccountNote}>`.

Steps:
1. Read `accountId = String(formData.get("accountId") ?? "")` and `body = String(formData.get("body") ?? "").trim()`.
2. **Guard:** if `!accountId || !body` → `return` silently (no error). (Empty/whitespace-only notes are dropped.)
3. `user = await currentUser()`; **guard:** if `!user` → `return` silently.
4. **Write note:** `prisma.note.create({ data: { parentType: "ACCOUNT", parentId: accountId, authorId: user.id, body } })`. (`internal` defaults to false.)
5. **Write activity event:** `createActivityEvent({ accountId, actorId: user.id, type: "note_added", summary: "{user.name} added a note", linkedRecordType: "ACCOUNT", linkedRecordId: accountId })`. This appends one `ActivityEvent` row (`lib/activity.ts:16-29`) so the new note shows up in the timeline immediately.
6. `revalidatePath("/accounts/{accountId}")` — invalidates the RSC cache so the page re-fetches and shows the new note + timeline entry. **No redirect, no notification.**

Critical invariant (file-header comment `actions.ts:3-5`): **all writes go through Prisma + `createActivityEvent`**, and these are the SAME write paths the AI-assisted "Apply" step (SA-O4) reuses — "AI never writes to the DB directly." Preserve this: any future AI feature must call the same write function, not write rows itself.

**`currentUser()` (`lib/session.ts:15-29`)** — resolves the active user:
1. Read cookie `hmd_demo_user` (`SESSION_COOKIE`).
2. If present and the user exists → return it.
3. **Fallback:** `prisma.user.findFirst({ where: { role: "REP" }, orderBy: { email: "asc" } })` — first Sales Rep by email (seeded Sofia), so the app never dead-ends in demo mode. (Returns null only if no REP exists.)

**`NbaPanel({ accountId })` (`components/nba-panel.tsx:30-79`)** — async server component, streamed via Suspense:
1. `Promise.all` five queries: the account; open deals (`status: "OPEN"`); active cases (`status: { not: "CLOSED" }`); ALL offers for the account; the single latest account note (`findFirst`, `parentType:"ACCOUNT"`, ordered `createdAt desc`).
2. Build `NbaContext` (`nba-panel.tsx:39-51`): `accountName`; `deals[]` mapped to `{ name, stage, channel, daysSinceActivity: daysSince(d.lastActivityAt), pastExpectedClose: !!d.expectedCloseDate && d.expectedCloseDate.getTime() < Date.now() }`; `cases[]` mapped to `{ title, priority, status }`; `offers[]` mapped to `{ status, pendingApproval: status==="PENDING_SM" || status==="PENDING_FINANCE" }`; `latestNote: latestNote?.body ?? null`.
3. `const { nba, source } = await nextBestAction(ctx)` (`lib/ai/nba.ts:37-46`): calls `aiJSON` (Featherless, OpenAI-compatible) validated against `NbaSchema` = `{ recommendation: string, reasons: string[] (1..3), draftEmail: string | null }`; **on missing key/model failure returns `fallbackNba(ctx)`** with `source:"fallback"`.
4. Render: title "Next best action"; badge text = `source==="ai" ? "AI" : "AI · rules"`; `nba.recommendation`; bulleted `nba.reasons`; optional collapsible `<details>` "Draft email" showing `nba.draftEmail` if non-null.
5. Fallback rule precedence (`nba.ts:49-90`, for re-implementation parity): (a) highest-priority non-closed case (`HIGH`/`CRITICAL`) → resolve it first; (b) an offer pending approval → chase the approval; (c) a deal in `CUSTOMER_TEST` → schedule a decision meeting (includes a draft email); (d) a stale (`daysSinceActivity >= 14`) or past-close deal → follow up (includes a draft email); (e) default → "Log your latest conversation…".

---

### E. Seed-derived data (decision-role + customer basics)

The page's badges and basics line are only meaningful because the seed populates them. Reproduce this exactly in the new data layer's seed.

**Customer-basics derivation (`prisma/seed.ts:189-214`):**
1. `domain` = `a.contacts[0]?.email.split("@")[1] ?? null` — domain is taken from the **first contact's email** (e.g. `anke.vogel@nordsec.example` → `nordsec.example`).
2. `address` = `` `${a.name.split(" ")[0]} House, ${a.region}` `` — e.g. "NordSec House, DACH".
3. `vatId` = `` `${VAT_PREFIX[a.region] ?? "EU"}${(20000000 + accIdx * 137)}` `` where `accIdx` is 1-based account index and `VAT_PREFIX = { DACH:"DE", Nordics:"SE", Baltics:"LV", Finland:"FI", "Central Europe":"CH" }` (default `"EU"`). E.g. account 1 in DACH → `DE20000137`.

**`decisionRole` derivation — `roleFromTitle(title)` (`seed.ts:191-198`)** — case-insensitive regex on the contact's job title, **first match wins, in this exact order**:
1. `/cfo|finance|financial/` → `FINANCIAL`
2. `/procurement|purchas|budget/` → `BUDGET`
3. `/ciso|security|it|cto|tech|endpoint/` → `TECH`
4. `/head|director|manager|officer|lead/` → `INFLUENCER`
5. else → `OTHER`

Ordering caveat to preserve: the `TECH` regex contains the bare substring `it`, so any title containing the letters "it" (e.g. "Securi**t**y Lead" matches `security` first anyway; "**IT** Procurement" matches `procurement` at rule 2 before reaching rule 3) — the precedence ordering is load-bearing. Worked examples from seed: "Head of IT" → `TECH` (matches `it`); "Security Lead" → `TECH`; "CISO" → `TECH`; "IT Procurement" → `BUDGET` (rule 2 `procurement` wins over rule 3); "Operations Director" → `INFLUENCER`; "Procurement Officer" → `BUDGET`; "Head of Field Ops" → `INFLUENCER`; "Plant Manager" → `INFLUENCER`; "Head of Endpoint Security" → `TECH`.

**Primary contact + isPrimary (`seed.ts:216-221`):** each contact created with `isPrimary: !!c.primary` and `decisionRole: roleFromTitle(c.title)`. The first contact per account has `primary: true`. The primary contact id is stored in `primaryContactByAccount` and later used as `Case.customerContactId` (`seed.ts:335`). The page's contact ordering (`isPrimary desc, name asc`) means the primary contact always renders first.

**Seed accounts (8 total, `seed.ts:170-187`):** NordSec Logistics (DACH/Enterprise/Logistics, 2 contacts), Aurora Health Systems (Nordics/Enterprise/Healthcare), Baltic Field Services (Baltics/Mid-market/Field Services), RheinWerk Manufacturing (DACH/Enterprise/Manufacturing, 2 contacts), FinGov Mobility (Finland/Public Sector/Government), Alpine Utilities (Central Europe/Enterprise/Energy), Nordic Retail Group (Nordics/Mid-market/Retail), Helvetia Secure Bank (Central Europe/Enterprise/Finance). Owners: Sofia (`sofia.id`) or Raj (`raj.id`); TAMs: Timo (`timo.id`) or Lena (`lena.id`). An empty DB is penalized by the brief — this seed must be reproduced.

---

### F. Re-implementation notes (Next RSC + Prisma → TanStack Start)

1. **Page → route loader.** Convert the async RSC into a TanStack Start route (`/accounts/$id`) using a `createServerFn`/route `loader` that returns the aggregate payload. Keep the exact query shape from B1 (one `findUnique`-equivalent with the five includes + a separate notes query). If you keep Prisma, the queries port 1:1; if you move to Drizzle/SQL, replicate the orderings precisely (contacts `isPrimary desc, name asc`; deals `lastActivityAt desc`; cases `createdAt desc`; offers `updatedAt desc`; activity `createdAt desc take 15`; notes `createdAt desc`). The `notFound()` becomes `throw notFound()` (TanStack Start has a `notFound()` helper) or a 404 redirect.

2. **Derived lists stay in the loader/component**, not the DB: re-apply `deals.filter(status==="OPEN")` and `cases.filter(status!=="CLOSED")` after fetch (B2) — do NOT push these into the query unless you also keep counts consistent (the page intentionally fetches all deals/cases for the NBA-free counts here; only `openDeals`/`activeCases` are derived). Preserve the JS-side filtering to keep behavior identical.

3. **`addAccountNote` → a server function.** Replace the Next `"use server"` form action with a TanStack `createServerFn({ method: "POST" })` validated input `{ accountId: string, body: string }`. Keep the two guards (empty accountId/body → no-op; no user → no-op) and the two-write sequence (note create → `createActivityEvent`). Replace `revalidatePath("/accounts/{id}")` with TanStack's `router.invalidate()` / loader revalidation on the same route (or return the new data and let the client invalidate). The form currently posts a `FormData`; with server functions prefer a typed object input, but you can still accept `FormData` and `.get()` the fields to minimize UI churn.

4. **Preserve the write-path invariant.** `createActivityEvent` (`lib/activity.ts`) is shared by every mutation across the app and AI "Apply." Port it as a plain async data-layer function (no Next dependency) and route ALL account-affecting writes through it so the timeline stays complete. Do not let any AI path write rows directly.

5. **Session.** `currentUser()` reads a cookie (`hmd_demo_user`) with a REP fallback. In TanStack Start, read cookies via the server-function request context (e.g. `getCookie`/`getWebRequest`) and keep the same fallback (first REP by email). `revalidatePath`, `cookies()` from `next/headers`, and `notFound()` from `next/navigation` are the only Next-specific imports in this subsystem — all three have direct TanStack Start equivalents.

6. **NBA panel streaming.** The `<Suspense>` + async-server-component streaming maps to TanStack Start's deferred data / `Await` pattern: return a *promise* for the NBA result from the loader and render `<Await>` with `NbaSkeleton` as the fallback so the page still paints instantly while Featherless resolves (a few seconds). Keep the fallback-on-failure behavior (`source: "ai" | "fallback"`) and the badge text mapping ("AI" vs "AI · rules").

7. **Pure helpers port unchanged.** `formatEUR`, `daysSince`, `daysFromNow` (`lib/utils.ts`), `STAGE_LABEL`/`STAGE_PROBABILITY` (`lib/forecast.ts`), and all the page-local maps (`PRIORITY_VARIANT`, `OFFER_LABEL`, `CONTACT_ROLE_LABEL`, `channelBadge`) are framework-agnostic — move them verbatim. The `14`-day stale threshold, the `>0` discount guard, the `decisionRole !== "OTHER" && !== null` badge guard, and the `slice(0,10)`/`slice(0,16).replace("T"," ")` date formats are all load-bearing display rules; reproduce exactly.

8. **Note polymorphism.** Because notes are not a FK relation but a `(parentType, parentId)` table, keep them as a separate query/insert. If the new data layer supports it, an index on `(parentType, parentId)` is required for the account notes query to stay fast (mirrors `@@index([parentType, parentId])`).

**Relevant files:**
- `/Users/huataipan/Wichai/Hackathons/sales-hackathons-prompt/app/accounts/[id]/page.tsx`
- `/Users/huataipan/Wichai/Hackathons/sales-hackathons-prompt/app/accounts/[id]/actions.ts`
- `/Users/huataipan/Wichai/Hackathons/sales-hackathons-prompt/components/nba-panel.tsx`
- `/Users/huataipan/Wichai/Hackathons/sales-hackathons-prompt/lib/activity.ts`
- `/Users/huataipan/Wichai/Hackathons/sales-hackathons-prompt/lib/session.ts`
- `/Users/huataipan/Wichai/Hackathons/sales-hackathons-prompt/lib/utils.ts`
- `/Users/huataipan/Wichai/Hackathons/sales-hackathons-prompt/lib/forecast.ts`
- `/Users/huataipan/Wichai/Hackathons/sales-hackathons-prompt/lib/ai/nba.ts`
- `/Users/huataipan/Wichai/Hackathons/sales-hackathons-prompt/prisma/schema.prisma` (Account 140-166, Contact 168-182, ContactRole 132-138, Note 284-297, ActivityEvent 299-314)
- `/Users/huataipan/Wichai/Hackathons/sales-hackathons-prompt/prisma/seed.ts` (accounts/contacts 165-223)

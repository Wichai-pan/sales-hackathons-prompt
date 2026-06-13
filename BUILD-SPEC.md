# HMD Secure AI-native CRM — Canonical Build Spec

> Authored by teammate V. This is the AUTHORITATIVE detailed build spec for the coding agent.
> `memory/pitch-spec.md` holds the 3-minute narrative + demo path + scope contract; THIS file holds
> the data model, business rules, phase order, and acceptance checklist. They must stay consistent.
> Deadline: 2026-06-14 15:00 Europe/Helsinki (= 2026-06-14T12:00:00Z). Freeze 09:00Z.

---

You are a senior full-stack coding agent. Build a working web app for the Prompt Sales Hackathon HMD challenge: **HMD Secure AI-native CRM**.

Your task is not to brainstorm. Your task is to implement a focused, demo-ready CRM that follows the official HMD brief. Do not drift into unrelated features. The winning path is a reliable end-to-end business workflow, not a flashy AI toy.

Important sources and interpretation:

- Challenge page: https://prompthack.aaltoes.com/sales-2026/challenges/hmd
- Full brief PDF: https://prompthack.aaltoes.com/briefs/hmd-sales-hackathon-brief.pdf
- Deadline shown by the challenge page: Sunday 15:00. Given current event timing, treat this as 2026-06-14 15:00 Europe/Helsinki.
- Deliverable: working web app plus short demo.
- Core interpretation: Build HMD Secure's first shared source of truth for accounts, contacts, deals, cases, service history, offers, approvals, and 3-year weighted forecast. AI should act as an analyst layer on top of structured CRM data.

Non-negotiable warning:

Do not build this as "a CRM chatbot". Do not make AI the database. The CRM core must work even if AI is unavailable. AI is a visible accelerator, not the foundation.

## Locked Technical Stack

Use this stack unless the human explicitly overrides it:

- Next.js App Router
- TypeScript
- Tailwind CSS
- shadcn/ui or simple shadcn-style components
- lucide-react for icons
- PostgreSQL
- Prisma ORM
- Auth.js / NextAuth Microsoft Entra provider if Entra environment variables are available
- Demo role switch fallback using seeded users and a server-side session cookie
- In-app notifications stored in PostgreSQL and refreshed through normal server actions/API calls
- Azure OpenAI through a server-only route or action, with deterministic fallback when credentials are missing
- Docker Compose for local/demo deployment with Next.js app + PostgreSQL

Why this stack:

- It matches the HMD brief better than Supabase or SQLite because the official platform direction is Microsoft Azure + Entra ID + EU data residency.
- PostgreSQL + Prisma gives a transparent schema for the many CRM entities, forecast rows, approvals, activity events, and seeded demo data.
- Prisma seed scripts are easy for coding agents to maintain and debug.
- The same app can run on the team's EU Frankfurt server for a hackathon demo and can later move to Azure App Service / Azure Container Apps + Azure Database for PostgreSQL in North Europe or West Europe.
- Real-time infrastructure is not required. In-app notifications can be reliable database records with unread/read state. Polling or page refresh is enough for demo.
- Supabase Auth/Realtimes/RLS would add a second platform and can conflict with the Entra/Azure story. Do not use Supabase unless the human explicitly instructs you to switch.
- SQLite is fast for prototypes but too weak for this challenge because the product needs multi-role workflows, durable seed data, realistic forecast tables, and an Azure/Postgres deployment story.

Deployment rule:

- Preferred official target: Azure EU region using Azure App Service or Azure Container Apps plus Azure Database for PostgreSQL.
- Practical hackathon fallback: deploy the Docker Compose app to the team's EU Frankfurt server if Azure access is slow or unavailable.
- If using the Frankfurt server, keep all data on that EU server and document that the architecture is Azure-portable.
- Do not use a non-EU hosted database or a US-hosted auth/data service.

Required environment variables:

- DATABASE_URL
- NEXTAUTH_SECRET or AUTH_SECRET
- NEXTAUTH_URL or APP_URL
- AZURE_AD_CLIENT_ID, optional for real Entra auth
- AZURE_AD_CLIENT_SECRET, optional for real Entra auth
- AZURE_AD_TENANT_ID, optional for real Entra auth
- AZURE_OPENAI_ENDPOINT, optional for AI
- AZURE_OPENAI_API_KEY, optional for AI
- AZURE_OPENAI_DEPLOYMENT, optional for AI
- DEMO_MODE=true when using role switch fallback

## Product Goal

HMD Secure is a one-year-old startup selling smart devices plus internal and third-party services. The sales team and Technical Account Managers currently run sales and customer service through email, Excel, and personal notes.

The product must solve these pains:

- No shared customer/account system.
- No pipeline visibility.
- No service history per customer.
- Cases handled through email without status or audit trail.
- Finance has no reliable forecast.
- Managers depend on verbal updates.
- New reps cannot learn from historical customer context.

The product must create:

- One place for every account, contact, deal, case, offer, note, and activity.
- Rep dashboard for accounts, deals, offers, approvals, and next actions.
- TAM dashboard for assigned cases and service history.
- Sales Manager dashboard for team pipeline, overdue/stalled deals, and approval work.
- Finance dashboard for pricing catalog, finance approvals, and 3-year time-phased forecast.

## Success Criterion

The official "what good looks like" scenario is the main demo path. Build so a new user with no training can complete this flow without getting stuck:

1. Sales Rep logs in.
2. Sales Rep finds an account.
3. Account page shows open deals and active cases together.
4. Sales Rep creates a deal.
5. Sales Rep marks it as direct.
6. Sales Rep picks the correct stage.
7. Sales Rep enters a 12-month forecast.
8. Sales Rep opens the catalog.
9. Sales Rep picks devices and services.
10. Sales Rep generates an offer.
11. Sales Rep applies a discount and enters a required justification.
12. Sales Manager receives an in-app notification and approves the discounted offer.
13. Finance receives an in-app notification and approves the same offer after Sales Manager approval.
14. TAM logs in.
15. TAM sees an assigned case.
16. TAM reads the account/case history.
17. TAM adds a note.
18. TAM closes the case.
19. Sales Manager logs in.
20. Sales Manager immediately sees overdue or stalled deals and a 3-year weighted pipeline.
21. Finance logs in.
22. Finance sees a time-phased forecast by quarter for 3 years.
23. Sales Rep opens an account and sees an AI-suggested next best action.

This flow must work end to end with realistic seed data.

## Scope Priority

### P0: Must Have

All P0 features must work. Missing P0 means the submission is not successful.

Implement these:

- Account and contact management:
  - Accounts hold contacts, deals, cases, offers, and activity timeline.
  - Account page is the center of the product.

- Case management:
  - Case has status, priority, linked service, assigned TAM, customer-side contact, threaded notes, and timestamps.
  - TAM can add notes and close a case.

- Deal pipeline and stages:
  - Deal has HMD stage, direct/reseller flag, owner, expected close date, stage probability, device forecast, service forecast, and activity notes.
  - Direct and reseller must behave differently.

- Offer creation and storage:
  - Offer is built from product and service catalogs.
  - Offer is stored on the account.
  - Offer is versioned or at least keeps immutable generated offer snapshots.

- Offer approval workflow:
  - If a discount is applied, justification is required.
  - Discounted offer goes to Sales Manager first.
  - After Sales Manager approval, it goes to Finance.
  - Offer is locked while approval is pending.
  - Both approvals are visible in status history.
  - Both approvals trigger in-app notifications.

- Product and pricing catalog:
  - Finance can add, update, and retire catalog items without developer involvement.
  - Catalog items include SKU/name/category/unit price/currency/status.

- Service catalog:
  - Services have internal vs third-party tag.
  - Cases link to services.
  - Services include invoicing model.

- Role-based access and default view:
  - Roles: Sales Rep, TAM, Sales Manager, Finance.
  - Each role lands on the relevant dashboard.
  - Full production-grade authorization is not required for demo, but the UI and data model must respect roles.

- Personal dashboard:
  - Each role has a different home page focused on that role's work.

- Case and deal notes:
  - Notes are timestamped.
  - Notes show author and role.
  - Notes are visible to users with access.

### P1: Should Have

Build P1 after P0 and demo path are working.

- Search and filters across accounts, cases, and deals.
- Pipeline filters by stage, channel, owner, date.
- Sales forecast view: weighted pipeline by stage and time, 3-year horizon.
- Case activity log: every meaningful change timestamped and attributed.
- In-app notifications: unread/read state, click to jump to record.
- Deal risk indicator: flags deals not updated for 14+ days or past expected close date.
- AI next best action using Azure OpenAI if available.
- Basic reporting:
  - Cases by status/service.
  - Deals by stage/owner.
  - Close rate if feasible from seed data.

### P2: Nice To Have

Only build P2 if P0 and P1 are genuinely done and demo is stable.

- SLA and due date tracking.
- CSV/Excel export for Finance.
- Email-to-case via Microsoft Graph.
- Outlook calendar integration via Microsoft Graph.
- AI case summary for cases with 5+ notes.
- AI forecast narrative.

Exception: You may implement AI forecast narrative earlier if it is low effort and helps the Finance/Manager demo. But do not sacrifice P0.

## Out Of Scope

Do not spend time on:

- Customer-facing portal.
- Mobile app.
- Live API integration with third-party service providers.
- Automated bulk import from Excel.
- Multi-language/localisation.
- Advanced BI dashboard builder.
- Complex permission system beyond role-based demo needs.
- Real outbound email notifications.

In-app notifications only.

## Business Rules

### Pipeline Stages

Use these stages:

1. Interest shown
2. RFI answered
3. RFP / offer given
4. Customer test
5. Contract negotiation
6. Won
7. Lost

Channel rule:

- Direct deals can use all stages.
- Reseller deals must not use Contract negotiation.
- For reseller deals, Customer test should go directly to Won or Lost.

Suggested stage probabilities for weighted pipeline:

- Interest shown: 10%
- RFI answered: 25%
- RFP / offer given: 45%
- Customer test: 70%
- Contract negotiation: 90%
- Won: 100%
- Lost: 0%

These exact probabilities are not specified by the brief, so mark them as configurable assumptions in the code or seed data.

### Deal Forecast

Do not reduce forecast to one amount field.

HMD's business requires time-phased forecast:

- Customers buy device fleets over time, not all at once.
- Total opportunity is approximately a 3-year sum.
- The system must show near-term and long-term forecast from the same deal.
- Sales Rep demo step requires entering a 12-month forecast.
- Finance demo step requires seeing a 3-year forecast by quarter.

Implementation recommendation:

- Store forecast rows per deal and period.
- Period granularity can be month or quarter. Quarter is acceptable for dashboard if 12-month input can map to quarters.
- Each forecast row should separate:
  - device_units
  - device_revenue
  - service_revenue
  - total_revenue
  - weighted_revenue

Minimum:

- When creating a deal, let Rep enter 12 monthly values or 4 quarterly values.
- For seed data, include full 3-year forecast rows so Finance dashboard looks real.
- If time is tight, generate year 2 and year 3 from year 1 assumptions, but display that clearly as projected expansion.

### Service Revenue Models

Services must not be flattened into generic one-time revenue.

Support three invoicing models:

1. One-off at delivery:
   - Revenue recognized at one point in time.

2. Fixed-term package, 1 to 5 years:
   - Contract value known upfront.
   - Revenue spread across the term.

3. Monthly recurring on active devices:
   - Revenue depends on rate and device-count trajectory.
   - Store expected monthly rate and active device trajectory or derive it from device forecast.

Show service revenue separately from device revenue in Finance or forecast detail.

### Offer Approval

Offer status should move through:

- Draft
- Submitted
- Pending Sales Manager Approval
- Sales Manager Approved
- Pending Finance Approval
- Finance Approved
- Approved
- Rejected

Rules:

- Discount > 0 requires justification.
- Discounted offers require Sales Manager approval first.
- Finance approval cannot happen before Sales Manager approval.
- Offer is locked while pending approval.
- If rejected, store rejection reason and unlock for revision.
- Each approval creates an activity event and in-app notification.

### Notifications

Use in-app notifications only.

Examples:

- Sales Manager notified when a discounted offer is submitted.
- Finance notified after Sales Manager approval.
- Rep notified when offer is approved or rejected.
- TAM notified when a case is assigned or nearing due date if SLA exists.

Notifications need:

- recipient user
- title
- body
- linked record type and ID
- read/unread state
- timestamp

## Data Model

Implement the data model with the locked stack above: Next.js App Router, TypeScript, PostgreSQL, and Prisma.

Do not switch to Supabase, Firebase, SQLite, or a local JSON/file database unless the human explicitly overrides this prompt. The CRM data model is central to the challenge, and it must remain easy to inspect, seed, migrate, and deploy to Azure-compatible PostgreSQL.

Core entities:

- User: id, name, email, role: REP | TAM | SALES_MANAGER | FINANCE
- Account: id, name, region, segment, industry, ownerRepId, assignedTamId, status, createdAt, updatedAt
- Contact: id, accountId, name, title, email, phone, isPrimary
- Deal: id, accountId, ownerRepId, name, channel: DIRECT | RESELLER, stage, probability, expectedCloseDate, lastActivityAt, status: OPEN | WON | LOST, notes
- DealForecastPeriod: id, dealId, periodStart, periodEnd, periodLabel (e.g. 2026-Q3), deviceUnits, deviceRevenue, serviceRevenue, totalRevenue, weightedRevenue
- Product: id, sku, name, category, unitPrice, currency, status: ACTIVE | RETIRED
- Service: id, name, providerType: INTERNAL | THIRD_PARTY, invoicingModel: ONE_OFF | FIXED_TERM | MONTHLY_RECURRING, basePrice, currency, status
- Case: id, accountId, serviceId, assignedTamId, title, description, status: OPEN | IN_PROGRESS | ESCALATED | CLOSED, priority: LOW | MEDIUM | HIGH | CRITICAL, customerContactId, createdAt, updatedAt, closedAt
- Note: id, parentType: ACCOUNT | DEAL | CASE | OFFER, parentId, authorId, body, createdAt
- ActivityEvent: id, accountId, actorId, type, summary, linkedRecordType, linkedRecordId, createdAt
- Offer: id, accountId, dealId, version, status, subtotal, discountPercent, discountJustification, total, locked, createdById, createdAt, updatedAt
- OfferLineItem: id, offerId, itemType: PRODUCT | SERVICE, itemId, nameSnapshot, unitPriceSnapshot, quantity, lineTotal
- Approval: id, offerId, step: SALES_MANAGER | FINANCE, status: PENDING | APPROVED | REJECTED, approverId, comment, decidedAt
- Notification: id, recipientId, title, body, linkedRecordType, linkedRecordId, readAt, createdAt

## Required Pages And UX

Keep the UI simple, dense, and demo-friendly. Do not build a marketing page. The first screen after login/role switch should be the working dashboard.

### Login / Role Switch

For hackathon demo:

- If Entra ID SSO environment variables are available and quick to wire, use Auth.js / NextAuth with the Microsoft Entra provider.
- If Entra setup is not immediately available, implement a clean demo role switch page backed by seeded users and a server-side session cookie:
  - Sofia Rep
  - Timo TAM
  - Mira Sales Manager
  - Fiona Finance

Do not use Supabase Auth for this app. Make it clear in code comments or README that production auth is Entra ID SSO. Do not burn the project timeline on SSO if it blocks the CRM demo.

### Rep Dashboard
Must show: My accounts; My open deals by stage; Pending offer approvals; Recent account activity; At-risk or stale deals.
Primary actions: Open account; Create deal; Generate offer.

### Account Detail Page (most important page)
Must show: Account summary; Contacts; Open deals; Active cases; Offers; Activity timeline; Notes; AI next best action panel.
Must support: Create deal; Open deal; Create or view case; Generate offer from a deal; Add note.

### Deal Create/Edit
Must support: Account selection or prefilled account; Deal name; Channel direct/reseller; Stage dropdown constrained by channel; Expected close date; 12-month forecast input; Save.
When saved: Create activity event; Update account timeline; Deal appears in dashboards.

### Offer Builder
Must support: Select deal; Add products from catalog; Add services from catalog; Quantity; Discount percent; Required justification when discount > 0; Generate offer; Submit for approval.
When submitted with discount: Offer locked; Sales Manager notification created.

### Approval Queue
Sales Manager view: List pending SM approvals; Show offer details, discount, justification, account, deal; Approve or reject with comment.
Finance view: List offers that already have SM approval and need Finance approval; Approve or reject with comment.
After final approval: Offer status becomes Approved; Rep receives notification; Account timeline records the approval.

### TAM Dashboard
Must show: Assigned cases; Priority; Age; Linked account; Linked service.
Primary actions: Open case; Add note; Close case.

### Case Detail
Must show: Case status; Priority; Linked account; Linked service; Customer contact; Threaded notes; Activity history.
Must support: Add note; Change status; Close case.

### Sales Manager Dashboard
Must show immediately: Stalled deals not updated for 14+ days; Deals past expected close date; Pipeline by stage; Pipeline by owner; 3-year weighted pipeline; Approval queue.

### Finance Dashboard
Must show: 3-year time-phased forecast by quarter; Device revenue and service revenue separately; Weighted total forecast; Filters by period/stage/deal size/owner/channel if time allows; Finance approval queue; Catalog management entry points.

### Catalog Management
Finance can: Add/Edit/Retire product; Add/Edit/Retire service.
Retired items should not appear in new offers but should remain visible in historical offer snapshots.

## AI Requirements

Implement at least one visible AI feature.

### AI Next Best Action
Location: Account detail page.
Input context: Account summary; Recent activity events; Open deals and stages; Active cases; Latest notes; Offer approval status.
Output: One recommended next action; Reasoning in 2-3 bullet points; Optional draft email or call prep note.
Safety: AI output must not directly mutate CRM records. User can copy or save as note/task if implemented. If Azure OpenAI key is not configured, use deterministic fallback based on rules:
- If active high-priority case exists, recommend resolving case before pushing deal.
- If deal stale 14+ days, recommend follow-up.
- If offer pending approval, recommend checking approval status.
- If customer test stage, recommend scheduling decision meeting.

### Optional AI Forecast Narrative
Location: Finance or Manager dashboard.
Input: Aggregated forecast by quarter; At-risk deals; Pipeline by stage.
Output: Short pipeline health summary; Mention largest risk and next managerial action.
Use deterministic fallback if Azure OpenAI is not available.

## Seed Data Requirements

Seed data is mandatory. An empty database is a losing demo.

- 5 to 8 accounts.
- 15 to 25 deals; mix of direct and reseller; across all valid stages.
- At least 3 stalled deals older than 14 days.
- At least 2 deals past expected close date.
- Full 3-year forecast rows for several deals.
- At least 8 contacts.
- At least 10 cases across statuses and priorities.
- At least 5 services: internal + third-party examples; all three invoicing models represented.
- At least 8 products/devices.
- At least 4 offers: draft / pending SM approval / pending Finance approval / approved.
- Notifications for each role.

Suggested accounts: NordSec Logistics (DACH, Enterprise, direct); Aurora Health Systems (Nordics, Enterprise, direct); Baltic Field Services (Baltics, Mid-market, reseller); RheinWerk Manufacturing (DACH, Enterprise, reseller); FinGov Mobility (Finland, Public Sector, direct); Alpine Utilities (Central Europe, Enterprise, direct).
Suggested products: HMD Secure Pro Device; HMD Secure Rugged Device; HMD Secure Tablet; Device Enrollment Pack; Extended Warranty.
Suggested services: Secure Device Management (internal, monthly recurring); Deployment Workshop (internal, one-off); Compliance Audit Package (third-party, fixed-term); MDM Integration Support (internal, fixed-term); Third-party Incident Response (third-party, one-off).

## Implementation Order

Follow this order. Do not jump to AI first.

- **Phase 1 Data Foundation**: Init Next.js App Router + TS; Tailwind + shadcn; Prisma + PostgreSQL; Docker Compose (app + PostgreSQL); core entities; seed script; verify seeded data loads. Acceptance: `npm run dev` starts; `docker compose up` runs app+DB; seed works; app lists accounts/deals/cases/products/services/offers.
- **Phase 2 Role Dashboards & Nav**: role switch/auth wrapper; Rep/TAM/Manager/Finance dashboards; shared layout+nav. Acceptance: each role lands on distinct dashboard with real seeded data.
- **Phase 3 Account 360 & Core Records**: account list; account detail; contacts/deals/cases/offers/notes/timeline; basic note creation. Acceptance: Rep opens account, sees deals and active cases together.
- **Phase 4 Deal Creation & Forecast**: create deal flow; direct/reseller stage rules; 12-month forecast input; forecast aggregation helper. Acceptance: Rep creates direct deal with stage + 12-month forecast; Manager/Finance data changes.
- **Phase 5 Offer Builder & Approval**: catalog selection; offer snapshot; submit discounted offer w/ justification; lock pending; approval records + notifications; SM and Finance approval screens. Acceptance: discounted offer Rep→SM→Finance in correct order; Finance cannot approve before SM; Rep gets final notification.
- **Phase 6 TAM Case Flow**: case detail; add notes; close case; update timeline. Acceptance: TAM reads history, adds note, closes assigned case.
- **Phase 7 Manager & Finance Forecast Views**: stalled/overdue indicators; 3-year weighted pipeline; quarterly Finance forecast; separate device/service revenue. Acceptance: Manager sees stalled deals + 3-yr weighted pipeline immediately; Finance sees 3-yr quarterly forecast without asking sales.
- **Phase 8 AI Layer**: AI next best action on account page; deterministic fallback; optional forecast narrative. Acceptance: account page always shows useful next best action, even without AI credentials.
- **Phase 9 Polish & Demo Hardening**: fix broken states; loading/error/empty states; make demo path obvious; README (setup/seed/run/demo script/assumptions); run tests/lint/build.

## Acceptance Checklist

Before final delivery, manually verify this exact script:

- [ ] Start app successfully.
- [ ] Seed data exists and looks realistic.
- [ ] Login/role switch as Sales Rep.
- [ ] Rep dashboard shows accounts and deals.
- [ ] Open account.
- [ ] Account page shows contacts, open deals, active cases, offers, timeline.
- [ ] Create direct deal.
- [ ] Direct deal includes Contract negotiation as a possible stage.
- [ ] Reseller deal does not include Contract negotiation.
- [ ] Enter 12-month forecast.
- [ ] Save deal.
- [ ] Deal appears in account and manager pipeline.
- [ ] Open offer builder.
- [ ] Add products and services.
- [ ] Apply discount.
- [ ] Cannot submit discount without justification.
- [ ] Submit with justification.
- [ ] Offer becomes locked.
- [ ] Sales Manager gets notification.
- [ ] Sales Manager approves.
- [ ] Finance gets notification only after SM approval.
- [ ] Finance approves.
- [ ] Offer becomes approved.
- [ ] Rep gets final notification.
- [ ] Login as TAM.
- [ ] TAM sees assigned case.
- [ ] TAM opens case, reads history, adds note, closes case.
- [ ] Login as Sales Manager.
- [ ] Manager sees stalled/overdue deals.
- [ ] Manager sees 3-year weighted pipeline.
- [ ] Login as Finance.
- [ ] Finance sees quarterly 3-year forecast.
- [ ] Finance sees device vs service revenue.
- [ ] Account page displays AI next best action.
- [ ] AI fallback works if no API key is configured.
- [ ] Build passes.
- [ ] README includes demo script and assumptions.

## Technical Constraints

- Use Microsoft Azure as intended deployment target.
- Use Entra ID SSO if provided and feasible within hackathon time.
- Data must be deployable in Azure EU region, North Europe or West Europe.
- For the hackathon demo, if the team deploys to an EU Frankfurt server, keep the deployment Dockerized and Azure-portable.
- Use PostgreSQL, not SQLite.
- Do not introduce Supabase as the default backend/auth/realtime layer.
- Notifications are in-app only.
- Calendar integration, if built, must use Microsoft Graph only.
- Do not implement automated bulk migration from Excel.

If the real environment cannot provide Azure resources during development: keep code deployable to Azure; avoid vendor-specific features that block Azure deployment; document the demo deployment target and the intended Azure mapping; document assumptions clearly.

## Quality Bar

- Clear navigation; role-specific dashboards; avoid empty screens; realistic data; no fake buttons on the demo path; prefer fewer working features over many broken placeholders; main workflow visible without training.
- If a feature is not on the demo path and not needed for P0, defer it.

## README Requirements

Project name; what the app does; tech stack; install; seed; run locally; run with Docker Compose; deploy Dockerized app to EU Frankfurt server for demo; intended Azure mapping (Next.js → App Service/Container Apps; PostgreSQL → Azure Database for PostgreSQL NE/WE; Auth → Entra ID SSO); demo users and roles; demo script matching official scenario; AI config (env vars + fallback); Azure/Entra deployment notes; known limitations.

## Final Demo Positioning

"We built HMD Secure's first shared source of truth for accounts, service history, offers, approvals, and a 3-year weighted forecast, with AI acting as the analyst layer on top."

Before: email, Excel, no visibility, no service history, no forecast.
After: every role works from one system. Sales sees account context and creates deals/offers. TAM closes service cases with full history. Manager sees stalled deals and weighted pipeline. Finance sees time-phased forecast by quarter. AI reduces analysis burden with next best action and forecast summary.

## Critical Do Not Deviate Rules

- Do not build customer portal / mobile app / advanced BI builder / bulk Excel import / email notifications.
- Do not switch the default stack to Supabase unless the human explicitly says so.
- Do not use SQLite or file-based storage for the CRM database.
- Do not let reseller deals use Contract negotiation.
- Do not represent forecast only as a single deal amount.
- Do not merge device revenue and service revenue without detail.
- Do not skip approval order: Sales Manager must approve before Finance.
- Do not make discount optional without justification.
- Do not ship empty seed data.
- Do not spend time on AI before P0 demo path works.

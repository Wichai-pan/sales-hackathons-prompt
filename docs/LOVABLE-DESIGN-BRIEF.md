# Lovable Design Brief — HMD Secure CRM

> HOW TO USE THIS: Lovable is used here as a DESIGN tool, not to rebuild our app. Goal = generate a
> premium look we copy into our existing Next.js + Tailwind + shadcn app (backend untouched). Flow:
> (1) paste the PROMPT below into Lovable, (2) attach the reference assets, (3) iterate to a look you
> love, (4) port the styling into our app per `docs/UI-RESTYLE-GUIDE.md` (theme tokens + shared
> primitives first). Do NOT paste Lovable's data/backend code — we keep ours.

---

## 1) THE PROMPT (paste into Lovable, fill the two [brackets])

```
Design a premium, modern, data-dense internal SaaS dashboard for "HMD Secure CRM" — an AI-native CRM
used inside HMD Secure, a company that sells secure smartphones + device-management services to large
enterprises. It is an INTERNAL power tool (not a marketing site), used by four roles: Sales Rep,
Technical Account Manager (TAM), Sales Manager, and Finance. The product's soul is "it feels like
having an AI analyst on the team" — so the AI surfaces should feel native and intelligent, not bolted on.

TECH + OUTPUT: Generate with Next.js (App Router) + Tailwind CSS + shadcn/ui components + lucide-react
icons. Use Tailwind theme tokens / CSS variables for all colors so the palette is swappable. Keep
components composable (Card, Button, Badge, Table, Tabs, Dialog). Density: data-rich but breathable —
generous whitespace around tight tables. Subtle depth (soft shadows, rounded-xl/2xl cards), crisp type,
smooth. Support light + dark.

BRAND / MOOD: "HMD Secure" — enterprise, trustworthy, security/EU-sovereignty vibe. A confident accent
color (I'm leaning [ACCENT COLOR — e.g. HMD green #2FbF71 / deep indigo / electric blue]); a small
wordmark with a subtle shield/lock motif is welcome. Professional, Linear/Stripe/Vercel-dashboard-grade
polish — clean, fast, expensive-looking.

REFERENCE LOOK: take the best of [REFERENCE SITES — e.g. Linear (nav + density), Stripe dashboard
(data tables + charts), Vercel (cards + typography), Attio/Notion (calm CRM feel)]. Combine into one
coherent system.

DESIGN THESE SCREENS (data-accurate — use the sample data in the appendix, not lorem ipsum):
1. Login / role-switch — 4 seeded users as selectable cards (Sofia Rep, Timo TAM, Mira Sales Manager,
   Fiona Finance), each lands on their dashboard.
2. Top nav / app shell — wordmark, role-aware links, global search box, notification bell w/ unread
   badge, current-user chip, and a FLOATING AI ASSISTANT bubble bottom-right (chat panel that answers
   questions + queries live data + guides usage).
3. Sales Rep dashboard — the hero. A prominent "AI-assisted intake" panel (paste an email → AI draft
   preview → Apply), "my accounts" table, open deals by stage, at-risk deals callout, offers in
   approval, recent activity.
4. Account 360 — the most important page. Header w/ customer basics (name, domain, address, VAT,
   region/segment/industry, owner, TAM) + New deal / New offer / New case buttons. Open deals + active
   cases shown TOGETHER, offers, an activity timeline (feed), notes, contacts (with a decision-role
   badge: Financial / Budget / Tech / Influencer), and an "AI Next Best Action" card (recommendation +
   reasons + a draftable email).
5. Deal detail — channel (Direct/Reseller) + stage + probability + service billing model, a 3-YEAR
   QUARTERLY FORECAST as a CHART (stacked: device revenue + service revenue, with a stage-weighted
   line) AND a table, a stage-changer, notes.
6. Deal create + Offer builder — clean forms: channel→stage (reseller hides Contract-negotiation),
   12-month forecast input grid, catalog picker w/ live total, discount + justification.
7. Approvals queue — Sales Manager and Finance views; an offer with a status STEPPER
   (Draft→Pending SM→Pending Finance→Approved), discount + justification, approve/reject with comment.
8. TAM dashboard + Case detail — cases by priority + age with SLA "Overdue/Due-soon" badges; case
   detail w/ status/priority/linked service/customer contact, threaded notes (two tiers: internal vs
   working), activity, change-status/close/escalate/reassign, and an "AI case summary" card.
9. Sales Manager dashboard — team pipeline (a 7-STAGE FUNNEL viz + by-owner bars), stalled/past-close
   deals, a "Committed / At-risk / Gap-to-target" KPI strip, AI pipeline-health narrative, approval queue.
10. Finance dashboard — a 3-YEAR QUARTERLY FORECAST CHART (device vs service stacked + weighted line),
    KPI cards (device rev, service rev, net sales, gross margin, GM%, weighted), filters
    (period/stage/owner/channel), CSV export buttons, catalog management entry.
11. Catalog — products + services tables w/ price, gross-margin %, status (active/retired), add/edit
    inline, internal vs 3rd-party + invoicing-model tags on services.

COMPONENTS to define as a reusable system: top nav + app shell, KPI stat card, dense data table (with
status/priority/SLA badges), 7-stage pipeline funnel, 3-year forecast chart (stacked area + weighted
line), activity timeline/feed, approval status stepper, AI cards (intake preview, next-best-action,
case summary, forecast narrative) with a consistent "AI" visual treatment, the floating AI assistant
chat panel, and clean forms.

Deliver a cohesive, premium design system + these screens. Optimize for legibility on a projector
during a 3-minute live demo.
```

## 2) ASSETS to attach in Lovable (alongside the prompt)
- **Screenshots of OUR current app** (so it knows what to upgrade) — grab from http://43.165.2.182:3000:
  /rep, /accounts/[id], /finance, /manager, /tam, /offers/[id], an /approvals/[offerId].
- **Screenshots of the 2-4 reference sites** V picked, with a note on what to take from each.
- **The sample data appendix below** (paste it so mockups look real).
- The accent color + (optional) a logo idea.

## 3) WHAT TO FILL IN THE PROMPT
- `[ACCENT COLOR]` — pick one (HMD's brand green, or a deep indigo/blue for "secure enterprise").
- `[REFERENCE SITES]` — the sites V chose + one phrase each on what to borrow.

## 4) SAMPLE DATA APPENDIX (paste into Lovable so it's not lorem ipsum)
- Roles/users: Sofia Rep, Raj Rep (Sales Rep); Timo TAM, Lena TAM; Mira (Sales Manager); Fiona (Finance).
- Accounts: NordSec Logistics (DACH), Aurora Health Systems (Nordics), Baltic Field Services (Baltics),
  RheinWerk Manufacturing (DACH), FinGov Mobility (Finland), Alpine Utilities (Central Europe),
  Nordic Retail Group (Nordics), Helvetia Secure Bank (Central Europe).
- Pipeline stages: Interest shown · RFI answered · RFP/offer given · Customer test · Contract negotiation
  (Direct only) · Won · Lost. Channel: Direct / Reseller.
- Products: HMD Secure Pro Device €749, Rugged Device €899, Tablet €629, Lite Device €449,
  Device Enrollment Pack €39, Extended Warranty €89.
- Services: Secure Device Management (monthly recurring), 24/7 Premium Support (monthly recurring),
  Deployment Workshop (one-off), Compliance Audit Package (fixed-term), MDM Integration Support
  (fixed-term), Third-party Incident Response (one-off).
- Example deal: "NordSec fleet rollout 4k units" · Direct · Customer test · 70% · 3-yr forecast.
- Example case: "Devices failing MDM check-in" · Critical · Escalated · SLA overdue.
- Example offer: 1,600× HMD Secure Pro + Secure Device Management · 12% discount · Pending Finance.

## 5) PORTING (after Lovable) — see docs/UI-RESTYLE-GUIDE.md
Copy the LOOK (theme tokens → `globals.css`/`tailwind.config`, then `components/ui/*`, then nav/layout,
then per-page polish). Never paste Lovable's data/forms over our `<form action>` / `name=` wiring.
```

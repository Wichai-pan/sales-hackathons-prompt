# Pitch Spec — Sales Hackathon 2026 — HMD

> This file is the project spec. The feature list below is a CEILING, not a floor.
> Adding a feature requires removing one (record the swap in decisions.md).
> When behind schedule, cut from P2 upward. P0 = the demo critical path.
>
> NOTE: HMD is a PRESCRIBED-SCOPE challenge. Team decision: ATTEMPT THE FULL BRIEF —
> all 10 P0 + all 7 P1 + P2 opportunistically. The generic "≤7 features" cap is OVERRIDDEN
> (explicit human call). Discipline kept instead: build in the 9-phase order from BUILD-SPEC.md,
> demo path must run end-to-end on main before any P2, no broken placeholders, AI after P0.
> Detailed data model / business rules / phase acceptance live in /BUILD-SPEC.md (authored by V) —
> THE canonical build spec. This file = narrative + demo path + the 3 HERO differentiators.

## 3-Minute Narrative

- **Hook / problem** (0:00–0:30): HMD Secure sells smart devices to enterprises, but their 10–20 reps run everything on email + Excel. Deals die in inboxes, managers fly blind, finance has zero forecast. We built their first CRM — and made it feel like having an analyst on the team, not a data-entry chore.
- **Solution + magic moment** (0:30–1:30): ① AI-assisted intake — a rep just got off a call; instead of typing, they paste the email thread. AI drafts the CRM updates (contact, a deal at Customer Test, a blocking case, a follow-up task) as a PREVIEW; rep reviews and clicks Apply. 15 seconds. ② Next Best Action — open the account: the CRM doesn't just show data, it says what to do (deal stuck at Customer Test, an open case is blocking the close, your discount needs approval) and hands over a drafted email.
- **Live demo path** (1:30–2:30):
  1. Rep dashboard → paste email → AI draft preview → Apply selected
  2. Open account → timeline + AI Next Best Action
  3. Rep builds offer from catalog → applies discount + justification → submit
  4. Switch to SM → approve; switch to Finance → approve (in-app notifications light up)
  5. Switch to TAM → open assigned case → add note → close
  6. Switch to Manager → stalled/overdue deals + 3-yr weighted pipeline
  7. Switch to Finance → 3-yr quarterly forecast, device revenue vs service revenue split
- **Impact + ask** (2:30–3:00): From zero system to a full pipeline, a weighted 3-year forecast, and an AI analyst — in a weekend. New reps onboard from history on day one. This is HMD's CRM.

## Feature List (ceiling)

Owners = TBD (assigned at subtask breakdown / mvp-scaffolder). Build order = top to bottom; HERO + demo-line spine before stretch.

### 🌟 HERO — full polish, this is where we win (3)

| # | Feature | Priority | Demo-visible | Owner | Status |
|---|---|---|---|---|---|
| H1 | AI-assisted intake: email/notes → draft CRM updates preview → Apply selected (built in Phase 8 AI layer; NOT in V's BUILD-SPEC, added by team as the demo opener; pure text paste + LLM extract route + preview card, NO Microsoft Graph; distinct from P2 email-to-case) | P0 | [demo-visible] | TBD | todo |
| H2 | AI Next Best Action on account page (reads timeline → advice + draft email) | P0 | [demo-visible] | TBD | todo |
| H3 | 3-yr time-phased weighted forecast, device vs service revenue separated | P0 | [demo-visible] | PAIR (Owner+V) | todo |

### 🦴 CRM SPINE — brief P0 gate, minimal-works CRUD, no gold-plating (9)

| # | Feature | Priority | Demo-visible | Owner | Status |
|---|---|---|---|---|---|
| S1 | Account + contact + activity timeline | P0 | [demo-visible] | TBD | todo |
| S2 | Deal pipeline + stages (direct/reseller flag, 3-yr forecast input) | P0 | [demo-visible] | TBD | todo |
| S3 | Case management (status, priority, linked service, threaded notes) | P0 | [demo-visible] | TBD | todo |
| S4 | Offer creation from catalog + versioned storage on account | P0 | [demo-visible] | TBD | todo |
| S5 | Offer approval workflow (discount → SM → Finance, justification, locked) | P0 | [demo-visible] | TBD | todo |
| S6 | Product+pricing catalog + service catalog (internal/3rd-party tag) | P0 | [partial] | TBD | todo |
| S7 | Role-based access + 4 role dashboards (Rep/TAM/SM/Finance default views) | P0 | [demo-visible] | TBD | todo |
| S8 | Case & deal notes (timestamped, visible to all with access) | P0 | [demo-visible] | TBD | todo |
| S9 | In-app notifications (approval requests/results; mark read, jump to record) | P0 | [demo-visible] | TBD | todo |

### ✨ P1 polish — selected, demo-visible (2)

| # | Feature | Priority | Demo-visible | Owner | Status |
|---|---|---|---|---|---|
| P1a | 3 preset query chips (At-risk DACH enterprise / Offers pending Finance / Cases blocking customer tests) | P1 | [demo-visible] | TBD | todo |
| P1b | Deal risk indicator (stalled 14+ days, in Manager view) | P1 | [demo-visible] | TBD | todo |

### 🟡 Full-brief scope — team attempts ALL (build in BUILD-SPEC 9-phase order)

Remaining P1 (also targeted): Search & filter · Pipeline filters · Sales forecast view · Case activity log · Basic reporting.
P2 (opportunistic, only after P0+P1 + demo path stable on main): SLA/due tracking · CSV/Excel export · Email-to-case (Graph) · Outlook calendar (Graph) · AI case summary · AI forecast narrative (forecast narrative may come early if low-effort — helps Finance/Manager demo).
RULE: do NOT start any P2 until the 7-step demo path runs end-to-end on `main`. Prefer fewer working features over broken placeholders.

## Forbidden (do not build)

- Open-ended natural-language query (only the 3 preset chips above)
- Real Azure AD SSO during build — use a demo role-switcher; wire real SSO only if everything else is done
- Anything off the 7-step demo path until that path runs end-to-end
- Out of scope per brief: customer portal, mobile app, live 3rd-party API, bulk Excel import, i18n, advanced BI/custom report builder

## Hardcode Policy

Fake data is legal and encouraged. HMD brief REQUIRES realistic seed data — empty DB is penalized. Seed a believable HMD world: ~8–12 accounts across direct/reseller + DACH/Nordics, deals spread across all stages, a few open cases, a pricing + service catalog, offers in various approval states.

# Demo Script — HMD Secure AI-native CRM

> 3-minute demo. Target runtime **2:45** (15s buffer). Source narrative = `memory/pitch-spec.md` — do not invent new story.
> Open on the PRODUCT, not a slide. No live typing of commands; no terminal.

- **Live URL:** http://43.165.2.182:3000 (Frankfurt / EU). Demo from the live URL, never localhost.
- **Presenter / driver:** Owner.
- **Demo users (role-switch):** Sofia Rep · Mira Sales Manager · Fiona Finance · Timo TAM.
- **One-line positioning:** "HMD Secure's first shared source of truth — accounts, service, offers, approvals, a 3-year weighted forecast — with AI as the analyst layer on top."

## Pre-flight (before recording — see recording-checklist.md)
Fresh seed (redeploy if data is dirty, then DO NOT redeploy again — it re-seeds). Logged in as **Sofia Rep**, sitting on `/rep`. Browser zoomed for legibility, notifications off, single clean tab.

## Shot-by-shot

| # | Time | On screen | Actor / action | Spoken line |
|---|---|---|---|---|
| 1 | 0:00–0:20 | `/rep` Rep dashboard | hold on the dashboard | "HMD Secure sells smart devices to enterprises — but their reps run everything on email and Excel. Deals die in inboxes, finance has zero forecast. We built their first CRM." |
| 2 | 0:20–0:55 | AI-assisted intake panel → click **Use sample email** → **Generate draft** | Sofia pastes a raw customer email; AI draft preview appears (contact, deal at Customer test, a blocking case, a follow-up) | **(MAGIC MOMENT 1)** "A rep just got off a call. Instead of typing for ten minutes — she pastes the email. Our AI drafts the CRM records: a contact, a deal, a blocking case. She reviews and clicks Apply. Fifteen seconds." |
| 3 | 0:55–1:00 | Click **Apply selected updates** → lands on the new Account 360 | the records are now real on the account | "And there it is — a fully populated account." |
| 4 | 1:00–1:30 | Account 360 — **Next best action** panel | hold on the NBA card (advice + reasons + draft email) | **(MAGIC MOMENT 2)** "The CRM doesn't just store data — it tells her what to do next: the open case is blocking the close, here's the reason, and here's a drafted email. Like having an analyst on the team." |
| 5 | 1:30–1:50 | Click **New offer** → offer builder | add a device + a service, set **15% discount**, type a justification, **Submit for approval** | "She builds an offer from the catalog, applies a discount with a justification, and submits." |
| 6 | 1:50–2:10 | Role-switch → **Mira (Sales Manager)** → Approvals → Approve. Then **Fiona (Finance)** → Approvals → Approve | two approvals; in-app notifications light up | "Discounts route for approval — Sales Manager first, then Finance. Both notified in-app, both approve. Fully audited." |
| 7 | 2:10–2:25 | Role-switch → **Timo (TAM)** → open assigned case → add note → **Close** | TAM resolves the blocking case | "The TAM sees the case with full history, adds a note, and closes it — service and sales finally share one timeline." |
| 8 | 2:25–2:40 | Role-switch → **Mira (Manager)** dashboard, then **Fiona (Finance)** dashboard | show stalled deals + 3-yr weighted pipeline; then 3-yr quarterly forecast, device vs service split | "Managers see stalled deals and a 3-year weighted pipeline instantly. Finance sees a time-phased forecast by quarter — device and service revenue separated — without asking sales." |
| 9 | 2:40–2:45 | Account 360 or Finance view held | close | "From zero system to a full pipeline, a 3-year forecast, and an AI analyst — in a weekend. This is HMD's CRM." |

## Failure fallbacks (any single failure ≤10s on stage)

| Step | Risk | Fallback |
|---|---|---|
| 2 AI intake | Featherless slow/unreachable | The intake has a **deterministic rules fallback** — a draft still appears (no network needed). It will say "rules fallback" instead of "AI"; keep going. Also: **pre-record beat #2–4** as a clip. |
| 4 NBA | Featherless slow | Same deterministic fallback — the panel always renders advice. Pre-recorded clip as backup. |
| any | Live URL / Wi-Fi down | Play the **full pre-recorded demo video** (record it from the live URL beforehand — see checklist). |
| 6 approvals | wrong role / nothing in queue | Seed already contains offers in PENDING_SM / PENDING_FINANCE — fall back to approving a **seeded** pending offer if the freshly-built one isn't visible. |
| 2 intake | re-running duplicates the account | applyIntake creates a NEW account each run — **only apply once** per recording; if you must retry, re-seed first. |

## Rehearsal log (≥3 timed runs before recording; target 2:45)
- Run 1: ___ : ___  — fix: ___
- Run 2: ___ : ___  — fix: ___
- Run 3: ___ : ___  — fix: ___

## Submission note
Submission is by EMAIL (see event.yaml). Include: live URL, GitHub repo, and the demo video file/link.

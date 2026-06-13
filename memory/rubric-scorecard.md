# Rubric Scorecard — Sales Hackathon 2026 — HMD

> Self-assessment by V's agent (not the hackathon-rubric-judge skill). main build VERIFIED GREEN
> (tsc --noEmit clean + next build compiled all routes). Earlier "compile failure" was a stale local
> Prisma client — `prisma generate` fixes it; schema Case.dueDate is correct.

Last judged: 2026-06-13T17:45:00Z (self-assessment)

| Criterion | Weight | Est. | Gap / risk | Top fix |
|---|---|---|---|---|
| P0 features all functional | gate | PASS | 10/10 built + audited + routes present + build green. Residual: submit chain not human-clicked (content + script-function verified only). | Human walk-through of the live submit chain. |
| 8-step demo line walkable | high | STRONG, unverified by human | Biggest risk — nobody walked it as an untrained user ("getting stuck loses points"). AI beats depend on Featherless (deterministic fallback covers outages). | Human walk-through + record a safety full-run clip. |
| Realistic seed data | med | STRONG | None — 8 accounts / 18 deals (stalled + overdue) / 156 forecast rows / 12 cases / full catalog / 5 offers in all approval states. | — |
| AI-native feel | med | STRONG | 3 HERO (intake / NBA / forecast narrative) + AI case summary present. Gap was 3 preset query chips (P1a) — NOW ADDED at /views. | Tune AI prompt quality (Owner) if time. |

## Gap-ranked actions
1. **[HIGH] Human walk-through of the live demo path (submit chain)** — de-risks the two top-weighted criteria. V doing now (B).
2. **[MED] 3 preset query chips (P1a)** — DONE (A): /views + lib/views.ts (at-risk DACH enterprise / offers pending Finance / cases blocking customer tests) + nav "Smart views". build-green.
3. [LOW] Owner: record a safety full-run fallback clip; clean stale team-board rows (server-prep + pair-forecast marked todo but done).
4. [scheduled] Owner: demo video → deck → email submit (≤T-6h / by deadline 2026-06-14T12:00Z).

# Decisions — Sales Hackathon 2026 — HMD

> Append-only. One line per decision: `- [UTC time] decision — why (alternatives noted)`.
> Append-only files rebase cleanly; never rewrite past lines.

- [2026-06-13T08:41:13Z] Repo initialized by hackathon-kickoff.
- [2026-06-13T08:41:13Z] Stack = Next.js 15 + TS + Tailwind + shadcn/ui + Postgres/Prisma + Auth.js + Azure OpenAI — vibe-coding friendly, one language, self-hostable to Frankfurt (alternatives: Supabase BaaS, SQLite-lite — rejected for full backend control / chosen by team).
- [2026-06-13T08:41:13Z] Deploy target = Frankfurt server 43.165.2.182 via Docker Compose — team-owned EU-region server, satisfies HMD EU data-residency constraint (alternative: Vercel/Azure — rejected, self-host preferred).
- [2026-06-13T08:41:13Z] Track leaning = HMD over Immersive — team deep-dived HMD brief (pending formal lock by hackathon-track-selector).
- [2026-06-13T08:50:00Z] TRACK LOCKED = HMD (build AI-native CRM). Immersive rejected — no brief available, blind pick risk.
- [2026-06-13T08:50:00Z] Magic moment / demo storyline LOCKED:
    * A-lite intake (open, 10–15s): paste email/meeting notes -> AI generates DRAFT CRM updates (contact/deal/case/task) as a PREVIEW; user clicks "Apply selected updates" to write. Framed as "AI-assisted intake", NOT auto-entry (de-risks extraction accuracy).
    * B main magic moment (30s): open account page -> AI Next Best Action reads timeline -> concrete advice (deal stuck at Customer Test; active case blocking close; offer discount needs approval) + recommended next action + draft email.
    * P0 main line: Rep creates deal/offer, submits discount -> SM approve -> Finance approve -> TAM closes case.
    * D business close: Manager sees stalled/overdue + 3-yr weighted pipeline; Finance sees quarterly 3-yr forecast with device revenue vs service revenue SEPARATED.
    * C NOT main line: at most 3 preset query CHIPS (At-risk DACH enterprise deals / Offers pending Finance / Cases blocking customer tests). NO open-ended NL query.
  WHY: A-lite+B hit brief's thesis ("less data entry, more analyst on the team"), most visceral in 3 min, differentiates from the other 2 HMD teams (who will likely do open NL query, per brief example).
  Runner-up (pivot insurance): if A-lite extraction proves too flaky, drop to B-only as the magic moment (still strong, reuses P0 data). If time collapses, C chips are the cheapest AI demo fallback.
- [2026-06-13T09:00:00Z] SCOPE LOCKED by pitch-planner. 3 HERO (AI intake, NBA, 3-yr forecast) + 9 CRM-spine P0 + 2 P1 (query chips, deal risk) = 14 demo-relevant features. Generic 7-cap overridden: HMD prescribed-scope gates on 10 P0. Team intent = attempt ALL features; build order protects 7-step demo line first. Owners TBD until subtask breakdown. H3 forecast = pair (highest risk).

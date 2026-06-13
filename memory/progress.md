# Build Progress Log — append-only

> One line per meaningful slice landing or status change: `- [UTC time] who — slice — state — test result`.
> Append-only; never rewrite past lines. Run `./scripts/sync.sh` after appending.
> States: started | branch-green | merged-to-main | blocked. Detailed task states live in team-board.md.

- [2026-06-13T10:15:00Z] Plan — parallel build plan written (plan-owner.md, plan-v.md, parallel-plan.md). Streams: V=foundation+data+back-office+forecast-engine, Owner=sales-front+AI+server/deploy. Awaiting V WAVE 0 foundation.
- [2026-06-13T11:00:00Z] Owner — server prep DONE. Frankfurt has Docker 29.3.1+Compose v5.1.1+git; /opt/hmd-crm created; ports 3000/5432 free. WARNING: shared box with live "jianglai" project (don't touch; port 80/8000/3307 taken). RAM tight (~0.5Gi free +2.1Gi swap) → build-OOM risk. Constraints written to memory/deploy-notes.md for V's docker-compose (project name hmd-crm, app:3000, postgres internal, standalone build).
- [2026-06-13T11:35:00Z] Owner — Featherless smoke test PASSED (key from PromptFinance/.env). Qwen/Qwen2.5-7B-Instruct = 200, ~1.84s, clean JSON in content → KEPT as default chat model. GLM-4.6 = 200 but returns answer in `reasoning` field w/ empty content (reasoning model) → avoid for JSON; client now reads content||reasoning as a safety net. AI provider fully validated; only TODO = copy FEATHERLESS_API_KEY into our repo .env at deploy.

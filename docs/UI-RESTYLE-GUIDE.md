# UI Restyle Guide — make it look premium WITHOUT breaking functionality

> Goal: keep ALL existing features + backend (Prisma, server actions, Featherless AI, approval chain,
> forecast engine) 100% intact. Only the VISUAL layer changes. Lovable / fancy references are used as
> DESIGN INSPIRATION, never pasted in wholesale.

## The golden rule
Lovable output = a picture to copy, NOT code to paste. Re-create the look by changing `className`s and
the shared design tokens — never by replacing our wired-up components.

## DO NOT TOUCH (these are the functional contract)
- `<form action={someServerAction}>` — the action binding.
- `<input name="...">` / `<select name="...">` — the backend reads data by these `name`s. Renaming breaks writes.
- Data props passed from server components (e.g. `account.deals`, `forecast.quarters`) and `lib/*` imports.
- Server actions in `app/**/actions.ts`, and `lib/*` files — do not rename or move.
- Route folders / file names under `app/`.

## HIGHEST LEVERAGE, LOWEST RISK — restyle these and the whole app upgrades at once
1. **Theme tokens** — `app/globals.css` (CSS variables: background/foreground/primary/border/radius) +
   `tailwind.config.ts`. New palette, nicer radii, spacing, a real font. This propagates everywhere.
2. **Shared UI primitives** — `components/ui/card.tsx`, `button.tsx`, `badge.tsx`, `table.tsx`.
   Every page renders these, so restyling them upgrades all pages with near-zero logic risk.
3. **Nav + layout** — `components/nav.tsx`, `app/layout.tsx`. Branding, a sidebar/topbar, the role chip,
   the notification bell, spacing. Big visual payoff, isolated file.
4. **Per-page polish (optional, after 1-3)** — Rep dashboard, Account 360, Finance. Change wrappers,
   grid, card layout — but keep every `<form>`, `name=`, and data prop exactly as-is.

## Per-page edits — the safe pattern
Change the OUTSIDE (layout/spacing/className), keep the INSIDE (forms/inputs/data) identical. Example:
```tsx
// BEFORE
<form action={createDeal} className="space-y-6"> ... <input name="name" className="..."/> </form>
// AFTER (only className/wrapper changed — action + name untouched)
<form action={createDeal} className="space-y-8 rounded-2xl bg-card p-6 shadow-sm"> ... <input name="name" className="<new nicer classes>"/> </form>
```

## After restyling — MANDATORY before merge/deploy
1. `npx tsc --noEmit` clean.
2. Walk the 7-step demo path locally (role-switch → rep intake → account NBA → offer+discount → SM/Finance approve → TAM close → manager/finance views). Nothing should error.
3. `git pull --rebase` (Owner is adding the AI assistant + forecast chart in parallel — both use the
   restyled primitives, so they inherit your look automatically).
4. Redeploy to Frankfurt + confirm http://43.165.2.182:3000 still walks the demo.

## Division of labor (so V + Owner don't collide)
- **V:** theme tokens + shared primitives + nav/layout + per-page polish (the visual restyle).
- **Owner:** AI chat assistant (floating, mounted once in `app/layout.tsx`) + forecast chart component
  (dropped into Finance/Manager). Owner builds new components using the SAME primitives, so V's restyle
  flows into them. Coordinate on `app/layout.tsx` (one shared mount point) and `globals.css`.

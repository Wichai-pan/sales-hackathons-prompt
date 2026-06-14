// Sales Manager dashboard (SLICE SA-V4) — now rendered through the canvas ManagerScreen.
// Server-side data + role guard + reassign action stay here; the screen is pure
// presentation. The canvas screen has no slot for the inline deal-reassign form or
// the quarter/half/year forecast toggle, so BOTH are KEPT as wired feature blocks
// below the screen (restyled with canvas classes) — functionality over pixel-match.

import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { currentUser, dashboardPathForRole } from "@/lib/session";
import { rollUp, type Granularity } from "@/lib/forecast";
import { formatEUR, daysSince } from "@/lib/utils";
import { forecastCategories } from "@/lib/targets";
import { forecastNarrative } from "@/lib/ai/forecast-narrative";
import {
  threeYearForecast,
  pipelineByStage,
  pipelineByOwner,
  stalledDeals,
  pastCloseDeals,
  listReps,
} from "@/lib/reporting";
import { reassignDeal } from "./actions";
import { ManagerScreen, type ManagerScreenData } from "@/components/canvas/screens/ManagerScreen";
import type { DealStage as CanvasDealStage } from "@/lib/canvas/types";
import type { DealStage as PrismaDealStage } from "@prisma/client";

export const dynamic = "force-dynamic";

const GRANULARITIES: Granularity[] = ["quarter", "half", "year"];

function parseGranularity(v: string | undefined): Granularity {
  return v === "half" || v === "year" ? v : "quarter";
}

// Our Prisma DealStage -> canvas DealStage enum (the screen's funnel field is typed canvas).
const STAGE_TO_CANVAS: Record<PrismaDealStage, CanvasDealStage> = {
  INTEREST_SHOWN: "LEAD",
  RFI_ANSWERED: "DISCOVERY",
  RFP_OFFER_GIVEN: "PROPOSAL",
  CUSTOMER_TEST: "QUALIFIED",
  CONTRACT_NEGOTIATION: "NEGOTIATION",
  WON: "CLOSED_WON",
  LOST: "CLOSED_LOST",
};

export default async function ManagerPage({
  searchParams,
}: {
  searchParams: Promise<{ granularity?: string }>;
}) {
  const user = await currentUser();
  if (!user) redirect("/role-switch");
  // Role guard: only leadership sees the org-wide pipeline (Rep/TAM bounce to their own view).
  if (user.role === "REP" || user.role === "TAM") redirect(dashboardPathForRole(user.role));

  const sp = await searchParams;
  const granularity = parseGranularity(sp.granularity);

  const [forecast, byStage, byOwner, stalled, pastClose, reps, categories, pendingOffers] =
    await Promise.all([
      threeYearForecast(),
      pipelineByStage(),
      pipelineByOwner(),
      stalledDeals(),
      pastCloseDeals(),
      listReps(),
      forecastCategories(),
      // Sales-Manager approval queue: offers awaiting first-step (SM) sign-off.
      prisma.offer.findMany({
        where: { status: "PENDING_SM" },
        include: { account: true, deal: true },
        orderBy: { updatedAt: "asc" },
      }),
    ]);

  const buckets = rollUp(forecast.quarters, granularity);
  const stageMax = Math.max(1, ...byStage.map((s) => s.weightedRevenue));
  const ownerMax = Math.max(1, ...byOwner.map((o) => o.weightedRevenue));

  // AI pipeline-health narrative (P2 #23) — same inputs as the standalone card.
  const nearTermWeighted = forecast.quarters
    .slice(0, 2)
    .reduce((s, q) => s + q.weightedRevenue, 0);
  const { text: aiPipelineHealth } = await forecastNarrative({
    weightedTotal: forecast.totals.weightedRevenue,
    totalRevenue: forecast.totals.totalRevenue,
    deviceRevenue: forecast.totals.deviceRevenue,
    serviceRevenue: forecast.totals.serviceRevenue,
    nearTermWeighted,
    quartersCount: forecast.quarters.length,
    stalledCount: stalled.length,
    pastCloseCount: pastClose.length,
  });

  const now = Date.now();

  const data: ManagerScreenData = {
    kpis: {
      committed: categories.committed,
      atRisk: categories.atRisk,
      gapToTarget: categories.gapToTarget,
      target: categories.target,
    },
    funnel: byStage.map((s) => ({
      stage: STAGE_TO_CANVAS[s.stage],
      label: s.label, // human stage label from STAGE_LABEL
      count: s.count,
      value: s.weightedRevenue,
    })),
    byOwner: byOwner.map((o) => ({
      ownerId: o.ownerRepId,
      ownerName: o.ownerName,
      // We have no per-rep quota field in the brief -> stub quota/attainment (see stubbedFields).
      quota: 0,
      attainment: 0,
      dealCount: o.count,
    })),
    stalled: stalled.map((d) => ({
      id: d.id,
      name: d.name,
      accountName: d.accountName,
      daysStalled: d.daysStalled,
      amount: d.weightedRevenue,
    })),
    pastClose: pastClose.map((d) => ({
      id: d.id,
      name: d.name,
      accountName: d.accountName,
      daysOverdue: d.expectedCloseDate
        ? Math.max(0, Math.round((now - d.expectedCloseDate.getTime()) / 86_400_000))
        : 0,
      amount: d.weightedRevenue,
    })),
    pendingApprovals: pendingOffers.map((o) => ({
      id: o.id,
      title: o.deal?.name ?? o.account.name,
      accountName: o.account.name,
      discountPercent: o.discountPercent,
      total: o.total,
      currency: "EUR", // Offer has no currency field; app is EUR-only (see lib/utils formatEUR).
      // Simple policy-derived recommendation (no AI call): big discount -> reject, mild -> negotiate.
      aiRecommended:
        o.discountPercent >= 20 ? "REJECT" : o.discountPercent >= 10 ? "NEGOTIATE" : "APPROVE",
    })),
    aiPipelineHealth,
  };

  return (
    <div>
      <ManagerScreen data={data} />

      {/* ---- KEPT FEATURE: inline deal reassignment (no slot in ManagerScreen) ---- */}
      <div className="p-6 lg:p-8 pt-0 space-y-6">
        <section className="rounded-lg border border-border bg-card">
          <div className="flex items-center justify-between border-b border-border px-5 py-3">
            <div className="font-medium text-sm">Reassign stalled deals</div>
            <span className="text-xs text-muted-foreground">{stalled.length} flagged</span>
          </div>
          {stalled.length === 0 ? (
            <p className="px-5 py-4 text-sm text-muted-foreground">
              No stalled deals. Every open deal has recent activity.
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-xs uppercase tracking-wider text-muted-foreground">
                <tr className="border-b border-border">
                  <th className="px-5 py-2 text-left font-medium">Deal</th>
                  <th className="px-3 py-2 text-left font-medium">Account</th>
                  <th className="px-3 py-2 text-left font-medium">Owner</th>
                  <th className="px-3 py-2 text-left font-medium">Stage</th>
                  <th className="px-3 py-2 text-right font-medium">Stalled</th>
                  <th className="px-3 py-2 text-right font-medium">Weighted</th>
                  <th className="px-5 py-2 text-left font-medium">Reassign</th>
                </tr>
              </thead>
              <tbody>
                {stalled.map((d) => (
                  <tr key={d.id} className="border-b border-border/60 last:border-0">
                    <td className="px-5 py-2.5 font-medium">{d.name}</td>
                    <td className="px-3 py-2.5 text-muted-foreground">{d.accountName}</td>
                    <td className="px-3 py-2.5 text-muted-foreground">{d.ownerName}</td>
                    <td className="px-3 py-2.5">{d.stageLabel}</td>
                    <td className="px-3 py-2.5 text-right text-destructive tabular-nums">{d.daysStalled}d</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{formatEUR(d.weightedRevenue)}</td>
                    <td className="px-5 py-2.5">
                      <form action={reassignDeal} className="flex items-center gap-1">
                        <input type="hidden" name="dealId" value={d.id} />
                        <select
                          name="newRepId"
                          defaultValue=""
                          className="h-8 rounded-md border border-input bg-background px-2 text-xs"
                        >
                          <option value="" disabled>
                            Choose rep…
                          </option>
                          {reps.map((r) => (
                            <option key={r.id} value={r.id}>
                              {r.name}
                            </option>
                          ))}
                        </select>
                        <button
                          type="submit"
                          className="inline-flex h-8 items-center rounded-md border border-border px-3 text-xs font-medium hover:bg-secondary"
                        >
                          Go
                        </button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        {/* ---- KEPT FEATURE: pipeline by stage / by owner (weighted bars) ---- */}
        <div className="grid gap-6 lg:grid-cols-2">
          <section className="rounded-lg border border-border bg-card">
            <div className="border-b border-border px-5 py-3 font-medium text-sm">Pipeline by stage (weighted)</div>
            <table className="w-full text-sm">
              <thead className="text-xs uppercase tracking-wider text-muted-foreground">
                <tr className="border-b border-border">
                  <th className="px-5 py-2 text-left font-medium">Stage</th>
                  <th className="px-3 py-2 text-right font-medium">Prob</th>
                  <th className="px-3 py-2 text-right font-medium">Deals</th>
                  <th className="px-5 py-2 text-right font-medium">Weighted</th>
                </tr>
              </thead>
              <tbody>
                {byStage.map((s) => (
                  <tr key={s.stage} className="border-b border-border/60 last:border-0">
                    <td className="px-5 py-2.5">
                      <div className="font-medium">{s.label}</div>
                      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-secondary">
                        <div className="h-1.5 rounded-full ai-gradient" style={{ width: `${(s.weightedRevenue / stageMax) * 100}%` }} />
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-right text-muted-foreground">{s.probability}%</td>
                    <td className="px-3 py-2.5 text-right">{s.count}</td>
                    <td className="px-5 py-2.5 text-right tabular-nums">{formatEUR(s.weightedRevenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section className="rounded-lg border border-border bg-card">
            <div className="border-b border-border px-5 py-3 font-medium text-sm">Pipeline by owner (weighted)</div>
            <table className="w-full text-sm">
              <thead className="text-xs uppercase tracking-wider text-muted-foreground">
                <tr className="border-b border-border">
                  <th className="px-5 py-2 text-left font-medium">Rep</th>
                  <th className="px-3 py-2 text-right font-medium">Deals</th>
                  <th className="px-5 py-2 text-right font-medium">Weighted</th>
                </tr>
              </thead>
              <tbody>
                {byOwner.map((o) => (
                  <tr key={o.ownerRepId} className="border-b border-border/60 last:border-0">
                    <td className="px-5 py-2.5">
                      <div className="font-medium">{o.ownerName}</div>
                      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-secondary">
                        <div className="h-1.5 rounded-full ai-gradient" style={{ width: `${(o.weightedRevenue / ownerMax) * 100}%` }} />
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-right">{o.count}</td>
                    <td className="px-5 py-2.5 text-right tabular-nums">{formatEUR(o.weightedRevenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </div>

        {/* ---- KEPT FEATURE: 3-year weighted forecast + granularity toggle ---- */}
        <section className="rounded-lg border border-border bg-card">
          <div className="flex items-center justify-between border-b border-border px-5 py-3">
            <div className="font-medium text-sm">3-year weighted pipeline</div>
            <div className="flex items-center gap-1">
              {GRANULARITIES.map((g) => (
                <Link
                  key={g}
                  href={`/manager?granularity=${g}`}
                  scroll={false}
                  className={`rounded-full border px-2.5 py-0.5 text-xs ${
                    g === granularity
                      ? "border-transparent bg-primary text-primary-foreground"
                      : "border-border text-muted-foreground hover:bg-secondary"
                  }`}
                >
                  {g === "quarter" ? "Quarter" : g === "half" ? "Half-year" : "Year"}
                </Link>
              ))}
            </div>
          </div>
          <div className="p-0">
            {buckets.length === 0 ? (
              <p className="px-5 py-4 text-sm text-muted-foreground">No forecast periods yet.</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="text-xs uppercase tracking-wider text-muted-foreground">
                  <tr className="border-b border-border">
                    <th className="px-5 py-2 text-left font-medium">Period</th>
                    <th className="px-3 py-2 text-right font-medium">Device €</th>
                    <th className="px-3 py-2 text-right font-medium">Service €</th>
                    <th className="px-3 py-2 text-right font-medium">Total €</th>
                    <th className="px-5 py-2 text-right font-medium">Weighted €</th>
                  </tr>
                </thead>
                <tbody>
                  {buckets.map((b) => (
                    <tr key={b.label} className="border-b border-border/60">
                      <td className="px-5 py-2.5 font-medium">{b.label}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{formatEUR(b.deviceRevenue)}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{formatEUR(b.serviceRevenue)}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">{formatEUR(b.totalRevenue)}</td>
                      <td className="px-5 py-2.5 text-right font-semibold tabular-nums text-warning">{formatEUR(b.weightedRevenue)}</td>
                    </tr>
                  ))}
                  <tr className="border-t-2 border-border font-semibold">
                    <td className="px-5 py-2.5">Total</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{formatEUR(forecast.totals.deviceRevenue)}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{formatEUR(forecast.totals.serviceRevenue)}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{formatEUR(forecast.totals.totalRevenue)}</td>
                    <td className="px-5 py-2.5 text-right tabular-nums">{formatEUR(forecast.totals.weightedRevenue)}</td>
                  </tr>
                </tbody>
              </table>
            )}
          </div>
          <p className="px-5 py-3 text-xs text-muted-foreground">
            Time-phased rows, weighted by stage probability. Device and service revenue kept separate.
          </p>
        </section>
      </div>
    </div>
  );
}

// Finance dashboard (SLICE SA-V4) — rendered through the canvas FinanceScreen.
// Server-side data + role guard + owner/channel forecast filters stay here; the AI
// pipeline-health narrative (P2 #23) is restored above the screen.

import { Suspense } from "react";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { currentUser, dashboardPathForRole } from "@/lib/session";
import { threeYearForecast } from "@/lib/reporting";
import { daysSince } from "@/lib/utils";
import { FinanceScreen, type FinanceScreenData } from "@/components/canvas/screens/FinanceScreen";
import { ForecastNarrativeCard, ForecastNarrativeSkeleton } from "@/components/forecast-narrative-card";
import type { Channel } from "@prisma/client";

export const dynamic = "force-dynamic";

function bucketAging(offers: { total: number; updatedAt: Date }[]) {
  const buckets = [
    { bucket: "Current (0–30d)", min: 0, max: 30, amount: 0 },
    { bucket: "31–60d", min: 31, max: 60, amount: 0 },
    { bucket: "61–90d", min: 61, max: 90, amount: 0 },
    { bucket: "90d+", min: 91, max: Number.POSITIVE_INFINITY, amount: 0 },
  ];
  for (const o of offers) {
    const age = Math.max(0, Math.round((Date.now() - o.updatedAt.getTime()) / 86_400_000));
    const b = buckets.find((x) => age >= x.min && age <= x.max) ?? buckets[0];
    b.amount += o.total;
  }
  return buckets.map((b) => ({ bucket: b.bucket, amount: Math.round(b.amount) }));
}

function parseChannel(v: string | undefined): Channel | undefined {
  return v === "DIRECT" || v === "RESELLER" ? v : undefined;
}

export default async function FinancePage({
  searchParams,
}: {
  searchParams: Promise<{ owner?: string; channel?: string }>;
}) {
  const user = await currentUser();
  if (!user) redirect("/role-switch");
  if (user.role === "REP" || user.role === "TAM") redirect(dashboardPathForRole(user.role));

  const sp = await searchParams;
  const channel = parseChannel(sp.channel);
  const ownerRepId = sp.owner && sp.owner !== "all" ? sp.owner : undefined;

  const [forecast, expiringDeals, approvedOffers, reps] = await Promise.all([
    threeYearForecast({ ownerRepId, channel }),
    prisma.deal.findMany({
      where: { status: "OPEN", expectedCloseDate: { not: null } },
      include: { account: true, forecastPeriods: { select: { totalRevenue: true } } },
      orderBy: { expectedCloseDate: "asc" },
      take: 6,
    }),
    prisma.offer.findMany({ where: { status: "APPROVED" }, select: { total: true, updatedAt: true } }),
    prisma.user.findMany({ where: { role: "REP" }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);

  const { quarters, totals } = forecast;
  const gmPct = totals.totalRevenue > 0 ? (totals.grossMargin / totals.totalRevenue) * 100 : 0;

  const data: FinanceScreenData = {
    filters: {
      channels: ["DIRECT", "RESELLER"],
      selectedChannel: channel ?? "",
      owners: reps,
      selectedOwner: ownerRepId ?? "",
    },
    kpis: {
      deviceRevenue: totals.deviceRevenue,
      serviceRevenue: totals.serviceRevenue,
      netSales: totals.totalRevenue,
      grossMargin: totals.grossMargin,
      grossMarginPercent: gmPct,
      weighted: totals.weightedRevenue,
    },
    forecast: quarters.map((q) => ({
      periodLabel: q.label,
      deviceUnits: q.deviceUnits,
      deviceRevenue: q.deviceRevenue,
      serviceRevenue: q.serviceRevenue,
      totalRevenue: q.totalRevenue,
      weightedRevenue: q.weightedRevenue,
    })),
    contractsExpiring: expiringDeals.map((d) => ({
      id: d.id,
      accountName: d.account.name,
      expiresOn: d.expectedCloseDate ? d.expectedCloseDate.toISOString().slice(0, 10) : "—",
      arr: Math.round(d.forecastPeriods.reduce((s, p) => s + p.totalRevenue, 0)),
      risk: daysSince(d.lastActivityAt) >= 14 ? "high" : ("medium" as const),
    })),
    arAging: bucketAging(approvedOffers),
  };

  return (
    <div>
      <div className="px-6 pt-6 lg:px-8">
        <Suspense fallback={<ForecastNarrativeSkeleton />}>
          <ForecastNarrativeCard />
        </Suspense>
      </div>
      <FinanceScreen data={data} />
    </div>
  );
}
